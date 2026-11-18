package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"mahirofox-blog/backend-go/internal/auth"
	"mahirofox-blog/backend-go/internal/repository"
)

// 鉴权上下文键。下游 handler 可通过 c.Get(CtxKeyUserID) 等取用。
const (
	CtxKeyUserID    = "userId"
	CtxKeyUsername  = "username"
	CtxKeyRole      = "role"
	CtxKeySessionID = "sessionId"
)

// RequireInternalSecret 校验 X-Internal-Secret 头。
// 改造后只承担"网络层身份确认"：确认请求来自同机 Next.js 转发，
// 不再承担用户授权——用户授权由 RequireSession + RequirePermission 完成。
func RequireInternalSecret(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		provided := c.GetHeader("X-Internal-Secret")
		if !secretMatches(secret, provided) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
			return
		}
		c.Next()
	}
}

func secretMatches(secret, provided string) bool {
	if secret == "" || len(secret) != len(provided) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(secret), []byte(provided)) == 1
}

// AllowAnonymous 显式声明此路由无需登录态。
// 用于公开读接口（GET /api/movies 等），从"漏掉守卫"改为"显式声明匿名"，
// 避免后续误把新加的公开接口挂在需鉴权的 group 下。
func AllowAnonymous() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

// RequireSession 从 Authorization: Bearer <token> 解析 admin JWT，
// 并校验 admin_sessions 中仍存在未过期会话（登出/踢下线/改密后立即失效）。
// role 以数据库中的最新值为准，避免 JWT 内的旧角色继续生效。
// fail-closed：无合法 token 或会话已失效直接 401。
func RequireSession(store repository.Store, secret, adminIssuer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerToken(c)
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		claims, err := auth.VerifyAdmin(token, []byte(secret), adminIssuer)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "登录已过期"})
			return
		}
		session, err := store.GetAdminSessionByToken(c.Request.Context(), token)
		if err != nil || session.AdminUserID != claims.UserID || session.ExpiresAt.Before(time.Now()) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "会话已失效，请重新登录"})
			return
		}
		user, err := store.GetAdminUserByID(c.Request.Context(), session.AdminUserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "用户不存在或已被删除"})
			return
		}
		c.Set(CtxKeyUserID, user.ID)
		c.Set(CtxKeyUsername, user.Username)
		c.Set(CtxKeyRole, string(user.Role))
		c.Set(CtxKeySessionID, session.SessionID)
		c.Next()
	}
}

// RequireUserSession 前台用户会话守卫：解析 user JWT（issuer 与后台隔离），
// 并校验 user_sessions 中的会话仍然存在且未过期。
// 这样登出、重置密码、单设备登录清理会话后，旧 token 立即失效。
func RequireUserSession(store repository.Store, secret, userIssuer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerToken(c)
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		claims, err := auth.VerifyUser(token, []byte(secret), userIssuer)
		if err != nil || claims.AccountID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "登录已过期"})
			return
		}
		session, err := store.GetUserSessionByToken(c.Request.Context(), token)
		if err != nil || session.AccountID != claims.AccountID || session.ExpiresAt.Before(time.Now()) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "会话已失效，请重新登录"})
			return
		}
		c.Set(CtxKeyUserID, claims.AccountID)
		c.Set(CtxKeyUsername, claims.Username)
		c.Set(CtxKeySessionID, claims.SessionID)
		c.Next()
	}
}

// RequirePermission fail-closed：必须先经过 RequireSession 写入 role；
// 若无 role，直接 401（说明未登录或 RequireSession 未挂）；否则查 DB 鉴权。
// 不信任任何上游明文头（如 X-User-Permissions）。
// 支持两种权限格式：精确匹配（"movies:update"）与全权限通配（"*"，super_admin）。
func RequirePermission(store repository.Store, perm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get(CtxKeyRole)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		role, _ := roleVal.(string)
		if role == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		rp, err := store.GetRolePermissions(c.Request.Context(), role)
		if err != nil || rp == nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "无权限"})
			return
		}
		if !hasPermission(rp.Permissions, perm) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "无权限"})
			return
		}
		c.Next()
	}
}

// HasPermission 供 handler 做二次鉴权（例如：创建/修改后台用户角色时额外要求
// users:updateRole，防止仅有 users:create / users:update 的角色自行提权）。
// 必须先经过 RequireSession；role 缺失或查库失败一律视为无权限（fail-closed）。
func HasPermission(c *gin.Context, store repository.Store, perm string) bool {
	role := c.GetString(CtxKeyRole)
	if role == "" {
		return false
	}
	rp, err := store.GetRolePermissions(c.Request.Context(), role)
	if err != nil || rp == nil {
		return false
	}
	return hasPermission(rp.Permissions, perm)
}

// extractBearerToken 从 Authorization: Bearer <token> 提取 token
func extractBearerToken(c *gin.Context) string {
	authz := c.GetHeader("Authorization")
	if authz == "" {
		return ""
	}
	if !strings.HasPrefix(authz, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(authz, "Bearer "))
}

// hasPermission 检查权限列表是否包含目标权限。
// 支持 "*" 全权限通配（super_admin），其余走精确匹配。
func hasPermission(perms []string, target string) bool {
	for _, p := range perms {
		if p == "*" || p == target {
			return true
		}
	}
	return false
}
