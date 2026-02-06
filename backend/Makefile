.PHONY: lint-backend
lint-backend:
	go mod tidy
	go fmt ./...
	go vet ./...

.PHONY: install-backend
install-backend:
	go mod download

.PHONY: build-backend
build-backend:
	go build $(BUILD_OPTS) -mod=readonly -o ../plugin-backend cmd/plugin-backend.go

.PHONY: start-backend
start-backend:
	go run ./cmd/plugin-backend.go -port='9001' -config-path='./config' -static-path='./web/dist'

.PHONY: test-backend
test-backend:
	go test ./pkg/... -v
