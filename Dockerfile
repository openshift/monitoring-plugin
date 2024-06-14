FROM registry.redhat.io/ubi8/nodejs-18:1-71.1698060565 AS builder

WORKDIR /usr/src/app

RUN npm install --global yarn

ENV HUSKY=0

COPY package.json yarn.lock .
RUN yarn

COPY ./console-extensions.json ./tsconfig.json ./webpack.config.ts .
COPY ./locales ./locales
COPY ./src ./src
RUN yarn build

FROM registry.ci.openshift.org/ocp/4.17:base-rhel9

RUN INSTALL_PKGS="nginx" && \
    dnf install -y --setopt=tsflags=nodocs $INSTALL_PKGS && \
    rpm -V $INSTALL_PKGS && \
    yum -y clean all --enablerepo='*' && \
    chown -R 1001:0 /var/lib/nginx /var/log/nginx /run && \
    chmod -R ug+rwX /var/lib/nginx /var/log/nginx /run

USER 1001

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

ENTRYPOINT ["nginx", "-g", "daemon off;"]
