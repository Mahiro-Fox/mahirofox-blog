package db

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"mahirofox-blog/backend-go/internal/config"
)

// NewGormDB 创建并返回 GORM DB 连接（含连接池配置）
func NewGormDB(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(config.DSN(cfg)), &gorm.Config{
		// Warn 只记录慢查询与错误；Info 会把每条 SQL 都打出来，生产环境开销大且噪音高。
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get underlying sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}
