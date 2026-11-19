// 认证和安全常量

/**
 * 后台用户会话 Cookie 名。
 *
 * 前后端共用同一个名字；Go 侧只校验 JWT、不读写 Cookie，因此这里固定为常量。
 * 历史环境变量 ADMIN_COOKIE_NAME / USER_COOKIE_NAME 从未被 compose 注入，
 * 实际一直走默认值，已移除，避免“看起来可配置、实际不生效”。
 */
export const ADMIN_SESSION_COOKIE = 'admin-session';

/** 前台用户会话 Cookie 名 */
export const USER_SESSION_COOKIE = 'user-session';

/**
 * 会话过期时间（秒）—— 用于 cookie maxAge；真正的 token 过期由 backend-go 签发决定
 */
export const SESSION_EXPIRY = 24 * 60 * 60;

/**
 * 会话最大年龄（毫秒）
 */
export const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
