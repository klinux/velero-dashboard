# =============================================================================
# Velero Dashboard - Makefile
# =============================================================================

REGISTRY := docker.io
DOCKER_USER := klinux
BACKEND_IMAGE := $(REGISTRY)/$(DOCKER_USER)/velero-dashboard-backend
FRONTEND_IMAGE := $(REGISTRY)/$(DOCKER_USER)/velero-dashboard-frontend

VERSION ?= latest
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

DOCKER_BUILD_OPTS := --platform linux/amd64

HELM_CHART := helm/velero-dashboard
HELM_RELEASE := velero-dashboard
HELM_NAMESPACE ?= velero

# =============================================================================
# Help
# =============================================================================
.PHONY: help
help: ## Show this help
	@echo "Velero Dashboard Build System"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# Build
# =============================================================================
.PHONY: build build-backend build-frontend
build: build-backend build-frontend ## Build all Docker images

build-backend: ## Build backend Docker image
	docker build $(DOCKER_BUILD_OPTS) \
		-t $(BACKEND_IMAGE):$(VERSION) \
		-t $(BACKEND_IMAGE):$(GIT_COMMIT) \
		-f backend/Dockerfile \
		backend/

build-frontend: ## Build frontend Docker image
	docker build $(DOCKER_BUILD_OPTS) \
		-t $(FRONTEND_IMAGE):$(VERSION) \
		-t $(FRONTEND_IMAGE):$(GIT_COMMIT) \
		-f frontend/Dockerfile \
		frontend/

# =============================================================================
# Push
# =============================================================================
.PHONY: push push-backend push-frontend
push: push-backend push-frontend ## Push all images

push-backend: ## Push backend image
	docker push $(BACKEND_IMAGE):$(VERSION)
	docker push $(BACKEND_IMAGE):$(GIT_COMMIT)

push-frontend: ## Push frontend image
	docker push $(FRONTEND_IMAGE):$(VERSION)
	docker push $(FRONTEND_IMAGE):$(GIT_COMMIT)

# =============================================================================
# Development
# =============================================================================
.PHONY: dev dev-backend dev-frontend
dev: ## Start both backend and frontend for development
	docker-compose up -d

dev-backend: ## Run backend locally
	cd backend && go run ./cmd/server

dev-frontend: ## Run frontend locally
	cd frontend && npm run dev

# =============================================================================
# Test
# =============================================================================
.PHONY: test test-backend test-frontend
test: test-backend test-frontend ## Run all tests

test-backend: ## Run Go tests
	cd backend && go test ./... -v

test-frontend: ## Run frontend tests
	cd frontend && npm run test:run

# =============================================================================
# Helm
# =============================================================================
.PHONY: helm-lint helm-template helm-install helm-upgrade
helm-lint: ## Lint Helm chart
	helm lint $(HELM_CHART)

helm-template: ## Generate Helm templates
	helm template $(HELM_RELEASE) $(HELM_CHART) --namespace=$(HELM_NAMESPACE)

helm-install: ## Install Helm chart (dry-run by default)
	helm install $(HELM_RELEASE) $(HELM_CHART) --namespace=$(HELM_NAMESPACE) --dry-run

helm-upgrade: ## Upgrade Helm chart
	helm upgrade $(HELM_RELEASE) $(HELM_CHART) --namespace=$(HELM_NAMESPACE)

# =============================================================================
# Combined
# =============================================================================
.PHONY: all clean
all: build push ## Build and push all images

clean: ## Remove local images
	-docker rmi $(BACKEND_IMAGE):$(VERSION) 2>/dev/null
	-docker rmi $(FRONTEND_IMAGE):$(VERSION) 2>/dev/null
