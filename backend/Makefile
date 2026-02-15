.PHONY: run build test clean docker-build

run:
	go run ./cmd/server

build:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/velero-dashboard ./cmd/server

test:
	go test ./... -v

test-coverage:
	go test ./... -v -cover -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html

clean:
	rm -rf bin/ coverage.out coverage.html

docker-build:
	docker build -t velero-dashboard-backend:latest .

docker-run:
	docker run --rm -p 8080:8080 velero-dashboard-backend:latest
