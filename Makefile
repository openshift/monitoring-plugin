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
	go run ./cmd/plugin-backend.go -port='9001' -config-path='./web/dist' -static-path='./web/dist' -plugin-config-path='ct.yaml'

.PHONY: build-image
build-image:
	./scripts/build-image.sh

.PHONY: install
install:
	make install-frontend && make install-backend


export REGISTRY_ORG?=openshift-observability-ui
export TAG?=latest
IMAGE=quay.io/${REGISTRY_ORG}/monitoring-plugin:${TAG}

.PHONY: deploy
deploy:
	helm uninstall monitoring-plugin -n monitoring-plugin-ns || true
	make lint-backend
	PUSH=1 scripts/build-image.sh
	helm install monitoring-plugin charts/openshift-console-plugin -n monitoring-plugin-ns --create-namespace --set plugin.image=$(IMAGE)
