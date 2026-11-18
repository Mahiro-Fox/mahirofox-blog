package repository

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"mahirofox-blog/backend-go/internal/model"
)

// 操作日志单页最大条数
const operationLogMaxPageSize = 100

// applyOperationLogFilters 把查询条件套到 GORM 链上（纯函数，不修改入参语义）
func applyOperationLogFilters(qb *gorm.DB, q model.OperationLogQuery) *gorm.DB {
	if q.Resource != "" {
		qb = qb.Where("resource = ?", q.Resource)
	}
	if q.Action != "" {
		qb = qb.Where("action = ?", q.Action)
	}
	if q.OperatorID != "" {
		qb = qb.Where("operator_id = ?", q.OperatorID)
	}
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		qb = qb.Where(
			"(summary ILIKE ? OR operator_name ILIKE ? OR target_id ILIKE ?)",
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

// CreateOperationLog 写入一条操作日志
func (s *GormStore) CreateOperationLog(ctx context.Context, l *model.OperationLog) error {
	if err := s.db.WithContext(ctx).Create(l).Error; err != nil {
		return fmt.Errorf("create operation log: %w", err)
	}
	return nil
}

// ListOperationLogs 分页查询操作日志（时间倒序）
func (s *GormStore) ListOperationLogs(ctx context.Context, q model.OperationLogQuery) (*model.OperationLogPage, error) {
	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > operationLogMaxPageSize {
		pageSize = operationLogMaxPageSize
	}

	countQuery := applyOperationLogFilters(
		s.db.WithContext(ctx).Model(&model.OperationLog{}), q,
	)
	var total int64
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count operation logs: %w", err)
	}

	items := make([]model.OperationLog, 0, pageSize)
	listQuery := applyOperationLogFilters(
		s.db.WithContext(ctx).Model(&model.OperationLog{}), q,
	)
	if err := listQuery.
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list operation logs: %w", err)
	}

	return &model.OperationLogPage{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}
