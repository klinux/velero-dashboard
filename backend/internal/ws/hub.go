package ws

import (
	"encoding/json"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"go.uber.org/zap"
)

// Hub manages WebSocket connections and broadcasts events.
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
	logger  *zap.Logger
}

func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
		logger:  logger,
	}
}

// Register adds a new WebSocket connection.
func (h *Hub) Register(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	h.logger.Debug("WebSocket client connected", zap.Int("total", len(h.clients)))
}

// Unregister removes a WebSocket connection.
func (h *Hub) Unregister(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, conn)
	h.logger.Debug("WebSocket client disconnected", zap.Int("total", len(h.clients)))
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(event interface{}) {
	data, err := json.Marshal(event)
	if err != nil {
		h.logger.Error("Failed to marshal WebSocket event", zap.Error(err))
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			h.logger.Debug("Failed to write to WebSocket client", zap.Error(err))
			go func(c *websocket.Conn) {
				h.Unregister(c)
				_ = c.Close()
			}(conn)
		}
	}
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
