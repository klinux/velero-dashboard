package cluster

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

// SQLiteStore implements Store interface using SQLite
type SQLiteStore struct {
	db     *sql.DB
	cipher cipher.AEAD
	logger *zap.Logger
}

// NewSQLiteStore creates a new SQLite-based store
func NewSQLiteStore(dbPath string, encryptionKey string, logger *zap.Logger) (*SQLiteStore, error) {
	if dbPath == "" {
		dbPath = "./clusters.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Initialize schema
	if err := initSQLiteSchema(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	// Setup encryption
	gcm, err := setupCipher(encryptionKey, logger)
	if err != nil {
		_ = db.Close()
		return nil, err
	}

	logger.Info("SQLite store initialized", zap.String("path", dbPath))

	return &SQLiteStore{
		db:     db,
		cipher: gcm,
		logger: logger,
	}, nil
}

func initSQLiteSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS clusters (
		id TEXT PRIMARY KEY,
		name TEXT UNIQUE NOT NULL,
		kubeconfig_encrypted BLOB NOT NULL,
		namespace TEXT NOT NULL,
		status TEXT NOT NULL,
		status_message TEXT,
		is_default INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		last_health_check DATETIME
	);
	CREATE INDEX IF NOT EXISTS idx_clusters_default ON clusters(is_default);
	CREATE INDEX IF NOT EXISTS idx_clusters_name ON clusters(name);
	`
	_, err := db.Exec(schema)
	return err
}

func setupCipher(key string, logger *zap.Logger) (cipher.AEAD, error) {
	// If key is empty, generate a random one (with warning)
	if key == "" {
		randomKey := make([]byte, 32)
		if _, err := rand.Read(randomKey); err != nil {
			return nil, err
		}
		key = base64.StdEncoding.EncodeToString(randomKey)
		logger.Warn("No encryption key provided, generated random key. Clusters won't persist across restarts!")
	}

	// Ensure key is 32 bytes for AES-256
	keyBytes := []byte(key)
	if len(keyBytes) != 32 {
		// Pad or truncate to 32 bytes
		keyBytes = []byte(fmt.Sprintf("%032s", key)[:32])
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	return cipher.NewGCM(block)
}

func (s *SQLiteStore) encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, s.cipher.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return s.cipher.Seal(nonce, nonce, plaintext, nil), nil
}

func (s *SQLiteStore) decrypt(ciphertext []byte) ([]byte, error) {
	nonceSize := s.cipher.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return s.cipher.Open(nil, nonce, ciphertext, nil)
}

// Create adds a new cluster
func (s *SQLiteStore) Create(ctx context.Context, req CreateClusterRequest) (*Cluster, error) {
	id := uuid.New().String()

	encrypted, err := s.encrypt([]byte(req.Kubeconfig))
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt kubeconfig: %w", err)
	}

	// If this is set as default, clear other defaults
	if req.SetAsDefault {
		if _, err := s.db.ExecContext(ctx, "UPDATE clusters SET is_default = 0"); err != nil {
			return nil, fmt.Errorf("failed to clear default flags: %w", err)
		}
	}

	now := time.Now()
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO clusters (id, name, kubeconfig_encrypted, namespace, status, is_default, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, req.Name, encrypted, req.Namespace, "pending", boolToInt(req.SetAsDefault), now)

	if err != nil {
		return nil, fmt.Errorf("failed to insert cluster: %w", err)
	}

	return &Cluster{
		ID:            id,
		Name:          req.Name,
		KubeconfigRaw: []byte(req.Kubeconfig),
		Namespace:     req.Namespace,
		Status:        "pending",
		IsDefault:     req.SetAsDefault,
		CreatedAt:     now,
	}, nil
}

// Get retrieves a cluster by ID
func (s *SQLiteStore) Get(ctx context.Context, id string) (*Cluster, error) {
	var c Cluster
	var encrypted []byte
	var isDefault int
	var lastCheck sql.NullTime
	var statusMsg sql.NullString

	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, kubeconfig_encrypted, namespace, status, status_message,
		       is_default, created_at, last_health_check
		FROM clusters WHERE id = ?
	`, id).Scan(&c.ID, &c.Name, &encrypted, &c.Namespace, &c.Status,
		&statusMsg, &isDefault, &c.CreatedAt, &lastCheck)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("cluster not found")
	}
	if err != nil {
		return nil, err
	}

	c.IsDefault = isDefault == 1
	if lastCheck.Valid {
		c.LastHealthCheck = lastCheck.Time
	}
	if statusMsg.Valid {
		c.StatusMessage = statusMsg.String
	}

	kubeconfig, err := s.decrypt(encrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt kubeconfig: %w", err)
	}
	c.KubeconfigRaw = kubeconfig

	return &c, nil
}

