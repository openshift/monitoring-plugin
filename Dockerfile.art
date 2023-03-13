FROM registry.redhat.io/ubi8/nodejs-16:1-82.1675799501 AS builder

# Copy app sources
COPY $REMOTE_SOURCES $REMOTE_SOURCES_DIR
COPY . /usr/src/app
WORKDIR /usr/src/app

# bootstrap yarn so we can install and run the other tools.
USER 0
ARG YARN_VERSION=v1.22.19
RUN CACHED_YARN=./artifacts/yarn-${YARN_VERSION}.tar.gz; \
    if [ -f ${CACHED_YARN} ]; then \
      npm install -g ${CACHED_YARN}; \
    else \
      echo "need yarn at ${CACHED_YARN}"; \
      exit 1; \
    fi

# use dependencies provided by Cachito
ENV HUSKY=0
RUN test -d ${REMOTE_SOURCES_DIR}/cachito-gomod-with-deps || exit 1; \
    cp -f $REMOTE_SOURCES_DIR/cachito-gomod-with-deps/app/{.npmrc,.yarnrc,yarn.lock,registry-ca.pem} . \
 && source ${REMOTE_SOURCES_DIR}/cachito-gomod-with-deps/cachito.env \
 && yarn && yarn build

FROM registry.redhat.io/ubi8/nginx-120:1-84.1675799502

USER 1001

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

ENTRYPOINT ["nginx", "-g", "daemon off;"]
