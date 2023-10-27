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

FROM registry.redhat.io/ubi8/nginx-120:1-84.1675799502

USER 1001

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

ENTRYPOINT ["nginx", "-g", "daemon off;"]
