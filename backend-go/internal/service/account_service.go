package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"mahirofox-blog/backend-go/internal/model"
	"mahirofox-blog/backend-go/internal/repository"
)

// ListAccounts 列出全部前台账户
func ListAccounts(ctx context.Context, store repository.Store) ([]model.Account, error) {
	return store.ListAccounts(ctx)
}

// GetAccount 按 ID 查询
func GetAccount(ctx context.Context, store repository.Store, id string) (*model.Account, error) {
	return store.GetAccountByID(ctx, id)
}

// GetAccountByUsername 按用户名查询
func GetAccountByUsername(ctx context.Context, store repository.Store, username string) (*model.Account, error) {
	return store.GetAccountByUsername(ctx, username)
}

// GetAccountByEmail 按 email 查询（空 string 直接返回 NotFound）
func GetAccountByEmail(ctx context.Context, store repository.Store, email string) (*model.Account, error) {
	return store.GetAccountByEmail(ctx, email)
}

// CreateAccount 创建前台账户（密码会被 bcrypt hash；username / email 均必填且全局唯一）
func CreateAccount(ctx context.Context, store repository.Store, input model.AccountCreateInput) (*model.Account, error) {
	username := strings.TrimSpace(input.Username)
	email := strings.TrimSpace(input.Email)
	if username == "" {
		return nil, errors.New("用户名不能为空")
	}
	if email == "" {
		return nil, errors.New("邮箱不能为空")
	}
	if len(input.Password) < 6 {
		return nil, errors.New("密码长度不能少于 6 位")
	}

	// 用户名唯一性检查
	if _, err := store.GetAccountByUsername(ctx, username); err == nil {
		return nil, repository.ErrAccountUsernameTaken
	} else if !errors.Is(err, repository.ErrAccountNotFound) {
		return nil, err
	}

	// 邮箱唯一性检查
	if _, err := store.GetAccountByEmail(ctx, email); err == nil {
		return nil, repository.ErrAccountEmailTaken
	} else if !errors.Is(err, repository.ErrAccountNotFound) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("密码加密失败")
	}

	now := time.Now()
	a := model.Account{
		ID:           uuid.NewString(),
		Username:     username,
		Email:        email,
		Provider:     model.AccountProviderCredentials,
		PasswordHash: string(hash),
		CreatedAt:    now,
		LastUpdated:  now,
	}
	if err := store.CreateAccount(ctx, &a); err != nil {
		return nil, err
	}
	return &a, nil
}

// VerifyAccount 校验用户名密码（登录用）
func VerifyAccount(ctx context.Context, store repository.Store, input model.AccountLoginInput) (*model.Account, error) {
	a, err := store.GetAccountByUsername(ctx, input.Username)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			return nil, fmt.Errorf("%w", ErrInvalidCredentials)
		}
		return nil, err
	}
	// 兼容弃用的 Google 账户：password_hash 为空时直接失败
	if a.PasswordHash == "" {
		return nil, fmt.Errorf("%w", ErrInvalidCredentials)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(a.PasswordHash), []byte(input.Password)); err != nil {
		return nil, fmt.Errorf("%w", ErrInvalidCredentials)
	}
	return a, nil
}

// UpdateAccount 更新前台账户基本信息（用户名 / email）
// - username 不能为空，且需全局唯一（排除自身）
// - email 允许置空（nil）；非空时需全局唯一（排除自身）
// - OAuth 账户（provider != credentials）不允许改 username，避免与第三方身份脱钩
func UpdateAccount(ctx context.Context, store repository.Store, id string, input model.AccountUpdateInput) (*model.Account, error) {
	a, err := store.GetAccountByID(ctx, id)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	patch := &model.AccountPatch{LastUpdated: &now}

	// username 校验
	if input.Username != nil {
		trimmed := strings.TrimSpace(*input.Username)
		if trimmed == "" {
			return nil, errors.New("用户名不能为空")
		}
		if a.Provider != model.AccountProviderCredentials {
			return nil, errors.New("OAuth 账户不支持修改用户名")
		}
		if trimmed != a.Username {
			existing, lookupErr := store.GetAccountByUsername(ctx, trimmed)
			if lookupErr == nil && existing.ID != a.ID {
				return nil, repository.ErrAccountUsernameTaken
			}
			if lookupErr != nil && !errors.Is(lookupErr, repository.ErrAccountNotFound) {
				return nil, lookupErr
			}
			patch.Username = &trimmed
		}
	}

	// email 校验（必填，不允许清空；非空时需全局唯一，排除自身）
	if input.Email != nil {
		trimmed := strings.TrimSpace(*input.Email)
		if trimmed == "" {
			return nil, errors.New("邮箱不能为空")
		}
		if trimmed != a.Email {
			existing, lookupErr := store.GetAccountByEmail(ctx, trimmed)
			if lookupErr == nil && existing.ID != a.ID {
				return nil, repository.ErrAccountEmailTaken
			}
			if lookupErr != nil && !errors.Is(lookupErr, repository.ErrAccountNotFound) {
				return nil, lookupErr
			}
			patch.Email = &trimmed
		}
	}

	if err := store.UpdateAccount(ctx, id, patch); err != nil {
		return nil, err
	}
	return store.GetAccountByID(ctx, id)
}

