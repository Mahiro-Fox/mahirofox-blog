// Package service
// user_auth_service.go：前台访客账户 登录/鉴权/登出（与 admin_auth 对称，但校验来源是 accounts）
package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"mahirofox-blog/backend-go/internal/auth"
	"mahirofox-blog/backend-go/internal/config"
	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
)

// UserLoginResult 前台登录返回
type UserLoginResult struct {
	Token      string                 `json:"token"`
	SessionID  string                 `json:"sessionId"`
	ExpiresIn  int                    `json:"expiresIn"`
	Account    model.PublicAccountDTO `json:"account"`
	LoggedInAt string                 `json:"loggedInAt"`
}

// UserVerifyResult 前台鉴权返回（对齐 Next user-auth.ts verifyUserAuth）
type UserVerifyResult struct {
	Success          bool   `json:"success"`
	Error            string `json:"error,omitempty"`
	AccountID        string `json:"accountId,omitempty"`
	Username         string `json:"username,omitempty"`
	Email            string `json:"email,omitempty"`
	HasPassword      bool   `json:"hasPassword"`
	GoogleLinked     bool   `json:"googleLinked"`
	LoggedInAt       string `json:"loggedInAt,omitempty"`
	ExpiresAt        int64  `json:"expiresAt,omitempty"`
	SessionID        string `json:"sessionId,omitempty"`
	RecoveredSession bool   `json:"recoveredSession,omitempty"`
}

// UserLogin 前台登录：username/email + password → 查 accounts → bcrypt → 删旧会话 → 签发 JWT → 写会话
// 支持用 username 或 email 登录（先按 username 查，查不到再按 email 查，和 Next 保持一致）
func UserLogin(ctx context.Context, store repository.Store, cfg *config.Config, username, password string) (*UserLoginResult, error) {
	if cfg.JWTSecret == "" {
		return nil, errors.New("服务端 JWT_SECRET 未配置")
	}
	if strings.TrimSpace(username) == "" {
		return nil, errors.New("请输入用户名或邮箱")
	}
	a, err := store.GetAccountByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			a, err = store.GetAccountByEmail(ctx, username)
		}
		if err != nil {
			if errors.Is(err, repository.ErrAccountNotFound) {
				return nil, fmt.Errorf("%w", ErrInvalidCredentials)
			}
			return nil, fmt.Errorf("查账户失败: %w", err)
		}
	}
	if a.PasswordHash == "" {
		return nil, fmt.Errorf("%w", ErrPasswordNotSet)
	}
	if !verifyPassword(ctx, password, a.PasswordHash) {
		return nil, fmt.Errorf("%w", ErrInvalidCredentials)
	}
	return issueUserSession(ctx, store, cfg, a)
}

// issueUserSession 清理该账户旧会话 → 签发 JWT → 写入 user_sessions。
// 密码登录与 Google 登录共用，保证两种入口的会话行为一致。
func issueUserSession(ctx context.Context, store repository.Store, cfg *config.Config, a *model.Account) (*UserLoginResult, error) {
	now := time.Now()
	sessionID := auth.NewSessionID()
	secret := []byte(cfg.JWTSecret)
	if _, e := store.DeleteUserSessionsByAccountID(ctx, a.ID); e != nil {
		return nil, fmt.Errorf("清理旧会话失败: %w", e)
	}
	token, err := auth.SignUser(
		secret, cfg.UserIssuer, cfg.SessionTTLSeconds,
		a.ID, a.Username, a.Email, sessionID, now,
	)
	if err != nil {
		return nil, fmt.Errorf("签发 JWT 失败: %w", err)
	}
	session := &model.UserSession{
		Token:      token,
		AccountID:  a.ID,
		SessionID:  sessionID,
		CreatedAt:  now,
		LastUsedAt: now,
		ExpiresAt:  now.Add(time.Duration(cfg.SessionTTLSeconds) * time.Second),
		UserAgent:  "",
		IP:         "",
	}
	if e := store.CreateUserSession(ctx, session); e != nil {
		return nil, fmt.Errorf("写入会话失败: %w", e)
	}
	return &UserLoginResult{
		Token:      token,
		SessionID:  sessionID,
		ExpiresIn:  cfg.SessionTTLSeconds,
		Account:    toPublicAccountDTO(a),
		LoggedInAt: now.UTC().Format(time.RFC3339),
	}, nil
}

