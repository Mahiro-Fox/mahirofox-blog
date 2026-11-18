// Package middleware
// operation_log.go：管理端写操作审计中间件。
// 只记录 POST / PUT / PATCH / DELETE，且在响应完成后落库，
// 不读取业务响应体，失败也不影响主流程。
package middleware

import (
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/repository"
	"mahirofox-blog/backend-go/internal/service"
)

// maxOperationBody 请求体采样上限（超过部分不读，避免大文件上传占内存）
const maxOperationBody = 4 << 10

// operationLogTimeout 日志落库超时，避免数据库异常时拖住请求
const operationLogTimeout = 3 * time.Second

// OperationLogger 记录管理端写操作。需挂在 RequireSession 之后，
// 以便从 gin context 读取操作人身份。
func OperationLogger(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !isMutatingMethod(c.Request.Method) {
			c.Next()
			return
		}

		// 采样请求体并原样放回，供后续 handler 正常绑定
		var body []byte
		if c.Request.Body != nil {
			sampled, _ := io.ReadAll(io.LimitReader(c.Request.Body, maxOperationBody))
			body = sampled
			c.Request.Body = io.NopCloser(io.MultiReader(bytes.NewReader(body), c.Request.Body))
		}

		c.Next()

		operatorID, _ := c.Get(CtxKeyUserID)
		operatorName, _ := c.Get(CtxKeyUsername)
		operatorRole, _ := c.Get(CtxKeyRole)
		meta := service.DescribeOperation(c.Request.Method, c.Request.URL.Path)
		status := c.Writer.Status()

		ctx, cancel := context.WithTimeout(context.Background(), operationLogTimeout)
		defer cancel()
		if err := service.WriteOperationLog(ctx, store, service.OperationLogInput{
			OperatorID:   asString(operatorID),
			OperatorName: asString(operatorName),
			OperatorRole: asString(operatorRole),
			Action:       meta.Action,
			Resource:     meta.Resource,
			TargetID:     meta.TargetID,
			Summary:      meta.Summary,
			Detail:       service.SanitizeBody(body),
			IP:           c.ClientIP(),
			UserAgent:    c.GetHeader("User-Agent"),
			Success:      status >= http.StatusOK && status < http.StatusMultipleChoices,
			Status:       status,
		}); err != nil {
			log.Printf("写入操作日志失败: %v", err)
		}
	}
}

// isMutatingMethod 判断是否为会改变状态的请求方法
func isMutatingMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

// asString 把 gin context 中的值安全转为字符串
func asString(v any) string {
	s, _ := v.(string)
	return s
}
