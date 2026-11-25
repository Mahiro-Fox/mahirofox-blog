// Package model
// error_log.go 后端错误日志模型（对应 error_logs 表）
package model

import "time"

// ErrorLog 后端业务错误记录。
// 由 service.ReportError 异步写入，管理后台只读 + 删除。
type ErrorLog struct {
	ID           string    `gorm:"primaryKey;type:text" json:"id"`
	Level        string    `gorm:"type:text;not null;default:'error';index:idx_error_logs_level" json:"level"`
	Code         string    `gorm:"type:text;not null;default:''" json:"code"`
	Message      string    `gorm:"type:text;not null;default:''" json:"message"`
	Stack        string    `gorm:"type:text;not null;default:''" json:"stack"`
	Method       string    `gorm:"type:text;not null;default:''" json:"method"`
	Path         string    `gorm:"type:text;not null;default:''" json:"path"`
	Status       int       `gorm:"not null;default:0" json:"status"`
	OperatorID   string    `gorm:"type:text;not null;default:''" json:"operatorId"`
	OperatorName string    `gorm:"type:text;not null;default:''" json:"operatorName"`
	OperatorRole string    `gorm:"type:text;not null;default:''" json:"operatorRole"`
	IP           string    `gorm:"type:text;not null;default:''" json:"ip"`
	UserAgent    string    `gorm:"type:text;not null;default:''" json:"userAgent"`
	RequestID    string    `gorm:"type:text;not null;default:''" json:"requestId"`
	Detail       string    `gorm:"type:text;not null;default:''" json:"detail"`
	// Fingerprint 用于短窗口去重：相同指纹只累加 Count，不重复插入
	Fingerprint string    `gorm:"type:text;not null;default:'';index:idx_error_logs_fingerprint" json:"fingerprint"`
	Count       int       `gorm:"not null;default:1" json:"count"`
	FirstSeenAt time.Time `gorm:"not null;default:now()" json:"firstSeenAt"`
	LastSeenAt  time.Time `gorm:"not null;default:now();index:idx_error_logs_last_seen_at" json:"lastSeenAt"`
	CreatedAt   time.Time `gorm:"not null;default:now();index:idx_error_logs_created_at" json:"createdAt"`
}

// ErrorLogQuery 错误日志查询条件（零值表示不过滤）
type ErrorLogQuery struct {
	Page      int
	PageSize  int
	Level     string
	Keyword   string
	StartTime *time.Time
	EndTime   *time.Time
}

// ErrorLogPage 错误日志分页结果
type ErrorLogPage struct {
	Items    []ErrorLog `json:"items"`
	Total    int64      `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"pageSize"`
}
