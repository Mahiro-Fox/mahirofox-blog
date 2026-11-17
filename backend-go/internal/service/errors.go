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
)