package handler

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/middleware"
	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
	"mahirofox-blog/backend-go/internal/service"
)

// respondAdminUserError 后台用户管理错误映射：领域错误 → 4xx，
// 未识别错误只进日志 → 500，避免回传 GORM/SQL 细节。
func respondAdminUserError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrAdminUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
	case errors.Is(err, service.ErrAdminUsernameTaken):
		c.JSON(http.StatusConflict, gin.H{"error": "用户名已被占用"})
	case errors.Is(err, service.ErrAdminRoleInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的角色类型"})
	case errors.Is(err, service.ErrPasswordTooShort):
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码长度不能少于 6 位"})
	case errors.Is(err, service.ErrInvalidAccountInput):
		c.JSON(http.StatusBadRequest, gin.H{"error": "输入内容不合法"})
	default:
		log.Printf("admin user internal error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "操作失败，请稍后重试"})
	}
}

// ListAdminUsersHandler GET /api/admin/users
func ListAdminUsersHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		users, err := service.ListAdminUsers(c.Request.Context(), store)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户列表失败"})
			return
		}
		c.JSON(http.StatusOK, users)
	}
}

// GetAdminUserHandler GET /api/admin/users/:id
func GetAdminUserHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		u, err := service.GetAdminUser(c.Request.Context(), store, id)
		if err != nil {
			if errors.Is(err, repository.ErrAdminUserNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户失败"})
			return
		}
		c.JSON(http.StatusOK, u)
	}
}

// CreateAdminUserHandler POST /api/admin/users
func CreateAdminUserHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input model.AdminUserCreateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		// 提权防护：授予 super_admin 需要额外的 users:updateRole 权限，
		// 仅有 users:create 的角色不能自行创建超级管理员。
		if input.Role == model.AdminRoleSuperAdmin && !middleware.HasPermission(c, store, "users:updateRole") {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限创建超级管理员"})
			return
		}
		u, err := service.CreateAdminUser(c.Request.Context(), store, input)
		if err != nil {
			respondAdminUserError(c, err)
			return
		}
		c.JSON(http.StatusCreated, u)
	}
}

// LoginAdminUserHandler POST /api/admin/users/login
func LoginAdminUserHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Username string `json:"username" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		u, err := service.VerifyAdminUser(c.Request.Context(), store, body.Username, body.Password)
		if err != nil {
			if errors.Is(err, service.ErrInvalidCredentials) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
				return
			}
			log.Printf("admin user login internal error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
			return
		}
		c.JSON(http.StatusOK, u)
	}
}

// UpdateAdminUserHandler PUT /api/admin/users/:id
func UpdateAdminUserHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var input model.AdminUserUpdateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		// 提权防护：修改角色需要额外的 users:updateRole 权限，
		// 仅有 users:update 的角色不能把人改成 super_admin。
		if input.Role != nil && !middleware.HasPermission(c, store, "users:updateRole") {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限修改用户角色"})
			return
		}
		u, err := service.UpdateAdminUser(c.Request.Context(), store, id, input)
		if err != nil {
			respondAdminUserError(c, err)
			return
		}
		c.JSON(http.StatusOK, u)
	}
}

// UpdateAdminUserPasswordHandler PUT /api/admin/users/:id/password
func UpdateAdminUserPasswordHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var input model.AdminUserPasswordUpdateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		if err := service.UpdateAdminUserPassword(c.Request.Context(), store, id, input.Password); err != nil {
			respondAdminUserError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// DeleteAdminUserHandler DELETE /api/admin/users/:id
func DeleteAdminUserHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := service.DeleteAdminUser(c.Request.Context(), store, id); err != nil {
			if errors.Is(err, repository.ErrAdminUserNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
