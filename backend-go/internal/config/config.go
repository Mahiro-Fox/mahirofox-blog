package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

// Config 服务配置（纯数据结构，无方法）
type Config struct {
	HTTPPort       string
	DBHost         string
	DBPort         int
	DBUser         string
	DBPassword     string
	DBName         string
	InternalSecret string
	DataDir        string
	// 登录 & JWT
	JWTSecret         string
	SessionTTLSeconds int
	AdminIssuer       string
	UserIssuer        string
	// 会话降级：JWT 验签通过但 PG 表里不存在 session 时是否自动恢复（避免上线瞬间全员重登）
	SessionAutoRecover bool
}

// requiredKeys 服务启动必须提供的环境变量；缺任一项直接返回错误，不使用任何默认值
var requiredKeys = []string{
	"HTTP_PORT",
	"DB_HOST",
	"DB_PORT",
	"DB_USER",
	"DB_PASSWORD",
	"DB_NAME",
	"GO_API_SHARED_SECRET",
	"JWT_SECRET",
	"DATA_DIR",
	"SESSION_TTL_SECONDS",
	"ADMIN_ISSUER",
	"USER_ISSUER",
}

// LoadFromEnv 从环境变量加载配置；必填缺失一次性报全，可选缺失只告警
func LoadFromEnv() (*Config, error) {
	if missing := missingKeys(requiredKeys); len(missing) > 0 {
		return nil, fmt.Errorf("缺少必填环境变量：%s", strings.Join(missing, ", "))
	}

	dbPort, err := strconv.Atoi(envValue("DB_PORT"))
	if err != nil {
		return nil, fmt.Errorf("DB_PORT 不是合法整数：%w", err)
	}
	ttl, err := strconv.Atoi(envValue("SESSION_TTL_SECONDS"))
	if err != nil || ttl <= 0 {
		return nil, fmt.Errorf("SESSION_TTL_SECONDS 必须为正整数，当前值：%q", envValue("SESSION_TTL_SECONDS"))
	}
	autoRecover, err := optionalBool("SESSION_AUTO_RECOVER")
	if err != nil {
		return nil, err
	}

	return &Config{
		HTTPPort:           envValue("HTTP_PORT"),
		DBHost:             envValue("DB_HOST"),
		DBPort:             dbPort,
		DBUser:             envValue("DB_USER"),
		DBPassword:         envValue("DB_PASSWORD"),
		DBName:             envValue("DB_NAME"),
		InternalSecret:     envValue("GO_API_SHARED_SECRET"),
		DataDir:            envValue("DATA_DIR"),
		JWTSecret:          envValue("JWT_SECRET"),
		SessionTTLSeconds:  ttl,
		AdminIssuer:        envValue("ADMIN_ISSUER"),
		UserIssuer:         envValue("USER_ISSUER"),
		SessionAutoRecover: autoRecover,
	}, nil
}

// DSN 构建 PostgreSQL 连接字符串（纯函数，接收 Config 指针）
func DSN(c *Config) string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Shanghai",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}

// envValue 读取并去除首尾空白；未配置时返回空串
func envValue(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

// missingKeys 返回未配置（空值）的必填变量名
func missingKeys(keys []string) []string {
	missing := make([]string, 0, len(keys))
	for _, key := range keys {
		if envValue(key) == "" {
			missing = append(missing, key)
		}
	}
	return missing
}

// optionalBool 读取可选布尔开关；未配置时告警并按 false 处理（关闭该特性）
func optionalBool(key string) (bool, error) {
	raw := envValue(key)
	if raw == "" {
		log.Printf("[config] 未配置可选环境变量 %s，已按 false 处理", key)
		return false, nil
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, fmt.Errorf("%s 不是合法布尔值：%q", key, raw)
	}
	return value, nil
}
