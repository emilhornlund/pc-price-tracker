# PC Price Tracker

PC Price Tracker is a small self-hosted service that monitors explicitly
configured Prisjakt product pages. It stores each store's price history in
SQLite and sends one consolidated email after a scan for first observations
and price decreases.

## Requirements

- Node.js 24 LTS for local development
- Yarn 1 (the repository pins Yarn through `packageManager`)
- Docker for production deployment

## Local setup

Install dependencies with Yarn:

```sh
corepack enable
```

Copy `config.example.yaml` to `config.yaml` and add the Prisjakt product URLs
to monitor. `config.yaml` is intentionally ignored by Git.

When email is enabled, configure the environment variables named by
`notifications.email.smtp.usernameEnv` and `passwordEnv`:

```sh
export SMTP_USERNAME='example@example.com'
export SMTP_PASSWORD='replace-me'
```

SMTP credentials are never read from or stored in the YAML file.

## Running

Run one scan immediately:

```sh

```

Use another YAML file for local testing with:

```sh

```

Without `--scan`, the application starts its built-in scheduler using the
configured cron expression and timezone and stays running between scans.

The default local database is `data/pc-price-tracker.db` when the application
is started from the project directory. Production uses
`/opt/pc-price-tracker/data/pc-price-tracker.db`.

## Development commands

```sh

```

Tests use isolated SQLite databases and checked-in Prisjakt HTML fixtures; they
do not require live Prisjakt requests.

## Docker

Build the production image:

```sh

```

The image runs as the non-root `node` user from `/opt/pc-price-tracker` and
expects configuration at `/opt/pc-price-tracker/config.yaml`. The database is
stored below `/opt/pc-price-tracker/data/`.

`compose.example.yaml` demonstrates the production deployment model:

- inline Docker Compose `configs.content` for the YAML configuration;
- `stack.env` for SMTP credentials;
- the persistent `pc-price-tracker-data` volume; and
- the existing external `core-network`.

Create `stack.env` from `.env.example`, configure the registry image and
network for the host, then run:

```sh

```

Do not commit `stack.env` or any file containing credentials.

## Further documentation

- [Requirements](docs/requirements.md)
- [Implementation tasks](docs/tasks.md)
