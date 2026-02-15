package notification

import "context"

// TeamsSender sends notifications in Microsoft Teams Adaptive Card format.
type TeamsSender struct{}

type teamsPayload struct {
	Type        string            `json:"type"`
	Attachments []teamsAttachment `json:"attachments"`
}

type teamsAttachment struct {
	ContentType string       `json:"contentType"`
	Content     teamsContent `json:"content"`
}

type teamsContent struct {
	Schema  string      `json:"$schema"`
	Type    string      `json:"type"`
	Version string      `json:"version"`
	Body    []teamsBody `json:"body"`
}

type teamsBody struct {
	Type   string `json:"type"`
	Text   string `json:"text,omitempty"`
	Size   string `json:"size,omitempty"`
	Weight string `json:"weight,omitempty"`
	Color  string `json:"color,omitempty"`
	Wrap   bool   `json:"wrap,omitempty"`
}

func (s *TeamsSender) Send(ctx context.Context, url string, event NotificationEvent) error {
	color := teamsColor(event.Type)

	footer := "Velero Dashboard"
	if event.ClusterName != "" {
		footer = "Cluster: " + event.ClusterName
	}

	payload := teamsPayload{
		Type: "message",
		Attachments: []teamsAttachment{
			{
				ContentType: "application/vnd.microsoft.card.adaptive",
				Content: teamsContent{
					Schema:  "http://adaptivecards.io/schemas/adaptive-card.json",
					Type:    "AdaptiveCard",
					Version: "1.4",
					Body: []teamsBody{
						{Type: "TextBlock", Text: event.Title, Size: "Large", Weight: "Bolder", Color: color},
						{Type: "TextBlock", Text: event.Message, Wrap: true},
						{Type: "TextBlock", Text: footer + " — " + FormatTimestamp(event.Timestamp), Size: "Small", Color: "Light"},
					},
				},
			},
		},
	}

	return sendJSON(ctx, url, payload)
}

func teamsColor(t EventType) string {
	switch t {
	case EventBackupFailed, EventRestoreFailed:
		return "Attention"
	case EventBackupPartiallyFailed, EventBSLUnavailable:
		return "Warning"
	default:
		return "Good"
	}
}
