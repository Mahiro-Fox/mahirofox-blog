package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
	"mahirofox-blog/backend-go/internal/service"
)

// respondAccountWriteError 创建/更新类账户操作的统一错误映射。
// 领域错误映射为稳定的 4xx 文案；未识别错误只进日志并返回 500，
// 避免把 GORM/SQL 等内部细节回传给客户端。
func respondAccountWriteError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrAccountUsernameTaken):
		c.JSON(http.StatusConflict, gin.H{"error": "用户名已被占用"})
	case errors.Is(err, repository.ErrAccountEmailTaken):
		c.JSON(http.StatusConflict, gin.H{"error": "邮箱已被占用"})
	case errors.Is(err, service.ErrPasswordTooShort):
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码长度不能少于 6 位"})
	case errors.Is(err, service.ErrInvalidAccountInput):
		c.JSON(http.StatusBadRequest, gin.H{"error": "输入内容不合法"})
	default:
		log.Printf("account write internal error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "操作失败，请稍后重试"})
	}
}

// ListAccountsHandler GET /api/admin/accounts
func ListAccountsHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		accounts, err := service.ListAccounts(c.Request.Context(), store)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取账户列表失败"})
			return
		}
		c.JSON(http.StatusOK, accounts)
	}
}

// GetAccountHandler GET /api/admin/accounts/:id（管理员端，返回完整字段）
func GetAccountHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		a, err := service.GetAccount(c.Request.Context(), store, id)
		if err != nil {
			if errors.Is(err, repository.ErrAccountNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "账户不存在"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取账户失败"})
			return
		}
		c.JSON(http.StatusOK, a)
	}
}

// GetPublicAccountHandler GET /api/accounts/:id（公开只读端点）
// 只返回公开字段：id / username / provider / createdAt。
// 不返回 email：该端点无需内部密钥即可匿名访问，邮箱属个人信息，避免被批量枚举。
func GetPublicAccountHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" || len(id) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的账户 ID"})
			return
		}
		a, err := service.GetAccount(c.Request.Context(), store, id)
		if err != nil {
			if errors.Is(err, repository.ErrAccountNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "账户不存在"})
				return
			}
			log.Printf("get public account internal error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取账户失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"id":        a.ID,
			"username":  a.Username,
			"provider":  a.Provider,
			"createdAt": a.CreatedAt,
		})
	}
}

// CheckAccountEmailExistsHandler GET /api/accounts/exists?email=
// 公开端点：判断邮箱是否已注册，并告知是否已设置密码。
// 仅返回布尔，不泄露账户其他信息；hasPassword 用于前端区分「密码登录」与「Google 账户」。
func CheckAccountEmailExistsHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		email := strings.TrimSpace(c.Query("email"))
		if email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 email 参数"})
			return
		}
		a, err := service.GetAccountByEmail(c.Request.Context(), store, email)
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"exists": true, "hasPassword": a.PasswordHash != ""})
		case errors.Is(err, repository.ErrAccountNotFound):
			c.JSON(http.StatusOK, gin.H{"exists": false, "hasPassword": false})
		default:
			log.Printf("check account email internal error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败，请稍后重试"})
		}
	}
}

// CreateAccountHandler POST /api/accounts
// 前台注册接口（不需要 X-Internal-Secret）
func CreateAccountHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input model.AccountCreateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		a, err := service.CreateAccount(c.Request.Context(), store, input)
		if err != nil {
			respondAccountWriteError(c, err)
			return
		}
		// 注册接口对外仍返回不含密码哈希的精简 DTO
		c.JSON(http.StatusCreated, model.PublicAccountDTO{
			ID:        a.ID,
			Username:  a.Username,
			Email:     a.Email,
			Provider:  a.Provider,
			CreatedAt: a.CreatedAt,
		})
	}
}

// LoginAccountHandler POST /api/accounts/login
// 前台登录（不需要 X-Internal-Secret）。保留用于向后兼容；新端点 login-with-session 由 UserAuthHandler 提供。
func LoginAccountHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input model.AccountLoginInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		a, err := service.VerifyAccount(c.Request.Context(), store, input)
		if err != nil {
			if errors.Is(err, service.ErrInvalidCredentials) {
				// 凭据错误：统一 401 固定文案，不透出内部细节
				c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
				return
			}
			// 其余视为服务端内部错误：只进日志，对外返回通用文案
			log.Printf("account login internal error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
			return
		}
		c.JSON(http.StatusOK, model.PublicAccountDTO{
			ID:        a.ID,
			Username:  a.Username,
			Email:     a.Email,
			Provider:  a.Provider,
			CreatedAt: a.CreatedAt,
		})
	}
}

// CreateAccountAdminHandler POST /api/admin/accounts
// 管理端创建前台账户（需要 X-Internal-Secret）。返回完整 Account（密码哈希通过 json:"-" 屏蔽）
func CreateAccountAdminHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input model.AccountCreateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		a, err := service.CreateAccount(c.Request.Context(), store, input)
		if err != nil {
			respondAccountWriteError(c, err)
			return
		}
		c.JSON(http.StatusCreated, a)
	}
}

// UpdateAccountHandler PUT /api/admin/accounts/:id
// 更新前台账户基本信息（用户名 / email）。OAuth 账户改 username 会被拒绝。
func UpdateAccountHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var input model.AccountUpdateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		a, err := service.UpdateAccount(c.Request.Context(), store, id, input)
		if err != nil {
			if errors.Is(err, repository.ErrAccountNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "账户不存在"})
				return
			}
			respondAccountWriteError(c, err)
			return
		}
		c.JSON(http.StatusOK, a)
	}
}

// UpdateAccountPasswordHandler PUT /api/admin/accounts/:id/password
func UpdateAccountPasswordHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var body struct {
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
			return
		}
		if err := service.UpdateAccountPassword(c.Request.Context(), store, id, body.Password); err != nil {
			if errors.Is(err, repository.ErrAccountNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "账户不存在"})
				return
			}
			if errors.Is(err, service.ErrPasswordTooShort) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "密码长度不能少于 6 位"})
				return
			}
			log.Printf("update account password internal error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "操作失败，请稍后重试"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// DeleteAccountHandler DELETE /api/admin/accounts/:id
func DeleteAccountHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := service.DeleteAccount(c.Request.Context(), store, id); err != nil {
			if errors.Is(err, repository.ErrAccountNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "账户不存在"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
