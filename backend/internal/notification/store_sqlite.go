package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

// SQLiteStore stores webhook configurations in SQLite.
type SQLiteStore struct {
	db     *sql.DB
	logger *zap.Logger
}

// NewSQLiteStore creates a new SQLite notification store.
func NewSQLiteStore(dbPath string, logger *zap.Logger) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal=WAL&_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	s := &SQLiteStore{db: db, logger: logger}
	if err := s.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return s, nil
}

func (s *SQLiteStore) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS webhooks (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			url TEXT NOT NULL,
			events TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			last_sent_at TEXT,
			last_status TEXT,
			last_error TEXT
		)
	`)
	return err
}

func (s *SQLiteStore) Create(_ context.Context, req CreateWebhookRequest) (*WebhookConfig, error) {
	id := uuid.New().String()
	now := time.Now()

	eventsJSON, err := json.Marshal(req.Events)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal events: %w", err)
	}

	_, err = s.db.Exec(
		`INSERT INTO webhooks (id, name, type, url, events, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, string(req.Type), req.URL, string(eventsJSON), req.Enabled, now.Format(time.RFC3339), now.Format(time.RFC3339),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert webhook: %w", err)
	}

	return &WebhookConfig{
		ID:        id,
		Name:      req.Name,
		Type:      req.Type,
		URL:       req.URL,
		Events:    req.Events,
		Enabled:   req.Enabled,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (s *SQLiteStore) Get(_ context.Context, id string) (*WebhookConfig, error) {
	row := s.db.QueryRow(`SELECT id, name, type, url, events, enabled, created_at, updated_at, last_sent_at, last_status, last_error FROM webhooks WHERE id = ?`, id)
	return s.scanWebhook(row)
}

func (s *SQLiteStore) List(_ context.Context) ([]*WebhookConfig, error) {
	rows, err := s.db.Query(`SELECT id, name, type, url, events, enabled, created_at, updated_at, last_sent_at, last_status, last_error FROM webhooks ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("failed to list webhooks: %w", err)
	}
	defer rows.Close()

	var results []*WebhookConfig
	for rows.Next() {
		wh, err := s.scanWebhookRow(rows)
		if err != nil {
			s.logger.Error("Failed to scan webhook row", zap.Error(err))
			continue
		}
		results = append(results, wh)
	}
	return results, nil
}

func (s *SQLiteStore) Update(_ context.Context, id string, req UpdateWebhookRequest) error {
	// Build dynamic update query
	sets := []string{"updated_at = ?"}
	args := []interface{}{time.Now().Format(time.RFC3339)}

	if req.Name != nil {
		sets = append(sets, "name = ?")
		args = append(args, *req.Name)
	}
	if req.Type != nil {
		sets = append(sets, "type = ?")
		args = append(args, string(*req.Type))
	}
	if req.URL != nil {
		sets = append(sets, "url = ?")
		args = append(args, *req.URL)
	}
	if req.Events != nil {
		eventsJSON, _ := json.Marshal(req.Events)
		sets = append(sets, "events = ?")
		args = append(args, string(eventsJSON))
	}
	if req.Enabled != nil {
		sets = append(sets, "enabled = ?")
		args = append(args, *req.Enabled)
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE webhooks SET %s WHERE id = ?", joinStrings(sets, ", "))

	result, err := s.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update webhook: %w", err)
	}

	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("webhook not found: %s", id)
	}
	return nil
}

func (s *SQLiteStore) Delete(_ context.Context, id string) error {
	result, err := s.db.Exec(`DELETE FROM webhooks WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete webhook: %w", err)
	}

	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("webhook not found: %s", id)
	}
	return nil
}

func (s *SQLiteStore) UpdateDeliveryStatus(_ context.Context, id string, status string, errMsg string) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(
		`UPDATE webhooks SET last_sent_at = ?, last_status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
		now, status, errMsg, now, id,
	)
	return err
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// scanner interface for both *sql.Row and *sql.Rows
type scanner interface {
	Scan(dest ...interface{}) error
}

func (s *SQLiteStore) scanWebhook(row *sql.Row) (*WebhookConfig, error) {
	return s.scan(row)
}

func (s *SQLiteStore) scanWebhookRow(rows *sql.Rows) (*WebhookConfig, error) {
	return s.scan(rows)
}

func (s *SQLiteStore) scan(sc scanner) (*WebhookConfig, error) {
	var (
		wh                                              WebhookConfig
		whType, eventsJSON, createdAt, updatedAt        string
		lastSentAt, lastStatus, lastError               sql.NullString
	)

	err := sc.Scan(&wh.ID, &wh.Name, &whType, &wh.URL, &eventsJSON, &wh.Enabled, &createdAt, &updatedAt, &lastSentAt, &lastStatus, &lastError)
	if err != nil {
		return nil, err
	}

	wh.Type = WebhookType(whType)
	_ = json.Unmarshal([]byte(eventsJSON), &wh.Events)
	wh.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	wh.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

	if lastSentAt.Valid {
		t, _ := time.Parse(time.RFC3339, lastSentAt.String)
		wh.LastSentAt = &t
	}
	if lastStatus.Valid {
		wh.LastStatus = lastStatus.String
	}
	if lastError.Valid {
		wh.LastError = lastError.String
	}

	return &wh, nil
}

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