// toPublicAccountDTO 统一构造对外账户信息：显式暴露登录方式状态，
// 避免前端用 provider 推断（自动绑定后 provider 仍可能是 credentials）。
func toPublicAccountDTO(a *model.Account) model.PublicAccountDTO {
	return model.PublicAccountDTO{
		ID:           a.ID,
		Username:     a.Username,
		Email:        a.Email,
		Provider:     a.Provider,
		HasPassword:  a.PasswordHash != "",
		GoogleLinked: a.GoogleSub != nil && *a.GoogleSub != "",
		CreatedAt:    a.CreatedAt,
	}
}

// UserVerify 前台鉴权：JWT 校验 → 查会话（必要时恢复）→ 更新 last_used_at → 返回最新账户信息
func UserVerify(ctx context.Context, store repository.Store, cfg *config.Config, token string) (*UserVerifyResult, error) {
	if strings.TrimSpace(token) == "" || cfg.JWTSecret == "" {
		return &UserVerifyResult{Success: false, Error: "未登录"}, nil
	}
	secret := []byte(cfg.JWTSecret)
	claims, parseErr := auth.VerifyUser(token, secret, cfg.UserIssuer)
	if parseErr != nil {
		return &UserVerifyResult{Success: false, Error: "登录已过期，请重新登录"}, nil
	}

	session, sessErr := store.GetUserSessionByToken(ctx, token)
	if sessErr != nil && !errors.Is(sessErr, repository.ErrUserSessionNotFound) {
		return nil, fmt.Errorf("查 user session 失败: %w", sessErr)
	}
	recovered := false
	if session == nil && cfg.SessionAutoRecover {
		if claims.AccountID == "" || claims.SessionID == "" {
			return &UserVerifyResult{Success: false, Error: "会话已在其他设备上失效，请重新登录"}, nil
		}
		// 恢复会话：JWT 合法但 PG 中无会话，按 JWT 声明重建。
		// 账户是否存在由下方 GetAccountByID 统一校验，这里不做冗余预查。
		if e := store.CreateUserSession(ctx, &model.UserSession{
			Token:      token,
			AccountID:  claims.AccountID,
			SessionID:  claims.SessionID,
			CreatedAt:  time.Now(),
			LastUsedAt: time.Now(),
			ExpiresAt:  time.Unix(claims.ExpiresAtUnix(), 0),
		}); e != nil {
			log.Printf("user session 恢复失败: %v", e)
		} else {
			recovered = true
			if s, e := store.GetUserSessionByToken(ctx, token); e == nil {
				session = s
			}
		}
	}
	if session == nil {
		return &UserVerifyResult{Success: false, Error: "会话已在其他设备上失效，请重新登录"}, nil
	}

	if e := store.UpdateUserSessionLastUsedAt(ctx, token, time.Now()); e != nil {
		log.Printf("更新 user session last_used_at 失败: %v", e)
	}

	a, aErr := store.GetAccountByID(ctx, session.AccountID)
	if aErr != nil {
		if errors.Is(aErr, repository.ErrAccountNotFound) {
			return &UserVerifyResult{Success: false, Error: "账户不存在或已被删除"}, nil
		}
		return nil, fmt.Errorf("查 account 失败: %w", aErr)
	}
	return &UserVerifyResult{
		Success:          true,
		AccountID:        a.ID,
		Username:         a.Username,
		Email:            a.Email,
		HasPassword:      a.PasswordHash != "",
		GoogleLinked:     a.GoogleSub != nil && *a.GoogleSub != "",
		LoggedInAt:       claims.LoggedInAt,
		ExpiresAt:        claims.ExpiresAtUnix(),
		SessionID:        session.SessionID,
		RecoveredSession: recovered,
	}, nil
}

// UserLogout 前台登出：删除 user_sessions.token
func UserLogout(ctx context.Context, store repository.Store, token string) error {
	if strings.TrimSpace(token) == "" {
		return nil
	}
	err := store.DeleteUserSessionByToken(ctx, token)
	if err != nil && errors.Is(err, repository.ErrUserSessionNotFound) {
		return nil
	}
	return err
}

