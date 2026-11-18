// Package handler
// user_auth_handler.go：前台用户 auth（/user/auth/login /verify /logout）
package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/config"
	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
	"mahirofox-blog/backend-go/internal/service"
)

// UserLoginHandler 前台登录：返回 {token, account, expiresIn, sessionId, loggedInAt}
func UserLoginHandler(store repository.Store, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cfg == nil || store == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务未初始化"})
			return
		}
		var req model.AccountLoginInput
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
			return
		}
		if strings.TrimSpace(req.Username) == "" || strings.TrimSpace(req.Password) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "用户名/邮箱和密码必填"})
			return
		}
		result, err := service.UserLogin(c.Request.Context(), store, cfg, req.Username, req.Password)
		if err != nil {
			if errors.Is(err, service.ErrInvalidCredentials) {
				// 凭据错误：统一 401 固定文案，不透出内部细节
				c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误", "code": "INVALID_CREDENTIALS"})
				return
			}
			if errors.Is(err, service.ErrPasswordNotSet) {
				// 账户存在但未设置密码（Google 登录创建），前端引导改用 Google 或设置密码
				c.JSON(http.StatusConflict, gin.H{"error": "该账户尚未设置密码", "code": "PASSWORD_NOT_SET"})
				return
			}
			// 其余视为服务端内部错误：只进日志，对外返回通用文案
			log.Printf("user login internal error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token":      result.Token,
			"account":    result.Account,
			"expiresIn":  result.ExpiresIn,
			"sessionId":  result.SessionID,
			"loggedInAt": result.LoggedInAt,
		})
	}
}

// UserGoogleLoginHandler 前台 Google 登录：接收 Next 侧已校验的 Google 身份，签发 user-session 令牌。
// 仅允许内部调用（RequireInternalSecret），因此不再重复校验 Google 凭据。
func UserGoogleLoginHandler(store repository.Store, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cfg == nil || store == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务未初始化"})
			return
		}
		var req model.GoogleLoginInput
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
			return
		}
		result, err := service.UserLoginWithGoogle(c.Request.Context(), store, cfg, req)
		if err != nil {
			switch {
			case errors.Is(err, service.ErrGoogleIdentityInvalid):
				c.JSON(http.StatusBadRequest, gin.H{"error": "Google 身份信息不完整", "code": "GOOGLE_IDENTITY_INVALID"})
			case errors.Is(err, service.ErrGoogleEmailUnverified):
				c.JSON(http.StatusForbidden, gin.H{"error": "Google 邮箱未经验证", "code": "GOOGLE_EMAIL_UNVERIFIED"})
			case errors.Is(err, service.ErrGoogleEmailBound):
				c.JSON(http.StatusConflict, gin.H{"error": "该邮箱已绑定其他 Google 账号", "code": "GOOGLE_EMAIL_TAKEN"})
			case errors.Is(err, service.ErrGoogleLinkRequired):
				c.JSON(http.StatusConflict, gin.H{"error": "请先用密码登录，再到账户设置页关联 Google", "code": "GOOGLE_LINK_REQUIRED"})
			default:
				log.Printf("user google login internal error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token":      result.Token,
			"account":    result.Account,
			"expiresIn":  result.ExpiresIn,
			"sessionId":  result.SessionID,
			"loggedInAt": result.LoggedInAt,
		})
	}
}

// UserVerifyHandler 前台鉴权
func UserVerifyHandler(store repository.Store, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		res, err := service.UserVerify(c.Request.Context(), store, cfg, token)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "鉴权错误"})
			return
		}
		if !res.Success {
			c.JSON(http.StatusOK, gin.H{"success": false, "error": res.Error})
			return
		}
		c.JSON(http.StatusOK, res)
	}
}

// UserLogoutHandler 前台登出
func UserLogoutHandler(store repository.Store, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			c.JSON(http.StatusOK, gin.H{"success": true})
			return
		}
		if err := service.UserLogout(c.Request.Context(), store, token); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "登出失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
