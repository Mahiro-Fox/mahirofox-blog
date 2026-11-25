// Package service
// error_log_service.go：后端错误日志的异步上报、指纹去重写入、查询与保留期清理。
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
)

const (
	// ErrorLogRetention 错误日志保留时长
	ErrorLogRetention = 30 * 24 * time.Hour
	// errorDedupeWindow 相同指纹的去重窗口：窗口内只累加次数
	errorDedupeWindow = time.Hour
	// errorReportQueueSize 上报队列长度，满时丢弃并输出进程日志
	errorReportQueueSize = 1024
	// errorReportTimeout 单条落库超时，避免数据库异常拖住上报 worker
	errorReportTimeout = 3 * time.Second

	maxErrorMessage = 2000
	maxErrorStack   = 8000
	maxErrorDetail  = 2000
)

// ErrorInput 一条待上报的错误素材。
// 由 middleware.ErrorCapture 自动采集，也可在业务代码中显式构造后调用 ReportErrorAsync。
type ErrorInput struct {
	// Level 错误级别：error / panic
	Level string
	// Code 业务错误码或 HTTP 语义标识，如 INTERNAL / PANIC / http_500
	Code         string
	Message      string
	Stack        string
	Method       string
	Path         string
	Status       int
	OperatorID   string
	OperatorName string
	OperatorRole string
	IP           string
	UserAgent    string
	RequestID    string
	Detail       string
}

var (
	reporterMu   sync.Mutex
	reporterCh   chan ErrorInput
	reporterDone chan struct{}
	reporterStop chan struct{}
)

// StartErrorReporter 启动错误上报 worker（幂等）。
// 必须在注册路由之前调用，否则早期的错误会因为没有 worker 而只输出到进程日志。
func StartErrorReporter(store repository.Store) {
	reporterMu.Lock()
	defer reporterMu.Unlock()
	if reporterCh != nil {
		return
	}

	reporterCh = make(chan ErrorInput, errorReportQueueSize)
	reporterDone = make(chan struct{})
	reporterStop = make(chan struct{})
	ch := reporterCh
	done := reporterDone
	stop := reporterStop

	go func() {
		defer close(done)
		for {
			select {
			case input, ok := <-ch:
				if !ok {
					return
				}
				flushErrorInput(store, input)
			case <-stop:
				// 优雅关闭：把队列里剩余的错误写完再退出
				for {
					select {
					case input, ok := <-ch:
						if !ok {
							return
						}
						flushErrorInput(store, input)
					default:
						return
					}
				}
			}
		}
	}()
}

// StopErrorReporter 停止 worker 并等待队列冲刷完成（幂等）
func StopErrorReporter() {
	reporterMu.Lock()
	defer reporterMu.Unlock()
	if reporterCh == nil {
		return
	}
	close(reporterStop)
	<-reporterDone
	// 不关闭 channel：并发调用方可能仍持有旧引用，
	// 关闭后发送会 panic；置空后新调用直接走进程日志分支。
	reporterCh = nil
	reporterDone = nil
	reporterStop = nil
}

// ReportErrorAsync 把错误放入上报队列，永不阻塞调用方。
// 队列满或 worker 未启动时丢弃，只写进程日志，绝不影响主业务流程。
func ReportErrorAsync(in ErrorInput) {
	reporterMu.Lock()
	ch := reporterCh
	reporterMu.Unlock()

	if ch == nil {
		log.Printf("[error-log] reporter 未启动，丢弃: %s %s", in.Level, in.Message)
		return
	}

	select {
	case ch <- in:
	default:
		log.Printf("[error-log] 队列已满，丢弃: %s %s", in.Level, in.Message)
	}
}

// flushErrorInput 单条错误落库（带独立超时）
func flushErrorInput(store repository.Store, in ErrorInput) {
	ctx, cancel := context.WithTimeout(context.Background(), errorReportTimeout)
	defer cancel()
	if err := ReportError(ctx, store, in); err != nil {
		log.Printf("[error-log] 写入失败: %v", err)
	}
}

