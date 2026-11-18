package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"mahirofox-blog/backend-go/internal/model"
)

// ErrConversationNotFound 会话不存在
var ErrConversationNotFound = errors.New("conversation not found")

// ErrConversationIDConflict 会话 ID 已被其他用户占用
var ErrConversationIDConflict = errors.New("conversation belongs to another user")

// UpsertConversation 按 id 写入会话。
// 已存在时仅更新 title / messages / updated_at，保留 user_id 与 created_at。
// 若已存在记录的 user_id 与入参不一致，拒绝写入（防止跨用户覆盖他人会话）。
func (s *GormStore) UpsertConversation(ctx context.Context, c *model.Conversation) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.Conversation
		err := tx.Select("user_id").Where("id = ?", c.ID).First(&existing).Error
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			if err := tx.Create(c).Error; err != nil {
				return fmt.Errorf("create conversation: %w", err)
			}
			return nil
		case err != nil:
			return fmt.Errorf("load conversation owner: %w", err)
		}
		if existing.UserID != c.UserID {
			return ErrConversationIDConflict
		}
		res := tx.Model(&model.Conversation{}).
			Where("id = ? AND user_id = ?", c.ID, c.UserID).
			Updates(map[string]any{
				"title":      c.Title,
				"messages":   c.Messages,
				"updated_at": c.UpdatedAt,
			})
		if res.Error != nil {
			return fmt.Errorf("update conversation: %w", res.Error)
		}
		return nil
	})
}

// GetConversationByID 按 id 查询某用户的会话
func (s *GormStore) GetConversationByID(ctx context.Context, userID, id string) (*model.Conversation, error) {
	var c model.Conversation
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND id = ?", userID, id).
		First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrConversationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get conversation: %w", err)
	}
	return &c, nil
}

// ListConversationSummariesByUser 按 updated_at 倒序列出某用户的会话摘要
func (s *GormStore) ListConversationSummariesByUser(ctx context.Context, userID string) ([]model.ConversationSummary, error) {
	var items []model.ConversationSummary
	if err := s.db.WithContext(ctx).
		Model(&model.Conversation{}).
		Select("id", "title", "updated_at").
		Where("user_id = ?", userID).
		Order("updated_at DESC").
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list conversations: %w", err)
	}
	return items, nil
}

// DeleteConversation 删除某用户的会话，返回删除条数
func (s *GormStore) DeleteConversation(ctx context.Context, userID, id string) (int64, error) {
	res := s.db.WithContext(ctx).
		Where("user_id = ? AND id = ?", userID, id).
		Delete(&model.Conversation{})
	if res.Error != nil {
		return 0, fmt.Errorf("delete conversation: %w", res.Error)
	}
	return res.RowsAffected, nil
}

// UpdateConversationTitle 更新某用户会话的标题与 updated_at，不存在返回 ErrConversationNotFound
func (s *GormStore) UpdateConversationTitle(ctx context.Context, userID, id, title string) error {
	res := s.db.WithContext(ctx).
		Model(&model.Conversation{}).
		Where("user_id = ? AND id = ?", userID, id).
		Updates(map[string]any{
			"title":      title,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return fmt.Errorf("update conversation title: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrConversationNotFound
	}
	return nil
}
