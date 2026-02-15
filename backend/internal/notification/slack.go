package notification

import (
	"context"
	"time"
)

// SlackSender sends notifications in Slack webhook format.
type SlackSender struct{}

type slackPayload struct {
	Text        string            `json:"text"`
	Attachments []slackAttachment `json:"attachments,omitempty"`
}

type slackAttachment struct {
	Color  string `json:"color"`
	Title  string `json:"title"`
	Text   string `json:"text"`
	Footer string `json:"footer"`
	Ts     int64  `json:"ts"`
}

func (s *SlackSender) Send(ctx context.Context, url string, event NotificationEvent) error {
	color := eventColor(event.Type)

	footer := "Velero Dashboard"
	if event.ClusterName != "" {
		footer = "Velero Dashboard — " + event.ClusterName
	}

	payload := slackPayload{
		Text: event.Title,
		Attachments: []slackAttachment{
			{
				Color:  color,
				Title:  event.Title,
				Text:   event.Message,
				Footer: footer,
				Ts:     event.Timestamp.Unix(),
			},
		},
	}

	return sendJSON(ctx, url, payload)
}

func eventColor(t EventType) string {
	switch t {
	case EventBackupFailed, EventRestoreFailed:
		return "danger"
	case EventBackupPartiallyFailed:
		return "warning"
	case EventBSLUnavailable:
		return "warning"
	default:
		return "good"
	}
}

// FormatTimestamp formats a time for display in messages.
func FormatTimestamp(t time.Time) string {
	return t.Format("2006-01-02 15:04:05 UTC")
}
