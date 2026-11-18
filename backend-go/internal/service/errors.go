// ErrInvalidCredentials 用户名或密码错误（登录失败）。
// 携带该哨兵的错误由 handler 统一映射为 401 + 固定文案，绝不把内部细节返回给客户端；
// 其余未被识别为哨兵的错误视为服务端内部错误，由 handler 记录日志并返回 500。
package service

import "errors"

var ErrInvalidCredentials = errors.New("invalid credentials")

// Google 登录相关哨兵错误（handler 映射为明确状态码，便于 Next 侧给出对应文案）。
var (
	// ErrGoogleIdentityInvalid Google 身份信息不完整
	ErrGoogleIdentityInvalid = errors.New("google identity invalid")
	// ErrGoogleEmailUnverified Google 邮箱未经验证
	ErrGoogleEmailUnverified = errors.New("google email unverified")
	// ErrGoogleEmailBound 该邮箱已绑定其他 Google 账号
	ErrGoogleEmailBound = errors.New("google email bound to another google account")
	// ErrGoogleLinkRequired 同邮箱的本地密码账户需要先用密码登录，再在设置页关联 Google
	ErrGoogleLinkRequired = errors.New("google link required")
	// ErrGoogleAlreadyLinked 该 Google 账号已绑定其他账户
	ErrGoogleAlreadyLinked = errors.New("google already linked to another account")
	// ErrGoogleNotLinked 当前账户未绑定 Google
	ErrGoogleNotLinked = errors.New("google not linked")
	// ErrPasswordNotSet 账户未设置密码（通常由 Google 登录创建）
	ErrPasswordNotSet = errors.New("password not set")
	// ErrPasswordRequired 解绑 Google 前必须先设置密码
	ErrPasswordRequired = errors.New("password required before unlinking google")
	// ErrCurrentPasswordInvalid 当前密码错误
	ErrCurrentPasswordInvalid = errors.New("current password invalid")
	// ErrEmailNotFound 邮箱对应的账户不存在
	ErrEmailNotFound = errors.New("email not found")
	// ErrPasswordTooShort 密码长度不足
	ErrPasswordTooShort = errors.New("password too short")
	// ErrInvalidAccountInput 账户输入的领域校验错误（消息可直接展示给用户）
	ErrInvalidAccountInput = errors.New("invalid account input")
	// ErrAdminUsernameTaken 后台用户名已被占用
	ErrAdminUsernameTaken = errors.New("admin username taken")
	// ErrAdminRoleInvalid 后台用户角色非法
	ErrAdminRoleInvalid = errors.New("admin role invalid")
)
