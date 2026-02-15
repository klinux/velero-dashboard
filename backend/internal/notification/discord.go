package notification

import "context"

// DiscordSender sends notifications in Discord webhook format.
type DiscordSender struct{}

type discordPayload struct {
	Content string         `json:"content,omitempty"`
	Embeds  []discordEmbed `json:"embeds"`
}

type discordEmbed struct {
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Color       int           `json:"color"`
	Timestamp   string        `json:"timestamp"`
	Footer      discordFooter `json:"footer,omitempty"`
}

type discordFooter struct {
	Text string `json:"text"`
}

func (s *DiscordSender) Send(ctx context.Context, url string, event NotificationEvent) error {
	color := discordColor(event.Type)

	footer := "Velero Dashboard"
	if event.ClusterName != "" {
		footer = "Velero Dashboard — " + event.ClusterName
	}

	payload := discordPayload{
		Embeds: []discordEmbed{
			{
				Title:       event.Title,
				Description: event.Message,
				Color:       color,
				Timestamp:   event.Timestamp.Format("2006-01-02T15:04:05Z"),
				Footer:      discordFooter{Text: footer},
			},
		},
	}

	return sendJSON(ctx, url, payload)
}

// Discord uses decimal colors
func discordColor(t EventType) int {
	switch t {
	case EventBackupFailed, EventRestoreFailed:
		return 0xED4245 // Red
	case EventBackupPartiallyFailed:
		return 0xFEE75C // Yellow
	case EventBSLUnavailable:
		return 0xF0B232 // Orange
	default:
		return 0x57F287 // Green
	}
}
