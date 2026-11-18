// Package model
// operation_log.go 管理后台操作日志模型（对应 operation_logs 表）
package model

import "time"

// OperationLog 后台操作审计日志
// 由 OperationLogger 中间件在管理端写操作完成后写入。
type OperationLog struct {
	ID           string    `gorm:"primaryKey;type:text" json:"id"`
	CreatedAt    time.Time `gorm:"not null;default:now();index:idx_operation_logs_created_at" json:"createdAt"`
	OperatorID   string    `gorm:"type:text;not null;default:'';index:idx_operation_logs_operator" json:"operatorId"`
	OperatorName string    `gorm:"type:text;not null;default:''" json:"operatorName"`
	OperatorRole string    `gorm:"type:text;not null;default:''" json:"operatorRole"`
	Action       string    `gorm:"type:text;not null;index:idx_operation_logs_action" json:"action"`
	Resource     string    `gorm:"type:text;not null;index:idx_operation_logs_resource" json:"resource"`
	TargetID     string    `gorm:"type:text;not null;default:''" json:"targetId"`
	Summary      string    `gorm:"type:text;not null;default:''" json:"summary"`
	Detail       string    `gorm:"type:text;not null;default:''" json:"detail"`
	IP           string    `gorm:"type:text;not null;default:''" json:"ip"`
	UserAgent    string    `gorm:"type:text;not null;default:''" json:"userAgent"`
	Success      bool      `gorm:"not null;default:true" json:"success"`
	Status       int       `gorm:"not null;default:0" json:"status"`
}

// OperationLogQuery 操作日志查询条件（零值表示不过滤）
type OperationLogQuery struct {
	Page       int
	PageSize   int
	Resource   string
	Action     string
	OperatorID string
	Keyword    string
	StartTime  *time.Time
	EndTime    *time.Time
}

// OperationLogPage 操作日志分页结果
type OperationLogPage struct {
	Items    []OperationLog `json:"items"`
	Total    int64          `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
}
