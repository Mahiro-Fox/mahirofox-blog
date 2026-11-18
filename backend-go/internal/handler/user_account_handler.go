// Package handler
// user_account_handler.go：前台账户自服务接口（账户设置页 / 忘记密码）。
// 均要求 RequireInternalSecret + RequireUserSession（重置密码仅内部密钥）。
package handler

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/middleware"
	"mahirofox-blog/backend-go/internal/repository"
	"mahirofox-blog/backend-go/internal/service"
)

// respondAccountError 把账户自服务的哨兵错误映射为稳定 HTTP 状态码 + 机器码，
// 便于 Next 侧直接按 code 选择文案。
func respondAccountError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrAccountNotFound), errors.Is(err, service.ErrEmailNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "账户不存在", "code": "ACCOUNT_NOT_FOUND"})
	case errors.Is(err, service.ErrCurrentPasswordInvalid):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "当前密码错误", "code": "CURRENT_PASSWORD_INVALID"})
	case errors.Is(err, service.ErrPasswordRequired):
		c.JSON(http.StatusConflict, gin.H{"error": "请先设置密码再解绑 Google", "code": "PASSWORD_REQUIRED"})
	case errors.Is(err, service.ErrPasswordNotSet):
		c.JSON(http.StatusConflict, gin.H{"error": "该账户尚未设置密码", "code": "PASSWORD_NOT_SET"})
	case errors.Is(err, service.ErrGoogleAlreadyLinked):
		c.JSON(http.StatusConflict, gin.H{"error": "该 Google 账号已绑定其他账户", "code": "GOOGLE_ALREADY_LINKED"})
	case errors.Is(err, service.ErrGoogleEmailBound):
		c.JSON(http.StatusConflict, gin.H{"error": "当前账户已绑定其他 Google 账号", "code": "GOOGLE_ALREADY_LINKED"})
	case errors.Is(err, service.ErrGoogleNotLinked):
		c.JSON(http.StatusConflict, gin.H{"error": "当前账户未绑定 Google", "code": "GOOGLE_NOT_LINKED"})
	case errors.Is(err, service.ErrGoogleIdentityInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Google 身份信息不完整", "code": "GOOGLE_IDENTITY_INVALID"})
	default:
		log.Printf("user account internal error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "ACCOUNT_UPDATE_FAILED"})
	}
}

// GetUserAccountHandler GET /api/user/account
func GetUserAccountHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		accountID, _ := c.Get(middleware.CtxKeyUserID)
		dto, err := service.GetAccountSecurity(c.Request.Context(), store, accountID.(string))
		if err != nil {
			respondAccountError(c, err)
			return
		}
		c.JSON(http.StatusOK, dto)
	}
}

// UpdateUserPasswordHandler PUT /api/user/account/password
// 已有密码需提供 currentPassword；Google 新账户可直接设置。
func UpdateUserPasswordHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		accountID, _ := c.Get(middleware.CtxKeyUserID)
		var body struct {
			CurrentPassword string `json:"currentPassword"`
			NewPassword     string `json:"newPassword" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误", "code": "INVALID_PARAMS"})
			return
		}
		if err := service.SetAccountPassword(c.Request.Context(), store, accountID.(string), body.CurrentPassword, body.NewPassword); err != nil {
			respondAccountError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// LinkUserGoogleHandler POST /api/user/account/google/link
// 入参仅 sub：Google 身份已由 Next 侧用 OAuth code 换取并校验。
func LinkUserGoogleHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		accountID, _ := c.Get(middleware.CtxKeyUserID)
		var body struct {
			Sub string `json:"sub" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误", "code": "INVALID_PARAMS"})
			return
		}
		if err := service.LinkGoogleAccount(c.Request.Context(), store, accountID.(string), body.Sub); err != nil {
			respondAccountError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// UnlinkUserGoogleHandler DELETE /api/user/account/google
func UnlinkUserGoogleHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		accountID, _ := c.Get(middleware.CtxKeyUserID)
		if err := service.UnlinkGoogleAccount(c.Request.Context(), store, accountID.(string)); err != nil {
			respondAccountError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// ResetUserPasswordHandler POST /api/user/account/password/reset
// 仅内部调用：Next 侧已校验邮箱验证码后，用邮箱定位账户并重置密码。
func ResetUserPasswordHandler(store repository.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Email    string `json:"email" binding:"required,email"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误", "code": "INVALID_PARAMS"})
			return
		}
		if err := service.ResetAccountPasswordByEmail(c.Request.Context(), store, body.Email, body.Password); err != nil {
			respondAccountError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}
