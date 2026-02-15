#!/bin/bash

# Velero Dashboard Development Script
# Usage: ./dev.sh [backend|frontend|all|stop|status]

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

function log_error() {
    echo -e "${RED}✗${NC} $1"
}

function log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function check_deps() {
    local missing=0

    if ! command -v go &> /dev/null; then
        log_error "Go not found. Install Go 1.24+"
        missing=1
    fi

    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Install Node.js 22+"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi
}

function start_backend() {
    log_info "Starting Backend (Hot-Reload)..."
    cd "$SCRIPT_DIR/backend"

    # Kill existing backend process
    pkill -f "velero-dashboard" 2>/dev/null || true
    pkill -f "tmp/main" 2>/dev/null || true

    # Check for kubeconfig
    if [ -z "$KUBECONFIG" ] && [ ! -f "$HOME/.kube/config" ]; then
        log_warn "No kubeconfig found. Set KUBECONFIG or ensure ~/.kube/config exists"
        log_warn "Backend will fail to connect to Kubernetes cluster"
    fi

    # Generate encryption key if not set
    if [ -z "$CLUSTER_ENCRYPTION_KEY" ]; then
        export CLUSTER_ENCRYPTION_KEY=$(openssl rand -base64 32)
        log_info "Generated encryption key for cluster storage"
    fi

    # Start with air (hot-reload) or fall back to go run
    AIR_BIN=$(command -v air 2>/dev/null || echo "$HOME/go/bin/air")
    if [ -x "$AIR_BIN" ]; then
        KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}" \
        VELERO_NAMESPACE="${VELERO_NAMESPACE:-velero}" \
        CLUSTER_STORAGE_TYPE="${CLUSTER_STORAGE_TYPE:-sqlite}" \
        CLUSTER_DB_PATH="${CLUSTER_DB_PATH:-./clusters.db}" \
        CLUSTER_ENCRYPTION_KEY="$CLUSTER_ENCRYPTION_KEY" \
        SERVER_PORT=8080 \
        SERVER_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001" \
        $AIR_BIN &
        log_success "Backend started with hot-reload (air) on :8080"
    else
        log_warn "air not found. Install with: go install github.com/air-verse/air@latest"
        log_info "Falling back to go run..."
        KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}" \
        VELERO_NAMESPACE="${VELERO_NAMESPACE:-velero}" \
        CLUSTER_STORAGE_TYPE="${CLUSTER_STORAGE_TYPE:-sqlite}" \
        CLUSTER_DB_PATH="${CLUSTER_DB_PATH:-./clusters.db}" \
        CLUSTER_ENCRYPTION_KEY="$CLUSTER_ENCRYPTION_KEY" \
        SERVER_PORT=8080 \
        SERVER_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001" \
        go run ./cmd/server &
        log_success "Backend started on :8080 (no hot-reload)"
    fi

    cd "$SCRIPT_DIR"
}

function start_frontend() {
    log_info "Starting Frontend (Hot-Reload)..."
    cd "$SCRIPT_DIR/frontend"

    # Kill existing frontend process
    pkill -f "next dev.*velero" 2>/dev/null || true

    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi

    # Start Next.js dev server
    BACKEND_URL="http://localhost:8080" npm run dev -- --port 3001 &
    log_success "Frontend started with hot-reload (Next.js dev) on :3001"

    cd "$SCRIPT_DIR"
}

function stop_all() {
    log_info "Stopping all Velero Dashboard services..."

    # Stop backend
    pkill -f "velero-dashboard" 2>/dev/null && log_success "Backend stopped" || true
    pkill -f "tmp/main" 2>/dev/null || true
    pkill -f "air" 2>/dev/null || true

    # Stop frontend
    pkill -f "next dev.*3001" 2>/dev/null && log_success "Frontend stopped" || true
}

