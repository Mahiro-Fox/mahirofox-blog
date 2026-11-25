package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
	"mahirofox-blog/backend-go/internal/service"
)

// maxBatchDeleteErrorLogs 单次批量删除上限
const maxBatchDeleteErrorLogs = 500

// ListErrorLogsHandler GET /api/admin/error-logs
// 支持分页与按级别 / 关键词 / 时间范围筛选。
func ListErrorLogsHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, _ := strconv.Atoi(c.Query("page"))
		pageSize, _ := strconv.Atoi(c.Query("pageSize"))

		query := model.ErrorLogQuery{
			Page:     page,
			PageSize: pageSize,
			Level:    c.Query("level"),
			Keyword:  c.Query("keyword"),
		}
		if v := c.Query("start"); v != "" {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				query.StartTime = &t
			}
		}
		if v := c.Query("end"); v != "" {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				query.EndTime = &t
			}
		}

		result, err := service.ListErrorLogs(c.Request.Context(), store, query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取错误日志失败"})
			return
		}
		// 列表不返回大字段，详情接口再取完整堆栈与上下文
		for i := range result.Items {
			result.Items[i].Stack = ""
			result.Items[i].Detail = ""
		}
		c.JSON(http.StatusOK, result)
	}
}

// GetErrorLogHandler GET /api/admin/error-logs/:id
func GetErrorLogHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		item, err := service.GetErrorLog(c.Request.Context(), store, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取错误日志详情失败"})
			return
		}
		if item == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "错误日志不存在"})
			return
		}
		c.JSON(http.StatusOK, item)
	}
}

// DeleteErrorLogHandler DELETE /api/admin/error-logs/:id
func DeleteErrorLogHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		deleted, err := service.DeleteErrorLog(c.Request.Context(), store, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "删除错误日志失败"})
			return
		}
		if deleted == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "错误日志不存在"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "deleted": deleted})
	}
}

// batchDeleteErrorLogsBody 批量删除请求体
type batchDeleteErrorLogsBody struct {
	IDs []string `json:"ids"`
}

// DeleteErrorLogsBatchHandler DELETE /api/admin/error-logs/batch
// 请求体：{"ids":["...","..."]}，单次最多 500 条。
func DeleteErrorLogsBatchHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body batchDeleteErrorLogsBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}

		ids := make([]string, 0, len(body.IDs))
		for _, id := range body.IDs {
			trimmed := strings.TrimSpace(id)
			if trimmed != "" {
				ids = append(ids, trimmed)
			}
		}
		if len(ids) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "未选择要删除的日志"})
			return
		}
		if len(ids) > maxBatchDeleteErrorLogs {
			c.JSON(http.StatusBadRequest, gin.H{"error": "单次最多删除 500 条日志"})
			return
		}

		deleted, err := service.DeleteErrorLogs(c.Request.Context(), store, ids)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "批量删除错误日志失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "deleted": deleted})
	}
}
