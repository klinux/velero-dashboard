# Docker Hub Setup for GitHub Actions

## Prerequisites

1. Docker Hub account: https://hub.docker.com
2. GitHub repository with Actions enabled

## Step 1: Create Docker Hub Access Token

1. Log in to Docker Hub: https://hub.docker.com
2. Go to Account Settings → Security
3. Click "New Access Token"
4. Name: `github-actions-velero-dashboard`
5. Access permissions: `Read & Write`
6. Copy the token (you won't see it again!)

## Step 2: Add Secret to GitHub

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `DOCKERHUB_TOKEN`
5. Value: Paste the Docker Hub access token
6. Click "Add secret"

## Step 3: Verify Username

The workflows are configured to push to:
- `klinux/velero-dashboard-backend`
- `klinux/velero-dashboard-frontend`

If your Docker Hub username is different, update the `DOCKER_USERNAME` in `.github/workflows/docker-build.yml`:

```yaml
env:
  DOCKER_USERNAME: your-dockerhub-username  # Change this
```

## Step 4: Create Repositories on Docker Hub (Optional)

GitHub Actions will create the repositories automatically on first push, but you can create them manually:

1. Log in to Docker Hub
2. Create → Create Repository
3. Repository name: `velero-dashboard-backend`
4. Visibility: Public (or Private if you prefer)
5. Repeat for `velero-dashboard-frontend`

## Step 5: Trigger a Build

### Manual trigger (push to main):
```bash
git add .
git commit -m "feat: add GitHub Actions workflows"
git push origin main
```

### Create a release tag:
```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

## Expected Images

After successful build, you'll have:

### Development (main branch):
- `klinux/velero-dashboard-backend:main`
- `klinux/velero-dashboard-backend:main-<sha>`
- `klinux/velero-dashboard-frontend:main`
- `klinux/velero-dashboard-frontend:main-<sha>`

### Production (tags):
- `klinux/velero-dashboard-backend:v0.1.0`
- `klinux/velero-dashboard-backend:0.1.0`
- `klinux/velero-dashboard-backend:0.1`
- `klinux/velero-dashboard-backend:0`
- `klinux/velero-dashboard-backend:latest`
- Same for frontend

## Architecture Support

All images are built for:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM 64-bit, Apple Silicon, etc.)

## Monitoring Builds

1. Go to your GitHub repository
2. Actions tab
3. Click on the workflow run to see logs

## Troubleshooting

### Build fails with "unauthorized" error:
- Verify `DOCKERHUB_TOKEN` secret is set correctly
- Check token has Read & Write permissions
- Ensure token hasn't expired

### Image not appearing on Docker Hub:
- Check GitHub Actions logs for errors
- Verify repository name matches workflow config
- Wait a few minutes - sometimes there's a delay

### Multi-arch build fails:
- This is expected on GitHub Actions (QEMU required)
- The workflow uses `docker/setup-buildx-action` to handle this

## Optional: Add Badge to README

Add this to your README.md:

```markdown
[![Docker Build](https://github.com/YOUR-USERNAME/velero-dashboard/actions/workflows/docker-build.yml/badge.svg)](https://github.com/YOUR-USERNAME/velero-dashboard/actions/workflows/docker-build.yml)
```

## Pull Published Images

After successful build:

```bash
# Pull latest
docker pull klinux/velero-dashboard-backend:latest
docker pull klinux/velero-dashboard-frontend:latest

# Pull specific version
docker pull klinux/velero-dashboard-backend:v0.1.0
docker pull klinux/velero-dashboard-frontend:v0.1.0
```
