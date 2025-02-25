FROM registry.ci.openshift.org/ocp/builder:rhel-9-base-nodejs-openshift-4.19 AS web-builder

WORKDIR /opt/app-root

USER 0

ENV HUSKY=0

COPY web/package.json web/package-lock.json web/
COPY Makefile Makefile
RUN make install-frontend

COPY web/ web/
RUN make build-frontend

FROM registry.ci.openshift.org/ocp/builder:rhel-9-golang-1.23-openshift-4.19 as go-builder

WORKDIR /opt/app-root

COPY Makefile Makefile
COPY go.mod go.mod
COPY go.sum go.sum

RUN make install-backend

COPY cmd/ cmd/
COPY pkg/ pkg/

ENV GOEXPERIMENT=strictfipsruntime
ENV CGO_ENABLED=1

RUN make build-backend BUILD_OPTS="-tags strictfipsruntime"

FROM registry.ci.openshift.org/ocp/4.19:base-rhel9

USER 1001

COPY --from=web-builder /opt/app-root/web/dist /opt/app-root/web/dist
COPY --from=go-builder /opt/app-root/plugin-backend /opt/app-root
COPY config/ /opt/app-root/config

ENTRYPOINT ["/opt/app-root/plugin-backend", "-static-path", "/opt/app-root/web/dist", "-config-path", "/opt/app-root/config"]
