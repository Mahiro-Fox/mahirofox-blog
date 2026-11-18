// Package service
// operation_log_service.go：管理后台操作日志的写入、查询与请求语义解析（纯函数编排）
package service

import (
	"context"
	"encoding/json"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
)

// OperationLogInput 中间件 / 登录流程收集到的一条操作日志素材
type OperationLogInput struct {
	OperatorID   string
	OperatorName string
	OperatorRole string
	Action       string
	Resource     string
	TargetID     string
	Summary      string
	Detail       string
	IP           string
	UserAgent    string
	Success      bool
	Status       int
}

// OperationMeta 请求路径解析出的操作语义
type OperationMeta struct {
	Action   string
	Resource string
	TargetID string
	Summary  string
}

// 资源标识 → 中文名（用于生成摘要）
var operationResourceLabels = map[string]string{
	"movies":           "影视",
	"music":            "音乐",
	"moments":          "碎碎念",
	"guestbook":        "留言",
	"bugs":             "BUG",
	"accounts":         "前台用户",
	"users":            "后台用户",
	"tags":             "标签",
	"role-permissions": "角色权限",
	"analytics":        "访问日志",
	"operation-logs":   "操作日志",
	"auth":             "登录",
}

// 动作 → 中文名（用于生成摘要）
var operationActionLabels = map[string]string{
	"create":         "创建",
	"update":         "更新",
	"delete":         "删除",
	"approve":        "审核",
	"reply":          "回复",
	"updateStatus":   "更新状态",
	"updatePassword": "修改密码",
	"login":          "登录",
}

// DescribeOperation 从 HTTP 方法与路径解析出动作、资源、目标与摘要。
// 路径形如 /api/admin/bugs/:id/status，资源取 /api/admin/ 后的第一段。
func DescribeOperation(method, path string) OperationMeta {
	parts := splitPath(path)
	resource := ""
	if len(parts) >= 3 && parts[0] == "api" && parts[1] == "admin" {
		resource = parts[2]
	}
	targetID := ""
	if len(parts) >= 4 {
		targetID = parts[3]
	}

	action := ""
	if len(parts) >= 5 {
		switch parts[len(parts)-1] {
		case "approve":
			action = "approve"
		case "reply":
			action = "reply"
		case "status":
			action = "updateStatus"
		case "password":
			action = "updatePassword"
		}
	}
	if action == "" {
		switch method {
		case "POST":
			action = "create"
		case "PUT", "PATCH":
			action = "update"
		case "DELETE":
			action = "delete"
		}
	}

	return OperationMeta{
		Action:   action,
		Resource: resource,
		TargetID: targetID,
		Summary:  buildOperationSummary(action, resource),
	}
}

// splitPath 去掉首尾斜杠后按 / 切分，过滤空段
func splitPath(path string) []string {
	raw := strings.Split(strings.Trim(path, "/"), "/")
	parts := make([]string, 0, len(raw))
	for _, p := range raw {
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}

// buildOperationSummary 生成「动作 + 资源」的中文摘要
func buildOperationSummary(action, resource string) string {
	actionLabel, ok := operationActionLabels[action]
	if !ok {
		actionLabel = action
	}
	resourceLabel, ok := operationResourceLabels[resource]
	if !ok {
		resourceLabel = resource
	}
	if resourceLabel == "" {
		return actionLabel
	}
	return actionLabel + resourceLabel
}

// WriteOperationLog 组装并落库一条操作日志。
// 失败只返回错误，由调用方决定是否输出到进程日志，不影响主业务流程。
func WriteOperationLog(ctx context.Context, store repository.Store, in OperationLogInput) error {
	action := strings.TrimSpace(in.Action)
	if action == "" {
		return nil
	}
	log := model.OperationLog{
		ID:           uuid.NewString(),
		CreatedAt:    time.Now(),
		OperatorID:   strings.TrimSpace(in.OperatorID),
		OperatorName: strings.TrimSpace(in.OperatorName),
		OperatorRole: strings.TrimSpace(in.OperatorRole),
		Action:       action,
		Resource:     strings.TrimSpace(in.Resource),
		TargetID:     strings.TrimSpace(in.TargetID),
		Summary:      strings.TrimSpace(in.Summary),
		Detail:       in.Detail,
		IP:           strings.TrimSpace(in.IP),
		UserAgent:    truncateString(in.UserAgent, 512),
		Success:      in.Success,
		Status:       in.Status,
	}
	return store.CreateOperationLog(ctx, &log)
}

// ListOperationLogs 分页查询操作日志（参数校验收敛在仓储层）
func ListOperationLogs(ctx context.Context, store repository.Store, q model.OperationLogQuery) (*model.OperationLogPage, error) {
	return store.ListOperationLogs(ctx, q)
}

// 敏感字段名片段：命中即脱敏，避免把密码 / 令牌落库
var sensitiveKeyFragments = []string{"password", "token", "secret", "cookie", "authorization", "hash"}

// maxOperationDetail 单条日志详情最大字符数
const maxOperationDetail = 2000

// SanitizeBody 把请求体转为可落库的脱敏 JSON 字符串。
// 非 JSON 请求体一律不保存，避免误存密码等明文。
func SanitizeBody(raw []byte) string {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || !json.Valid([]byte(trimmed)) {
		return ""
	}
	var parsed any
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		return ""
	}
	redacted := redactValue(parsed)
	out, err := json.Marshal(redacted)
	if err != nil {
		return ""
	}
	return truncateString(string(out), maxOperationDetail)
}

// redactValue 递归脱敏 map / slice 中的敏感字段
func redactValue(v any) any {
	switch value := v.(type) {
	case map[string]any:
		result := make(map[string]any, len(value))
		for key, item := range value {
			if isSensitiveKey(key) {
				result[key] = "***"
				continue
			}
			result[key] = redactValue(item)
		}
		return result
	case []any:
		result := make([]any, len(value))
		for i, item := range value {
			result[i] = redactValue(item)
		}
		return result
	default:
		return value
	}
}

// isSensitiveKey 判断字段名是否属于敏感字段
func isSensitiveKey(key string) bool {
	lower := strings.ToLower(key)
	for _, fragment := range sensitiveKeyFragments {
		if strings.Contains(lower, fragment) {
			return true
		}
	}
	return false
}

// truncateString 按字符截断，避免破坏 UTF-8
func truncateString(s string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(s) <= limit {
		return s
	}
	runes := []rune(s)
	return string(runes[:limit])
}
