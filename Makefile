.PHONY: install-frontend
install-frontend:
	cd web && npm install

.PHONY: install-frontend-ci
install-frontend-ci:
	cd web && npm ci --omit=optional --ignore-scripts

.PHONY: install-frontend-ci-clean
install-frontend-ci-clean: install-frontend-ci
	cd web && npm cache clean

.PHONY: build-frontend
build-frontend:
	cd web && npm run build

.PHONY: start-frontend
start-frontend:
	cd web && npm run start

.PHONY: start-console
start-console:
	./scripts/start-console.sh

.PHONY: i18n-frontend
i18n-frontend:
	cd web && npm run i18n

.PHONY: lint-frontend
lint-frontend:
	cd web && npm run lint

.PHONY: lint-backend
lint-backend:
	go mod tidy
	go fmt ./cmd/
	go fmt ./pkg/

.PHONY: install-backend
install-backend:
	go mod download

.PHONY: build-backend
build-backend:
	go build $(BUILD_OPTS) -mod=readonly -o plugin-backend cmd/plugin-backend.go

.PHONY: start-backend
start-backend:
	go run ./cmd/plugin-backend.go -port='9001' -config-path='./config' -static-path='./web/dist'

.PHONY: build-image
build-image:
	./scripts/build-image.sh


.PHONY: install
install:
	make install-frontend && make install-backend

.PHONY: update-plugin-name
update-plugin-name:
	./scripts/update-plugin-name.sh

export REGISTRY_ORG?=openshift-observability-ui
export TAG?=latest
export PLUGIN_NAME?=monitoring-plugin
IMAGE=quay.io/${REGISTRY_ORG}/monitoring-plugin:${TAG}

.PHONY: deploy
deploy:
	make lint-backend
	PUSH=1 scripts/build-image.sh
	helm uninstall $(PLUGIN_NAME) -n $(PLUGIN_NAME)-ns || true
	helm install $(PLUGIN_NAME) charts/openshift-console-plugin -n monitoring-plugin-ns --create-namespace --set plugin.image=$(IMAGE)

.PHONY: deploy-acm
deploy-acm:
	./scripts/deploy-acm.sh

.PHONY: build-mcp-image
build-mcp-image:
	DOCKER_FILE_NAME="Dockerfile.mcp" REPO="monitoring-console-plugin" scripts/build-image.sh 

.PHONY: build-dev-mcp-image
build-dev-mcp-image:
	DOCKER_FILE_NAME="Dockerfile.dev-mcp" REPO="monitoring-console-plugin" scripts/build-image.sh

.PHONY: start-feature-console
start-feature-console:
	PLUGIN_PORT=9443 ./scripts/start-console.sh

export FEATURES?=incidents,perses-dashboards,dev-config
.PHONY: start-feature-backend
start-feature-backend:
	go run ./cmd/plugin-backend.go -port='9443' -config-path='./config' -static-path='./web/dist' -features='$(FEATURES)'

export PLATFORMS ?= linux/arm64,linux/amd64
.PHONY: mcp-podman-cross-build
mcp-podman-cross-build:
	podman manifest create ${IMAGE}
	podman build --platform $(PLATFORMS) --manifest ${IMAGE} -f Dockerfile.mcp
	podman manifest push ${IMAGE}

.PHONY: test-translations
test-translations:
	./scripts/test-translations.sh
