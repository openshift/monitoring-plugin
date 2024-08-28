FROM registry.redhat.io/ubi9/nodejs-18:1-118 AS web-builder

WORKDIR /opt/app-root

USER 0

RUN npm install --global yarn

ENV HUSKY=0

COPY web/package.json web/yarn.lock web/
COPY Makefile Makefile
RUN make install-frontend

COPY web/ web/
RUN make build-frontend

FROM quay.io/redhat-cne/openshift-origin-release:rhel-9-golang-1.22-openshift-4.17 as go-builder

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

FROM quay.io/redhat-cne/openshift-origin-release:rhel-9-golang-1.22-openshift-4.17

RUN dnf install -y nginx findutils && \
    mkdir /var/cache/nginx && \
    chown -R 1001:0 /var/lib/nginx /var/log/nginx /run && \
    chmod -R ug+rwX /var/lib/nginx /var/log/nginx /run

USER 1001

COPY --from=web-builder /opt/app-root/web/dist /opt/app-root/web/dist
COPY --from=go-builder /opt/app-root/plugin-backend /opt/app-root

COPY --from=web-builder /opt/app-root/web/dist /usr/share/nginx/html

ENTRYPOINT ["nginx", "-g", "daemon off;"]

# When nginx is removed from CMO, we can use the following ENTRYPOINT instead and remove the nginx install
# After it has been removed add the CI checks to this repo. [example](https://github.com/openshift/release/pull/56011)
# ENTRYPOINT ["/opt/app-root/plugin-backend", "-static-path", "/opt/app-root/web/dist"]