// ReportError 同步写入一条错误日志（供测试或需要确认落库的场景使用）。
// 命中同一指纹且在一小时窗口内时只累加次数，不重复插入。
func ReportError(ctx context.Context, store repository.Store, in ErrorInput) error {
	now := time.Now()
	level := strings.TrimSpace(in.Level)
	if level == "" {
		level = "error"
	}

	message := truncateString(strings.TrimSpace(in.Message), maxErrorMessage)
	if message == "" {
		message = "unknown error"
	}

	fingerprint := buildErrorFingerprint(level, in.Code, in.Method, in.Path, message)

	existing, err := store.FindRecentErrorLogByFingerprint(
		ctx, fingerprint, now.Add(-errorDedupeWindow),
	)
	if err != nil {
		return err
	}
	if existing != nil {
		return store.IncrementErrorLogCount(ctx, existing.ID, now)
	}

	item := &model.ErrorLog{
		ID:           uuid.NewString(),
		Level:        level,
		Code:         truncateString(strings.TrimSpace(in.Code), 120),
		Message:      message,
		Stack:        truncateString(in.Stack, maxErrorStack),
		Method:       truncateString(strings.TrimSpace(in.Method), 16),
		Path:         truncateString(strings.TrimSpace(in.Path), 512),
		Status:       in.Status,
		OperatorID:   strings.TrimSpace(in.OperatorID),
		OperatorName: truncateString(strings.TrimSpace(in.OperatorName), 128),
		OperatorRole: truncateString(strings.TrimSpace(in.OperatorRole), 64),
		IP:           truncateString(strings.TrimSpace(in.IP), 64),
		UserAgent:    truncateString(in.UserAgent, 512),
		RequestID:    truncateString(strings.TrimSpace(in.RequestID), 128),
		Detail:       truncateString(in.Detail, maxErrorDetail),
		Fingerprint:  fingerprint,
		Count:        1,
		FirstSeenAt:  now,
		LastSeenAt:   now,
		CreatedAt:    now,
	}
	return store.CreateErrorLog(ctx, item)
}

// buildErrorFingerprint 生成错误指纹：同一级别、错误码、接口与消息视为同一种错误
func buildErrorFingerprint(level, code, method, path, message string) string {
	raw := strings.Join([]string{
		strings.TrimSpace(level),
		strings.TrimSpace(code),
		strings.TrimSpace(method),
		strings.TrimSpace(path),
		strings.TrimSpace(message),
	}, "|")
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// ListErrorLogs 分页查询错误日志
func ListErrorLogs(ctx context.Context, store repository.Store, q model.ErrorLogQuery) (*model.ErrorLogPage, error) {
	return store.ListErrorLogs(ctx, q)
}

// GetErrorLog 查询单条错误日志详情
func GetErrorLog(ctx context.Context, store repository.Store, id string) (*model.ErrorLog, error) {
	return store.GetErrorLog(ctx, id)
}

// DeleteErrorLog 删除单条错误日志
func DeleteErrorLog(ctx context.Context, store repository.Store, id string) (int64, error) {
	return store.DeleteErrorLog(ctx, id)
}

// DeleteErrorLogs 批量删除错误日志
func DeleteErrorLogs(ctx context.Context, store repository.Store, ids []string) (int64, error) {
	return store.DeleteErrorLogs(ctx, ids)
}

// CleanupExpiredErrorLogs 删除保留期之外的错误日志，返回删除条数
func CleanupExpiredErrorLogs(ctx context.Context, store repository.Store, now time.Time) (int64, error) {
	before := now.Add(-ErrorLogRetention)
	deleted, err := store.DeleteErrorLogsBefore(ctx, before)
	if err != nil {
		return 0, fmt.Errorf("cleanup expired error logs: %w", err)
	}
	return deleted, nil
}
