package repository

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"mahirofox-blog/backend-go/internal/model"
)

// 错误日志单页最大条数
const errorLogMaxPageSize = 100

// applyErrorLogFilters 把查询条件套到 GORM 链上
func applyErrorLogFilters(qb *gorm.DB, q model.ErrorLogQuery) *gorm.DB {
	if q.Level != "" {
		qb = qb.Where("level = ?", q.Level)
	}
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		qb = qb.Where(
			"(message ILIKE ? OR code ILIKE ? OR path ILIKE ?)",
			like, like, like,
		)
	}
	if q.StartTime != nil {
		qb = qb.Where("created_at >= ?", *q.StartTime)
	}
	if q.EndTime != nil {
		qb = qb.Where("created_at <= ?", *q.EndTime)
	}
	return qb
}

// CreateErrorLog 写入一条错误日志
func (s *GormStore) CreateErrorLog(ctx context.Context, l *model.ErrorLog) error {
	if err := s.db.WithContext(ctx).Create(l).Error; err != nil {
		return fmt.Errorf("create error log: %w", err)
	}
	return nil
}

// FindRecentErrorLogByFingerprint 查找窗口期内相同指纹的最近一条记录
func (s *GormStore) FindRecentErrorLogByFingerprint(ctx context.Context, fingerprint string, since time.Time) (*model.ErrorLog, error) {
	var item model.ErrorLog
	err := s.db.WithContext(ctx).
		Where("fingerprint = ? AND last_seen_at >= ?", fingerprint, since).
		Order("last_seen_at DESC").
		First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("find error log by fingerprint: %w", err)
	}
	return &item, nil
}

// IncrementErrorLogCount 命中重复错误时累加次数并刷新最后出现时间
func (s *GormStore) IncrementErrorLogCount(ctx context.Context, id string, lastSeen time.Time) error {
	err := s.db.WithContext(ctx).
		Model(&model.ErrorLog{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"count":        gorm.Expr("count + 1"),
			"last_seen_at": lastSeen,
		}).Error
	if err != nil {
		return fmt.Errorf("increment error log count: %w", err)
	}
	return nil
}

// ListErrorLogs 分页查询错误日志（时间倒序）
func (s *GormStore) ListErrorLogs(ctx context.Context, q model.ErrorLogQuery) (*model.ErrorLogPage, error) {
	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > errorLogMaxPageSize {
		pageSize = errorLogMaxPageSize
	}

	var total int64
	if err := applyErrorLogFilters(
		s.db.WithContext(ctx).Model(&model.ErrorLog{}), q,
	).Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count error logs: %w", err)
	}

	items := make([]model.ErrorLog, 0, pageSize)
	if err := applyErrorLogFilters(
		s.db.WithContext(ctx).Model(&model.ErrorLog{}), q,
	).
		Order("last_seen_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list error logs: %w", err)
	}

	return &model.ErrorLogPage{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetErrorLog 按 ID 查询单条错误日志
func (s *GormStore) GetErrorLog(ctx context.Context, id string) (*model.ErrorLog, error) {
	var item model.ErrorLog
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("get error log: %w", err)
	}
	return &item, nil
}

// DeleteErrorLog 删除单条错误日志
func (s *GormStore) DeleteErrorLog(ctx context.Context, id string) (int64, error) {
	result := s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.ErrorLog{})
	if result.Error != nil {
		return 0, fmt.Errorf("delete error log: %w", result.Error)
	}
	return result.RowsAffected, nil
}

// DeleteErrorLogs 按 ID 批量删除错误日志
func (s *GormStore) DeleteErrorLogs(ctx context.Context, ids []string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := s.db.WithContext(ctx).Where("id IN ?", ids).Delete(&model.ErrorLog{})
	if result.Error != nil {
		return 0, fmt.Errorf("batch delete error logs: %w", result.Error)
	}
	return result.RowsAffected, nil
}

// DeleteErrorLogsBefore 删除最后出现时间早于指定时间的错误日志（保留期清理）
// 按 last_seen_at 判断，重复出现的错误不会因为首次记录时间久远被误删。
func (s *GormStore) DeleteErrorLogsBefore(ctx context.Context, before time.Time) (int64, error) {
	result := s.db.WithContext(ctx).Where("last_seen_at < ?", before).Delete(&model.ErrorLog{})
	if result.Error != nil {
		return 0, fmt.Errorf("cleanup error logs: %w", result.Error)
	}
	return result.RowsAffected, nil
}