function show_status() {
    echo ""
    log_info "Velero Dashboard - Service Status:"
    echo ""

    # Backend
    if pgrep -f "tmp/main" > /dev/null 2>&1 || pgrep -f "velero-dashboard" > /dev/null 2>&1; then
        echo -e "  ${GREEN}●${NC} Backend:  Running (http://localhost:8080)"
        echo -e "  ${GREEN}●${NC}   API:    http://localhost:8080/api/dashboard/stats"
        echo -e "  ${GREEN}●${NC}   Health: http://localhost:8080/healthz"
    else
        echo -e "  ${RED}●${NC} Backend:  Stopped"
    fi

    # Frontend
    if pgrep -f "next dev" > /dev/null 2>&1; then
        echo -e "  ${GREEN}●${NC} Frontend: Running (http://localhost:3001)"
    else
        echo -e "  ${RED}●${NC} Frontend: Stopped"
    fi

    # Kubernetes connectivity
    if kubectl get ns velero &> /dev/null; then
        echo -e "  ${GREEN}●${NC} Kubernetes: Connected (velero namespace exists)"
        BACKUP_COUNT=$(kubectl get backups.velero.io -n velero --no-headers 2>/dev/null | wc -l)
        echo -e "  ${GREEN}●${NC}   Backups: ${BACKUP_COUNT} found"
    else
        echo -e "  ${YELLOW}●${NC} Kubernetes: Not connected or velero namespace not found"
    fi

    echo ""
}

function run_tests() {
    log_info "Running all tests..."
    echo ""

    log_info "Backend tests:"
    cd "$SCRIPT_DIR/backend"
    go test ./... -v
    BACKEND_RESULT=$?
    cd "$SCRIPT_DIR"

    echo ""
    log_info "Frontend tests:"
    cd "$SCRIPT_DIR/frontend"
    npx vitest run
    FRONTEND_RESULT=$?
    cd "$SCRIPT_DIR"

    echo ""
    if [ $BACKEND_RESULT -eq 0 ] && [ $FRONTEND_RESULT -eq 0 ]; then
        log_success "All tests passed!"
    else
        log_error "Some tests failed"
        exit 1
    fi
}

# Main
case "$1" in
    backend)
        check_deps
        start_backend
        sleep 2
        show_status
        log_success "Backend development mode started!"
        log_info "Backend will auto-reload on file changes (if air installed)"
        ;;
    frontend)
        check_deps
        start_frontend
        sleep 2
        show_status
        log_success "Frontend development mode started!"
        log_info "Frontend will auto-reload on file changes"
        ;;
    all)
        check_deps
        start_backend
        sleep 2
        start_frontend
        sleep 3
        show_status
        log_success "All services started in development mode!"
        log_info "Changes will auto-reload for both backend and frontend"
        echo ""
        log_info "Frontend: http://localhost:3001"
        log_info "Backend:  http://localhost:8080"
        log_info "API:      http://localhost:8080/api/dashboard/stats"
        ;;
    stop)
        stop_all
        show_status
        log_success "All services stopped"
        ;;
    status)
        show_status
        ;;
    test)
        check_deps
        run_tests
        ;;
    *)
        echo "Velero Dashboard Development Script"
        echo ""
        echo "Usage: $0 {backend|frontend|all|stop|status|test}"
        echo ""
        echo "Commands:"
        echo "  backend   - Start Backend with hot-reload (air)"
        echo "  frontend  - Start Frontend with hot-reload (Next.js)"
        echo "  all       - Start all services with hot-reload"
        echo "  stop      - Stop all services"
        echo "  status    - Show service status"
        echo "  test      - Run all tests (Go + Vitest)"
        echo ""
        echo "Environment:"
        echo "  KUBECONFIG               Path to kubeconfig (default: ~/.kube/config) - For auto-migration"
        echo "  VELERO_NAMESPACE         Velero namespace (default: velero) - For auto-migration"
        echo "  CLUSTER_STORAGE_TYPE     Storage type: sqlite/kubernetes (default: sqlite)"
        echo "  CLUSTER_DB_PATH          SQLite DB path (default: ./clusters.db)"
        echo "  CLUSTER_ENCRYPTION_KEY   32-byte encryption key (auto-generated if not set)"
        echo ""
        echo "Multi-Cluster Support:"
        echo "  If KUBECONFIG is set and no clusters exist in DB, a default cluster will be auto-created."
        echo "  Otherwise, add clusters via the UI at http://localhost:3001/clusters"
        echo ""
        echo "Examples:"
        echo "  $0 all                                    # Start everything with auto-migration"
        echo "  VELERO_NAMESPACE=backup $0 backend        # Custom namespace"
        echo "  $0 test                                   # Run all tests"
        exit 1
        ;;
esac
