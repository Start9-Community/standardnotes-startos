FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a

RUN apk add --no-cache g++ make python3 openssl bash

WORKDIR /opt/server

COPY server/ ./

# Keep native dependency installation and the server on the same Node runtime.
RUN corepack enable && \
    yarn install --immutable && \
    CI=true yarn build

# The home server keeps its data at ${__dirname}/../data of dist/bin/server.js.
RUN rm -rf packages/home-server/dist/data && ln -s /data packages/home-server/dist/data

COPY activate-premium.js packages/home-server/
