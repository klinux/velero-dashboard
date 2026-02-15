# Contributing to Velero Dashboard

Thank you for your interest in contributing to Velero Dashboard! This document provides guidelines and information for contributors.

## Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for all, regardless of level of experience, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, nationality, or other similar characteristic.

### Our Standards

**Expected behavior:**

- Be respectful and inclusive in language and actions
- Accept constructive criticism gracefully
- Focus on what is best for the community and project
- Show empathy towards other community members

**Unacceptable behavior:**

- Harassment, trolling, or derogatory comments
- Publishing private information without permission
- Any conduct which could reasonably be considered inappropriate in a professional setting

### Enforcement

Project maintainers are responsible for clarifying the standards of acceptable behavior and are expected to take appropriate and fair corrective action in response to any instances of unacceptable behavior.

## How to Contribute

### Reporting Bugs

Before creating a bug report, check existing issues. When creating a report, include:

- A clear title and description
- Steps to reproduce the behavior
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Go version, Node.js version, K8s version, Velero version)

### Suggesting Features

Feature requests are welcome. Please provide:

- A clear description of the feature
- The use case and why it would be useful
- Any implementation ideas you may have

### Pull Requests

#### Before Submitting

1. **Fork** the repository and create your branch from `main`
2. **Read** the project structure and conventions below
3. **Write tests** for any new functionality
4. **Ensure all tests pass** before submitting

#### PR Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes with clear, concise commits
3. Ensure tests pass:
   ```bash
   # Backend
   cd backend && go test ./... -v

   # Frontend
   cd frontend && npm run test:run
   ```
4. Push your branch and open a PR against `main`
5. Fill in the PR template with a clear description

#### PR Requirements

- [ ] Tests pass (`./dev.sh test`)
- [ ] New features include tests
- [ ] Code follows existing patterns and conventions
- [ ] Commit messages are clear and descriptive
- [ ] No secrets, credentials, or sensitive data included
- [ ] Breaking changes are documented

#### Commit Messages

Use clear, descriptive commit messages:

```
feat: add backup filter by namespace
fix: handle empty backup list in dashboard stats
docs: update README with Helm install instructions
test: add schedule toggle pause tests
refactor: extract backup parser into separate function
```

Prefixes: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`

### Code Conventions

#### Backend (Go)

- Follow standard Go conventions (`gofmt`, `go vet`)
- Use `zap` for logging (not `fmt.Println` or `log`)
- Error wrapping with `fmt.Errorf("context: %w", err)`
- Tests use the standard `testing` package
- CRD operations go in `internal/k8s/velero.go`
- HTTP handlers go in `internal/handler/`

#### Frontend (TypeScript/React)

- Functional components with hooks
- Mantine v7+ components for UI
- React Query for data fetching
- Types in `lib/types.ts` (match backend DTOs)
- Hooks in `hooks/` directory
- `"use client"` directive for client components

## Development Setup

See the [README](README.md) for detailed setup instructions.

Quick start:
```bash
./dev.sh all
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
