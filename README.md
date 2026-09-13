# PC Price Tracker

[![CI](https://github.com/emilhornlund/pc-price-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/emilhornlund/pc-price-tracker/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)](package.json)
[![Yarn 1.22.22](https://img.shields.io/badge/Yarn-1.22.22-2C8EBB?logo=yarn&logoColor=white)](package.json)

> A self-hosted Prisjakt price tracker for explicitly configured product URLs.

PC Price Tracker scans configured products once on startup and then according to
the configured schedule. It tracks each store independently, persists every
successful price observation in SQLite, and sends one consolidated email for
first-observed prices and price decreases.

---

## Overview

The application is a small, long-lived Docker service with no web UI or product
discovery. A scan completes across all configured products before relevant
notification events are collected and sent in a single email.

## Quick Start

Local development requires Node.js 24 and Yarn 1.22.22 through Corepack.

```sh
git clone git@github.com:emilhornlund/pc-price-tracker.git
cd pc-price-tracker
corepack enable
yarn install --frozen-lockfile
```

Copy the repository examples, then edit the files for your products and SMTP
account:

```sh
cp config.example.yaml config.yaml
cp .env.example .env
```

Build and start normal scheduled mode:

```sh
yarn build
yarn start
```

The service performs an initial scan and remains running for scheduled scans. To
run one scan and exit instead:

```sh
node dist/main.js --scan
```

## Configuration

`config.yaml` contains the non-secret application configuration. Start from
[`config.example.yaml`](config.example.yaml) and configure:

- Explicit Prisjakt product URLs under `products`.
- A five-field cron expression and IANA timezone under `schedule`.
- Email recipients, sender, and SMTP connection details under
  `notifications.email`.

The YAML file contains the names of the SMTP environment variables, not their
values. Put those values in the environment or in a local `.env` file created
from [`.env.example`](.env.example); `.env` is ignored by Git.

## Development

Run the project checks with:

```sh
yarn lint
yarn format:check
yarn typecheck
yarn test
yarn build
```

Tests use isolated SQLite databases and checked-in Prisjakt HTML fixtures, so
they do not require live Prisjakt requests.

## Docker / Deployment

Build the production image from the repository root:

```sh
docker build --tag pc-price-tracker .
```

The image runs as the non-root `node` user from `/opt/pc-price-tracker`. Supply
configuration and SMTP environment variables externally, and persist the
SQLite data directory with a Docker volume:

```sh
docker volume create pc-price-tracker-data
docker run --detach --restart unless-stopped \
  --name pc-price-tracker \
  --env-file .env \
  --mount type=bind,source="$PWD/config.yaml",target=/opt/pc-price-tracker/config.yaml,readonly \
  --mount type=volume,source=pc-price-tracker-data,target=/opt/pc-price-tracker/data \
  pc-price-tracker
```

The container expects the YAML configuration at
`/opt/pc-price-tracker/config.yaml` and stores the database at
`/opt/pc-price-tracker/data/pc-price-tracker.db`. Persist the entire
`/opt/pc-price-tracker/data` directory; otherwise the SQLite history is lost
when the container is replaced.

## Documentation

- [Requirements](docs/requirements.md)

---

## License

PC Price Tracker is licensed under the MIT License. See [`LICENSE`](LICENSE) for
the complete terms.
