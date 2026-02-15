FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS builder

ARG TARGETARCH

RUN apk add --no-cache git ca-certificates

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -ldflags="-s -w" -o /velero-dashboard ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /velero-dashboard /velero-dashboard

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/velero-dashboard"]
