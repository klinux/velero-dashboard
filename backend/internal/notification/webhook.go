package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GenericWebhookSender sends notifications as JSON POST requests.
type GenericWebhookSender struct{}

type genericPayload struct {
	Event       string      `json:"event"`
	Title       string      `json:"title"`
	Message     string      `json:"message"`
	ClusterID   string      `json:"clusterId,omitempty"`
	ClusterName string      `json:"clusterName,omitempty"`
	Timestamp   string      `json:"timestamp"`
	Resource    interface{} `json:"resource,omitempty"`
}

func (s *GenericWebhookSender) Send(ctx context.Context, url string, event NotificationEvent) error {
	payload := genericPayload{
		Event:       string(event.Type),
		Title:       event.Title,
		Message:     event.Message,
		ClusterID:   event.ClusterID,
		ClusterName: event.ClusterName,
		Timestamp:   event.Timestamp.Format(time.RFC3339),
	}

	return sendJSON(ctx, url, payload)
}

func sendJSON(ctx context.Context, url string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}