// UserLoginWithGoogle Google 登录：按 sub 查账户 → 按邮箱绑定/复用 → 新用户创建 → 签发会话。
// 前提：身份已由 Next 侧用 OAuth code 向 Google 换取并经 userinfo 校验（邮箱已验证）。
func UserLoginWithGoogle(ctx context.Context, store repository.Store, cfg *config.Config, input model.GoogleLoginInput) (*UserLoginResult, error) {
	if cfg.JWTSecret == "" {
		return nil, errors.New("服务端 JWT_SECRET 未配置")
	}
	sub := strings.TrimSpace(input.Sub)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if sub == "" || email == "" {
		return nil, ErrGoogleIdentityInvalid
	}
	if !input.EmailVerified {
		return nil, ErrGoogleEmailUnverified
	}

	// 1) 已绑定的 Google 账户：直接登录
	a, err := store.GetAccountByGoogleSub(ctx, sub)
	if err == nil {
		return issueUserSession(ctx, store, cfg, a)
	}
	if !errors.Is(err, repository.ErrAccountNotFound) {
		return nil, fmt.Errorf("查 Google 账户失败: %w", err)
	}

	// 2) 同邮箱已有账户
	a, err = store.GetAccountByEmail(ctx, email)
	if err == nil {
		if a.GoogleSub != nil && *a.GoogleSub != sub {
			return nil, ErrGoogleEmailBound
		}
		if a.GoogleSub == nil {
			// 已有密码的本地账户不静默绑定：避免仅凭邮箱就改变既有账户的登录方式。
			// 用户需先用密码登录，再到账户设置页主动关联 Google。
			if a.PasswordHash != "" {
				return nil, ErrGoogleLinkRequired
			}
			now := time.Now()
			subCopy := sub
			if e := store.UpdateAccount(ctx, a.ID, &model.AccountPatch{
				GoogleSub:   &subCopy,
				LastUpdated: &now,
			}); e != nil {
				return nil, fmt.Errorf("绑定 Google 账户失败: %w", e)
			}
		}
		return issueUserSession(ctx, store, cfg, a)
	}
	if !errors.Is(err, repository.ErrAccountNotFound) {
		return nil, fmt.Errorf("查邮箱账户失败: %w", err)
	}

	// 3) 新用户：生成唯一用户名并创建 Google 账户
	username, err := uniqueUsername(ctx, store, googleUsernameBase(email, input.Name, sub))
	if err != nil {
		return nil, err
	}
	now := time.Now()
	created := &model.Account{
		ID:           uuid.NewString(),
		Username:     username,
		Email:        email,
		Provider:     model.AccountProviderGoogle,
		PasswordHash: "",
		GoogleSub:    &sub,
		CreatedAt:    now,
		LastUpdated:  now,
	}
	if e := store.CreateAccount(ctx, created); e != nil {
		return nil, e
	}
	return issueUserSession(ctx, store, cfg, created)
}

// googleUsernameBase 由 Google 资料推导用户名基底：仅保留小写字母/数字/_/-，最长 20 位。
// 中文等字符会被过滤，此时退回 email 本地部分或 "google-<sub 前缀>"。
func googleUsernameBase(email, name, sub string) string {
	base := strings.ToLower(strings.TrimSpace(name))
	if base == "" {
		if idx := strings.Index(email, "@"); idx > 0 {
			base = email[:idx]
		}
	}
	var b strings.Builder
	for _, r := range strings.ToLower(base) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		}
		if b.Len() >= 20 {
			break
		}
	}
	if b.Len() > 0 {
		return b.String()
	}
	suffix := sub
	if len(suffix) > 6 {
		suffix = suffix[:6]
	}
	return "google-" + suffix
}

// uniqueUsername 在基底冲突时追加随机后缀（最多 5 次），保证 username 全局唯一。
func uniqueUsername(ctx context.Context, store repository.Store, base string) (string, error) {
	for i := 0; i < 5; i++ {
		candidate := base
		if i > 0 {
			stem := base
			if len(stem) > 14 {
				stem = stem[:14]
			}
			candidate = fmt.Sprintf("%s-%s", stem, uuid.NewString()[:4])
		}
		_, err := store.GetAccountByUsername(ctx, candidate)
		if errors.Is(err, repository.ErrAccountNotFound) {
			return candidate, nil
		}
		if err != nil {
			return "", fmt.Errorf("校验用户名失败: %w", err)
		}
	}
	return "", errors.New("生成用户名失败，请重试")
}

// CleanupExpiredUserSessions 定时清理过期 user_sessions
func CleanupExpiredUserSessions(ctx context.Context, store repository.Store, now time.Time) (int64, error) {
	return store.DeleteExpiredUserSessions(ctx, now)
}
