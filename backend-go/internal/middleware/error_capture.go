// Package middleware
// error_capture.go：全局错误采集。
// 捕获 panic 与最终状态码 >= 500 的响应，取出响应体里的错误文案后异步上报，
// 不阻塞、不影响原始响应；上报失败只写进程日志。
package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/service"
)

// maxCaptureBody 响应体采样上限，足够覆盖 {"error":"..."} 这类结构
const maxCaptureBody = 2 << 10

// captureWriter 透传写入的同时采样响应体，用于提取错误文案
type captureWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *captureWriter) Write(b []byte) (int, error) {
	if remaining := maxCaptureBody - w.body.Len(); remaining > 0 {
		if len(b) > remaining {
			w.body.Write(b[:remaining])
		} else {
			w.body.Write(b)
		}
	}
	return w.ResponseWriter.Write(b)
}

// ErrorCapture 全局错误兜底。需尽早注册（置于会话中间件之前），
// 这样 post 阶段仍能读到 RequireSession 写入的操作人身份。
func ErrorCapture() gin.HandlerFunc {
	return func(c *gin.Context) {
		writer := &captureWriter{ResponseWriter: c.Writer}
		c.Writer = writer

		defer func() {
			recovered := recover()
			if recovered == nil {
				return
			}
			service.ReportErrorAsync(service.ErrorInput{
				Level:        "panic",
				Code:         "PANIC",
				Message:      fmt.Sprint(recovered),
				Stack:        string(debug.Stack()),
				Method:       c.Request.Method,
				Path:         c.Request.URL.Path,
				Status:       http.StatusInternalServerError,
				OperatorID:   asString(mustGet(c, CtxKeyUserID)),
				OperatorName: asString(mustGet(c, CtxKeyUsername)),
				OperatorRole: asString(mustGet(c, CtxKeyRole)),
				IP:           c.ClientIP(),
				UserAgent:    c.GetHeader("User-Agent"),
				RequestID:    requestID(c),
			})
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}()

		c.Next()

		status := writer.Status()
		if status < http.StatusInternalServerError {
			return
		}

		message := extractErrorMessage(writer.body.Bytes())
		if message == "" {
			message = fmt.Sprintf("%s %s 返回 %d", c.Request.Method, c.Request.URL.Path, status)
		}

		service.ReportErrorAsync(service.ErrorInput{
			Level:        "error",
			Code:         fmt.Sprintf("http_%d", status),
			Message:      message,
			Method:       c.Request.Method,
			Path:         c.Request.URL.Path,
			Status:       status,
			OperatorID:   asString(mustGet(c, CtxKeyUserID)),
			OperatorName: asString(mustGet(c, CtxKeyUsername)),
			OperatorRole: asString(mustGet(c, CtxKeyRole)),
			IP:           c.ClientIP(),
			UserAgent:    c.GetHeader("User-Agent"),
			RequestID:    requestID(c),
		})
	}
}

// mustGet 安全读取 gin context 中的值
func mustGet(c *gin.Context, key string) any {
	v, _ := c.Get(key)
	return v
}

// requestID 读取上游透传的请求 ID（Next 侧可选携带）
func requestID(c *gin.Context) string {
	if id := c.GetHeader("X-Request-ID"); id != "" {
		return id
	}
	return c.GetHeader("X-Request-Id")
}

// extractErrorMessage 从 JSON 响应体中提取 error / message 字段
func extractErrorMessage(body []byte) string {
	if len(body) == 0 {
		return ""
	}
	var payload struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return ""
	}
	if payload.Error != "" {
		return payload.Error
	}
	return payload.Message
}
