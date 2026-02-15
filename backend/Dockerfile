FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /velero-dashboard ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /velero-dashboard /velero-dashboard

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/velero-dashboard"]
