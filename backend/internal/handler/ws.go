package handler

import (
	"github.com/gofiber/contrib/websocket"
	"github.com/klinux/velero-dashboard/internal/ws"
	"go.uber.org/zap"
)

type WSHandler struct {
	hub    *ws.Hub
	logger *zap.Logger
}

func NewWSHandler(hub *ws.Hub, logger *zap.Logger) *WSHandler {
	return &WSHandler{hub: hub, logger: logger}
}

func (h *WSHandler) Handle(conn *websocket.Conn) {
	h.hub.Register(conn)
	defer func() {
		h.hub.Unregister(conn)
		conn.Close()
	}()

	// Keep connection alive by reading (client may send pings)
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
