# Velero Dashboard

<div align="center">
  <img src="frontend/public/favicon.svg" alt="Velero Dashboard Logo" width="120" height="120">
</div>

<br>

A modern web dashboard for managing [Velero](https://velero.io/) backups in Kubernetes clusters.

## Screenshots

<div align="center">

### Dashboard Overview
![Dashboard](images/dashboard.png)

### Backup Management
<table>
  <tr>
    <td><img src="images/list_backup.png" alt="Backup List" width="400"/></td>
    <td><img src="images/add_backup.png" alt="Add Backup" width="400"/></td>
  </tr>
  <tr>
    <td><img src="images/compare_backups.png" alt="Compare Backups" width="400"/></td>
    <td><img src="images/backup_log.png" alt="Backup Logs" width="400"/></td>
  </tr>
</table>

### Schedule Management
<table>
  <tr>
    <td><img src="images/list_scheduler.png" alt="Schedule List" width="400"/></td>
    <td><img src="images/add_scheduler.png" alt="Add Schedule" width="400"/></td>
  </tr>
</table>

### Storage Configuration
<table>
  <tr>
    <td><img src="images/settings.png" alt="Settings" width="400"/></td>
    <td><img src="images/add_bsl.png" alt="Add BSL" width="400"/></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="images/add_vsl.png" alt="Add VSL" width="400"/></td>
  </tr>
</table>

</div>

---

Built with **Go** + **Next.js** + **Mantine**, interacting directly with Velero CRDs via the Kubernetes API (no CLI wrapping).

## Features

- **Dashboard** — Overview with backup stats, success rate, and recent activity
- **Backups** — List, create, view details, and delete backups
- **Restores** — Create restores from completed backups, track progress
- **Schedules** — Create cron-based backup schedules, pause/resume, delete
- **Settings** — View Backup Storage Locations and Volume Snapshot Locations
- **Real-time** — WebSocket updates on backup/restore status changes
- **Dark mode** — Automatic or manual light/dark theme toggle
- **Notifications** — Toast notifications on backup completion/failure
- **Authentication** — Built-in Basic auth and OIDC (Google, Okta, Keycloak, Azure AD)
- **Role-based access** — Viewer, Operator, Admin roles with UI and API enforcement
- **Pagination & search** — Client-side filtering and paging on all data tables

## Authentication

The dashboard supports three auth modes configured via the `AUTH_MODE` environment variable:

| Mode | Description |
|------|-------------|
| `none` | No authentication (default, backward compatible). All users get admin access. |
| `basic` | Local username/password authentication with bcrypt hashes |
| `oidc` | OpenID Connect provider (Google, Okta, Keycloak, Azure AD, etc.) |

### Roles

| Role | Permissions |
|------|------------|
| `viewer` | Read-only access — dashboard, lists, details, settings |
| `operator` | CRUD — create/delete backups, restores, schedules |
| `admin` | Full access including settings management |

### Basic Auth Setup

```bash
# Generate a bcrypt hash for your password
htpasswd -nbBC 10 "" "your-password" | tr -d ':\n' | sed 's/$2y/$2a/'

# Set users as env var (user:hash:role, comma-separated)
AUTH_MODE=basic
AUTH_USERS="admin:$2a$10$...:admin,viewer:$2a$10$...:viewer"
JWT_SECRET="your-secret-key"
```

### OIDC Setup

```bash
AUTH_MODE=oidc
JWT_SECRET="your-secret-key"
OIDC_ISSUER="https://accounts.google.com"
OIDC_CLIENT_ID="your-client-id"
OIDC_CLIENT_SECRET="your-client-secret"
OIDC_REDIRECT_URL="https://velero.example.com/api/auth/oidc/callback"
OIDC_ADMIN_GROUPS="velero-admins"
OIDC_OPERATOR_GROUPS="velero-operators"
OIDC_DEFAULT_ROLE="viewer"
```

Groups from the OIDC token's `groups` claim are mapped to roles. Users matching `OIDC_ADMIN_GROUPS` get admin, `OIDC_OPERATOR_GROUPS` get operator, all others get the default role.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Next.js Frontend │────▶│  Go Backend API  │
│  (Mantine)   │     │  :3000 / :3001    │     │  :8080           │
│              │◀────│                   │◀────│                  │
│  WebSocket   │     │  React Query      │     │  Fiber + WS      │
└─────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                                              K8s Dynamic Client
                                                       │
                                              ┌────────▼─────────┐
                                              │  Kubernetes API   │
                                              │  Velero CRDs      │
                                              │  (velero.io/v1)   │
                                              └──────────────────┘
```

**Key design decisions:**
- **No CLI wrapping** — The backend uses `client-go` dynamic client to interact with Velero CRDs directly, avoiding the security risks and fragility of shelling out to the Velero CLI
- **No database** — All data comes from the Kubernetes API in real-time
- **WebSocket informers** — The backend watches Velero resources and broadcasts changes to connected clients

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.25, Fiber, client-go, zap |
| Frontend | Next.js 15, Mantine v7, React Query, mantine-datatable |
| Real-time | WebSocket (Fiber + native browser API) |
| Deployment | Helm chart, Docker (distroless), RBAC |
| Tests | Go testing + Vitest |

## Quick Start

### Prerequisites

- **Go** 1.23+
- **Node.js** 22+
- **kubectl** configured with access to a cluster running Velero
- **air** (optional, for backend hot-reload): `go install github.com/air-verse/air@latest`

### Development

```bash
cd velero

# Start everything (backend + frontend with hot-reload)
./dev.sh all

# Or start individually
./dev.sh backend    # Go API on :8080
./dev.sh frontend   # Next.js on :3001

# Check status
./dev.sh status

# Stop everything
./dev.sh stop
```

The backend reads your local `~/.kube/config` and connects to the current context. Make sure Velero is installed in the target cluster.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig file |
| `VELERO_NAMESPACE` | `velero` | Namespace where Velero is installed |
| `SERVER_PORT` | `8080` | Backend API port |
| `SERVER_ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins |
| `BACKEND_URL` | `http://localhost:8080` | Backend URL (used by frontend proxy) |
| `AUTH_MODE` | `none` | Auth mode: `none`, `basic`, `oidc` |
| `JWT_SECRET` | (auto-generated) | Secret for JWT signing (HS256) |
| `JWT_EXPIRATION` | `24h` | JWT token expiration duration |
| `AUTH_USERS` | | Basic mode users: `user:bcrypt_hash:role,...` |
| `OIDC_ISSUER` | | OIDC provider issuer URL |
| `OIDC_CLIENT_ID` | | OIDC client ID |
| `OIDC_CLIENT_SECRET` | | OIDC client secret |
| `OIDC_REDIRECT_URL` | | OIDC callback URL |
| `OIDC_ROLE_CLAIM` | `groups` | OIDC claim for role mapping |
| `OIDC_ADMIN_GROUPS` | `velero-admins` | Groups mapped to admin role |
| `OIDC_OPERATOR_GROUPS` | `velero-operators` | Groups mapped to operator role |
| `OIDC_DEFAULT_ROLE` | `viewer` | Default role for authenticated users |

## Testing

### Run All Tests

```bash
./dev.sh test
```

### Backend Tests (Go)

```bash
cd backend
go test ./... -v
```

**23 tests** covering:
- CRUD operations for Backups, Restores, Schedules
- Dashboard stats aggregation
- Backup deletion via DeleteBackupRequest CRD
- Schedule pause/resume toggle
- BackupStorageLocation listing
- CRD parsers (unstructured → typed DTOs)
- Auth: JWT generation/validation, role hierarchy, user parsing, OIDC group extraction

Tests use `k8s.io/client-go/dynamic/fake` — no real cluster needed.

### Frontend Tests (Vitest)

```bash
cd frontend
npm run test:run       # Single run
npm run test           # Watch mode
npm run test:coverage  # With coverage report
```

**44 tests** covering:
- API client (fetch wrapper, error handling)
- Utility functions (date formatting, duration, time ago)
- Phase color mapping (11 Velero phases → badge colors)
- Table search hook (filtering, pagination, case-insensitive search)

### Writing Tests

**Backend:** Add tests in `*_test.go` files next to the code. Use `newTestClient()` from `velero_test.go` for a pre-configured fake K8s client:

```go
func TestMyFeature(t *testing.T) {
    client := newTestClient(t,
        makeBackup("b1", "Completed", 0, 0),
    )
    // test with client...
}
```

**Frontend:** Add tests in `src/__tests__/`. Use `vitest` + `@testing-library/react`:

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "@/lib/utils";

describe("myFunction", () => {
  it("does something", () => {
    expect(myFunction("input")).toBe("expected");
  });
});
```

## Deployment

### Helm Chart

```bash
# Lint
cd velero && make helm-lint

# Preview templates
make helm-template

# Install (dry-run first)
make helm-install

# Install for real
helm install velero-dashboard helm/velero-dashboard \
  --namespace velero \
  --set ingress.enabled=true \
  --set ingress.host=velero.example.com
```

### Helm Values

```yaml
# values.yaml overrides
backend:
  image:
    repository: klinux/velero-dashboard-backend
    tag: "1.0.0"

frontend:
  image:
    repository: klinux/velero-dashboard-frontend
    tag: "1.0.0"

velero:
  namespace: velero

ingress:
  enabled: true
  className: nginx
  host: velero.example.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
  tls:
    - secretName: velero-dashboard-tls
      hosts:
        - velero.example.com
```

### RBAC

The Helm chart creates a dedicated `ServiceAccount` + `ClusterRole` with permissions limited to Velero CRDs:

```yaml
rules:
  - apiGroups: ["velero.io"]
    resources:
      - backups, restores, schedules
      - backupstoragelocations, volumesnapshotlocations
      - deletebackuprequests, downloadrequests
      - serverstatusrequests
      - podvolumebackups, podvolumerestores
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

No access to Secrets, ConfigMaps, Pods, or any other Kubernetes resources.

### Docker Images

```bash
# Build
make build                    # Both images
make build-backend            # Backend only
make build-frontend           # Frontend only

# Build with version tag
make build VERSION=1.0.0

# Push to registry
make push VERSION=1.0.0

# Build + push
make all VERSION=1.0.0
```

### Local Testing with Kind + Velero

If you don't have a cluster with Velero, you can set one up locally:

```bash
# Create local cluster
kind create cluster --name velero-test

# Install MinIO (S3-compatible storage)
kubectl apply -f https://raw.githubusercontent.com/vmware-tanzu/velero/main/examples/minio/00-minio-deployment.yaml

# Create credentials file
cat > /tmp/minio-credentials <<EOF
[default]
aws_access_key_id = minio
aws_secret_access_key = minio123
EOF

# Install Velero
velero install \
  --provider aws \
  --bucket velero \
  --secret-file /tmp/minio-credentials \
  --plugins velero/velero-plugin-for-aws:v1.10.0 \
  --backup-location-config region=minio,s3ForcePathStyle=true,s3Url=http://minio.velero.svc:9000 \
  --use-volume-snapshots=false

# Verify
kubectl get pods -n velero
kubectl get bsl -n velero

# Now start the dashboard
cd velero && ./dev.sh all
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | Public | Health check |
| GET | `/api/auth/config` | Public | Auth mode configuration |
| POST | `/api/auth/login` | Public | Basic auth login |
| GET | `/api/auth/oidc/login` | Public | OIDC login redirect |
| GET | `/api/auth/oidc/callback` | Public | OIDC callback |
| GET | `/api/auth/me` | Viewer+ | Current user info |
| GET | `/api/dashboard/stats` | Viewer+ | Aggregated statistics |
| GET | `/api/backups` | Viewer+ | List all backups |
| GET | `/api/backups/:name` | Viewer+ | Get backup details |
| POST | `/api/backups` | Operator+ | Create a backup |
| DELETE | `/api/backups/:name` | Operator+ | Delete a backup |
| GET | `/api/restores` | Viewer+ | List all restores |
| GET | `/api/restores/:name` | Viewer+ | Get restore details |
| POST | `/api/restores` | Operator+ | Create a restore |
| GET | `/api/schedules` | Viewer+ | List all schedules |
| GET | `/api/schedules/:name` | Viewer+ | Get schedule details |
| POST | `/api/schedules` | Operator+ | Create a schedule |
| PATCH | `/api/schedules/:name` | Operator+ | Toggle pause/resume |
| DELETE | `/api/schedules/:name` | Operator+ | Delete a schedule |
| GET | `/api/settings/backup-locations` | Viewer+ | List BSLs |
| GET | `/api/settings/snapshot-locations` | Viewer+ | List VSLs |
| GET | `/api/settings/server-info` | Viewer+ | Dashboard version and config |
| WS | `/ws` | Token | Real-time events |

## Project Structure

```
velero/
├── dev.sh                      # Development script (like FuseOne)
├── Makefile                    # Build, push, test, helm targets
├── docker-compose.yml          # Dev environment
├── LICENSE                     # MIT
├── CONTRIBUTING.md             # PR guidelines and code of conduct
│
├── backend/
│   ├── cmd/server/main.go      # Entry point, routes, lifecycle
│   ├── internal/
│   │   ├── config/config.go    # Env-based configuration
│   │   ├── auth/               # Authentication package
│   │   │   ├── auth.go         # Interface, roles, hierarchy
│   │   │   ├── jwt.go          # JWT generation/validation
│   │   │   ├── middleware.go   # Auth + role middleware
│   │   │   ├── none.go         # No-auth provider (default)
│   │   │   ├── basic.go        # Username/password provider
│   │   │   ├── oidc.go         # OIDC provider
│   │   │   └── auth_test.go    # 8 test functions
│   │   ├── k8s/
│   │   │   ├── client.go       # K8s client (in-cluster + kubeconfig)
│   │   │   ├── velero.go       # Velero CRD CRUD operations
│   │   │   ├── informers.go    # Watch loop → WebSocket broadcast
│   │   │   ├── types.go        # Request/Response DTOs
│   │   │   └── velero_test.go  # 15 unit tests
│   │   ├── handler/            # HTTP handlers
│   │   ├── middleware/cors.go
│   │   └── ws/hub.go           # WebSocket connection manager
│   ├── Dockerfile
│   └── Makefile
│
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── login/          # Login page (basic + OIDC)
│   │   │   ├── auth/callback/  # OIDC callback handler
│   │   │   ├── backups/        # Backup list, detail, create
│   │   │   ├── restores/       # Restore list, create
│   │   │   ├── schedules/      # Schedule list, create
│   │   │   └── settings/       # BSL + VSL configuration
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # React Query + WebSocket hooks
│   │   ├── lib/                # API client, auth store, types, utilities
│   │   └── __tests__/          # 44 Vitest tests
│   ├── Dockerfile
│   └── vitest.config.ts
│
└── helm/velero-dashboard/      # Helm chart
    ├── Chart.yaml
    ├── values.yaml
    └── templates/              # K8s manifests + RBAC
```

## Roadmap

- [x] Authentication (Basic + OIDC with role-based access)
- [x] Backup log viewer (via DownloadRequest CRD)
- [x] Backup/restore progress bar (real-time via WebSocket)
- [x] Spotlight search (Cmd+K) for quick navigation
- [x] Backup size metrics and storage usage charts
- [x] Backup comparison (diff between two backups)
- [ ] Multi-cluster support

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, code of conduct, and PR requirements.

## License

[MIT](LICENSE) - Kleber Rocha