// List returns all clusters (without kubeconfig)
func (s *SQLiteStore) List(ctx context.Context) ([]*ClusterSummary, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, namespace, status, status_message, is_default,
		       created_at, last_health_check
		FROM clusters ORDER BY is_default DESC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var clusters []*ClusterSummary
	for rows.Next() {
		var c ClusterSummary
		var isDefault int
		var lastCheck sql.NullTime
		var statusMsg sql.NullString

		err := rows.Scan(&c.ID, &c.Name, &c.Namespace, &c.Status,
			&statusMsg, &isDefault, &c.CreatedAt, &lastCheck)
		if err != nil {
			return nil, err
		}

		c.IsDefault = isDefault == 1
		if lastCheck.Valid {
			c.LastHealthCheck = lastCheck.Time
		}
		if statusMsg.Valid {
			c.StatusMessage = statusMsg.String
		}

		clusters = append(clusters, &c)
	}

	return clusters, nil
}

// Update modifies cluster configuration
func (s *SQLiteStore) Update(ctx context.Context, id string, req UpdateClusterRequest) error {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// If setting as default, clear other defaults
	if req.SetAsDefault != nil && *req.SetAsDefault {
		if _, err := tx.ExecContext(ctx, "UPDATE clusters SET is_default = 0"); err != nil {
			return fmt.Errorf("failed to clear default flags: %w", err)
		}
	}

	// Build dynamic UPDATE query
	query := "UPDATE clusters SET "
	args := []interface{}{}

	if req.Name != nil {
		query += "name = ?, "
		args = append(args, *req.Name)
	}
	if req.Kubeconfig != nil {
		encrypted, err := s.encrypt([]byte(*req.Kubeconfig))
		if err != nil {
			return fmt.Errorf("failed to encrypt kubeconfig: %w", err)
		}
		query += "kubeconfig_encrypted = ?, "
		args = append(args, encrypted)
	}
	if req.Namespace != nil {
		query += "namespace = ?, "
		args = append(args, *req.Namespace)
	}
	if req.SetAsDefault != nil {
		query += "is_default = ?, "
		args = append(args, boolToInt(*req.SetAsDefault))
	}

	// Remove trailing comma and add WHERE clause
	query = query[:len(query)-2] + " WHERE id = ?"
	args = append(args, id)

	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("cluster not found")
	}

	return tx.Commit()
}

// Delete removes a cluster
func (s *SQLiteStore) Delete(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM clusters WHERE id = ?", id)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("cluster not found")
	}

	return nil
}

// UpdateStatus updates cluster connection status
func (s *SQLiteStore) UpdateStatus(ctx context.Context, id, status, message string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE clusters
		SET status = ?, status_message = ?, last_health_check = ?
		WHERE id = ?
	`, status, message, time.Now(), id)
	return err
}

// GetDefault returns the default cluster
func (s *SQLiteStore) GetDefault(ctx context.Context) (*Cluster, error) {
	var id string
	err := s.db.QueryRowContext(ctx, "SELECT id FROM clusters WHERE is_default = 1 LIMIT 1").Scan(&id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no default cluster configured")
	}
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Close closes the database connection
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// Helper functions
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
