FROM registry.ci.openshift.org/ocp/builder:rhel-9-base-nodejs-openshift-5.0 AS web-builder

WORKDIR /opt/app-root

USER 0

ENV HUSKY=0
ENV CYPRESS_INSTALL_BINARY=0

COPY Makefile Makefile
COPY web/ web/

ENV CONSOLE_PLUGIN_NAME="monitoring-console-plugin"

RUN make install-frontend-ci
RUN make build-frontend

FROM registry.ci.openshift.org/ocp/builder:rhel-9-golang-1.26-openshift-5.0 AS go-builder

WORKDIR /opt/app-root

COPY Makefile Makefile
COPY go.mod go.mod
COPY go.sum go.sum

RUN make install-backend

COPY cmd/ cmd/
COPY pkg/ pkg/

ENV GOOS=${TARGETOS:-linux}
ENV GOARCH=${TARGETARCH}
ENV GOEXPERIMENT=strictfipsruntime
ENV GOFLAGS=-mod=readonly
ENV CGO_ENABLED=1

RUN make build-backend

FROM registry.ci.openshift.org/ocp/5.0:base-rhel9

RUN mkdir /licenses
COPY LICENSE /licenses/.

USER 1001

COPY --from=web-builder /opt/app-root/web/dist /opt/app-root/web/dist
COPY --from=go-builder /opt/app-root/plugin-backend /opt/app-root
COPY --from=web-builder /opt/app-root/config /opt/app-root/config
COPY config/ /opt/app-root/config

ENTRYPOINT ["/opt/app-root/plugin-backend", "-static-path", "/opt/app-root/web/dist", -config-path", "/opt/app-root/config"]

ARG VERSION=v1.0.0
LABEL version="${VERSION}" \
      release="${VERSION}" \
      vendor="Red Hat, Inc." \
      url="https://github.com/openshift/monitoring-plugin" \
      summary="OpenShift monitoring plugin to manage dashboards and multi cluster alerts" \
      io.openshift.tags="openshift,observability-ui,dashboards,alerts" \
      io.k8s.display-name="OpenShift console monitoring plugin" \
      io.k8s.description="OpenShift monitoring plugin to manage dashboards and multi cluster alerts" \
      maintainer="Observability UI Team <team-observability-ui@redhat.com>" \
      description="OpenShift monitoring plugin to manage dashboards and multi cluster alerts"
