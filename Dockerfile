FROM node:24-bookworm-slim AS dependencies

WORKDIR /opt/pc-price-tracker

RUN corepack enable
RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM dependencies AS build

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:24-bookworm-slim AS production-dependencies

WORKDIR /opt/pc-price-tracker

RUN corepack enable
RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

FROM node:24-bookworm-slim AS runtime

WORKDIR /opt/pc-price-tracker
ENV NODE_ENV=production

COPY --from=production-dependencies /opt/pc-price-tracker/node_modules ./node_modules
COPY --from=build /opt/pc-price-tracker/dist ./dist
COPY package.json ./

RUN mkdir -p /opt/pc-price-tracker/data \
  && chown -R node:node /opt/pc-price-tracker

USER node

CMD ["node", "dist/main.js"]
