package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
	"mahirofox-blog/backend-go/internal/service"
)

// ListOperationLogsHandler GET /api/admin/operation-logs
// 支持分页与按资源 / 动作 / 操作人 / 关键词 / 时间范围筛选。
func ListOperationLogsHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, _ := strconv.Atoi(c.Query("page"))
		pageSize, _ := strconv.Atoi(c.Query("pageSize"))

		query := model.OperationLogQuery{
			Page:       page,
			PageSize:   pageSize,
			Resource:   c.Query("resource"),
			Action:     c.Query("action"),
			OperatorID: c.Query("operatorId"),
			Keyword:    c.Query("keyword"),
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

		result, err := service.ListOperationLogs(c.Request.Context(), store, query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取操作日志失败"})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}
