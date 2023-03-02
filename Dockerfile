FROM registry.redhat.io/ubi8/nodejs-16:1-82.1675799501 AS builder

WORKDIR /usr/src/app

ENV HUSKY=0

COPY package.json yarn.lock .
RUN yarn

COPY ./console-extensions.json ./tsconfig.json ./webpack.config.ts .
COPY ./src ./src
RUN yarn build

FROM registry.redhat.io/ubi8/nginx-120:1-84.1675799502

USER 1001

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

ENTRYPOINT ["nginx", "-g", "daemon off;"]