// UpdateAccountPassword 更新前台账户密码
func UpdateAccountPassword(ctx context.Context, store repository.Store, id, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("密码长度不能少于 6 位")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}
	now := time.Now()
	hashStr := string(hash)
	return store.UpdateAccount(ctx, id, &model.AccountPatch{
		PasswordHash: &hashStr,
		LastUpdated:  &now,
	})
}

// DeleteAccount 删除前台账户
func DeleteAccount(ctx context.Context, store repository.Store, id string) error {
	return store.DeleteAccount(ctx, id)
}

// GetAccountSecurity 当前登录账户的对外信息（含 hasPassword / googleLinked）。
func GetAccountSecurity(ctx context.Context, store repository.Store, accountID string) (*model.PublicAccountDTO, error) {
	a, err := store.GetAccountByID(ctx, accountID)
	if err != nil {
		return nil, err
	}
	dto := toPublicAccountDTO(a)
	return &dto, nil
}

// SetAccountPassword 登录态下设置/修改密码。
// - 已设置密码：必须校验当前密码，防止会话被盗后直接改密
// - 未设置密码（Google 登录创建）：凭有效登录态直接设置，完成两种登录方式打通
func SetAccountPassword(ctx context.Context, store repository.Store, accountID, currentPassword, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("密码长度不能少于 6 位")
	}
	a, err := store.GetAccountByID(ctx, accountID)
	if err != nil {
		return err
	}
	if a.PasswordHash != "" && !verifyPassword(ctx, currentPassword, a.PasswordHash) {
		return ErrCurrentPasswordInvalid
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}
	now := time.Now()
	hashStr := string(hash)
	return store.UpdateAccount(ctx, accountID, &model.AccountPatch{
		PasswordHash: &hashStr,
		LastUpdated:  &now,
	})
}

// ResetAccountPasswordByEmail 邮箱验证码校验通过后重置密码（由 Next 内部调用）。
// 重置成功后清理该账户全部会话，强制各端重新登录。
func ResetAccountPasswordByEmail(ctx context.Context, store repository.Store, email, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("密码长度不能少于 6 位")
	}
	a, err := store.GetAccountByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			return ErrEmailNotFound
		}
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}
	now := time.Now()
	hashStr := string(hash)
	if err := store.UpdateAccount(ctx, a.ID, &model.AccountPatch{
		PasswordHash: &hashStr,
		LastUpdated:  &now,
	}); err != nil {
		return err
	}
	if _, err := store.DeleteUserSessionsByAccountID(ctx, a.ID); err != nil {
		return fmt.Errorf("清理旧会话失败: %w", err)
	}
	return nil
}

// LinkGoogleAccount 把 Google sub 绑定到当前登录账户。
// sub 已属于其他账户时拒绝；当前账户已绑定其他 Google 时同样拒绝。
func LinkGoogleAccount(ctx context.Context, store repository.Store, accountID, sub string) error {
	sub = strings.TrimSpace(sub)
	if sub == "" {
		return ErrGoogleIdentityInvalid
	}
	existing, err := store.GetAccountByGoogleSub(ctx, sub)
	if err == nil && existing.ID != accountID {
		return ErrGoogleAlreadyLinked
	}
	if err != nil && !errors.Is(err, repository.ErrAccountNotFound) {
		return err
	}
	a, err := store.GetAccountByID(ctx, accountID)
	if err != nil {
		return err
	}
	if a.GoogleSub != nil && *a.GoogleSub != "" && *a.GoogleSub != sub {
		return ErrGoogleEmailBound
	}
	now := time.Now()
	subCopy := sub
	return store.UpdateAccount(ctx, accountID, &model.AccountPatch{
		GoogleSub:   &subCopy,
		LastUpdated: &now,
	})
}

// UnlinkGoogleAccount 解绑 Google。必须已设置密码，否则账户会失去唯一登录方式。
func UnlinkGoogleAccount(ctx context.Context, store repository.Store, accountID string) error {
	a, err := store.GetAccountByID(ctx, accountID)
	if err != nil {
		return err
	}
	if a.GoogleSub == nil || *a.GoogleSub == "" {
		return ErrGoogleNotLinked
	}
	if a.PasswordHash == "" {
		return ErrPasswordRequired
	}
	return store.ClearAccountGoogleSub(ctx, accountID)
}
