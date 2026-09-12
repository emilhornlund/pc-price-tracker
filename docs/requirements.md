# PC Price Tracker

## 1. Purpose

PC Price Tracker is a small self-hosted service for monitoring prices of explicitly configured Prisjakt product pages.

The application periodically scrapes each configured product URL, records the prices offered by individual stores, detects price decreases, and sends a single consolidated email after the scan when decreases have been detected.

The project should intentionally remain small and focused.

---

## 2. Goals

The application must:

1. Track individual Prisjakt products.
2. Use explicitly configured Prisjakt product URLs.
3. Scrape individual Prisjakt product pages.
4. Extract:

   - Product title.
   - Store.
   - Price.

5. Persist price observations in a database.
6. Run automatically a few times per day.
7. Detect price decreases between scans.
8. Finish scanning all configured products before sending notifications.
9. Send at most one consolidated email per scan.
10. Include all detected price decreases from that scan in the email.
11. Be configured through a YAML file.
12. Support embedding the YAML configuration directly in Docker Compose.
13. Run as a Docker container.
14. Have automated tests, builds, and Docker image publishing through GitHub Actions.

---

## 3. Non-Goals

The initial implementation should **not** include:

- Prisjakt search result scraping.
- Automatic product discovery.
- Category searches.
- Product recommendation functionality.
- A web UI.
- User accounts.
- Multiple scraper/provider abstractions.
- Complex job queues.
- Distributed processing.
- External scheduling infrastructure.
- Price prediction.
- Favorite-store functionality.
- REST APIs unless a concrete need appears later.

The first version should solve one problem well:

> Track prices for a small configured list of Prisjakt product pages.

---

# 4. Product Configuration

Products are configured as Prisjakt product URLs.

Example:

```yaml
products:
  - https://www.prisjakt.nu/produkt.php?p=13438192
  - https://www.prisjakt.nu/produkt.php?p=12345678
```

The product title does not need to be configured manually.

It should be discovered from the Prisjakt product page and persisted by the application.

The configured URL is the stable identity used to identify a tracked product.

Duplicate URLs should be rejected during configuration validation.

---

# 5. Price Scraping

For every configured product URL, the application should:

1. Fetch the Prisjakt product page.
2. Parse the product title.
3. Parse the currently available store offers.
4. Extract for each offer:

   - Store name.
   - Price.

5. Normalize the price into an integer number of Swedish öre or another precise integer representation.
6. Persist the resulting observations.

Example conceptual result:

```text
Product:
Corsair Vengeance DDR5 32GB

Offers:
Inet          1,499 SEK
Webhallen     1,549 SEK
Proshop       1,429 SEK
```

All available store prices should be retained.

The system must **not** reduce a product to only its lowest price when storing data.

This is important because historical data should later support questions such as:

- How has the price changed at Inet?
- Which stores usually have the best price?
- Which stores should be preferred?
- What was the lowest price during a particular period?

---

# 6. Scan Lifecycle

A scan represents one complete run across all configured products.

The lifecycle should be:

```text
Start scan

    ↓

Load configuration

    ↓

Fetch product 1
Parse offers
Persist observations

    ↓

Fetch product 2
Parse offers
Persist observations

    ↓

...

    ↓

All products processed

    ↓

Evaluate detected decreases

    ↓

Send one email if necessary

    ↓

Finish scan
```

Email notification must happen **after all configured products have been processed**.

The application must not send one email per product.

---

# 7. Price History

Every successful price observation should be persisted.

A price observation belongs to:

- One product.
- One store.
- One scan/time.
- One price.

Conceptually:

```text
product
store
price
observed_at
```

Example:

```text
Corsair Vengeance DDR5 32GB
Inet
149900
2026-09-12T07:00:00Z
```

The database should retain historical observations rather than overwriting the previous price.

This allows later aggregation and historical analysis without changing the scraper.

---

# 8. Price Change Detection

Price decreases should initially be detected **per product and store**.

For each store offer:

```text
current price < previous observed price
```

means that a decrease occurred.

Example:

```text
Previous scan:

Inet
1,599 SEK

Current scan:

Inet
1,499 SEK
```

Detected decrease:

```text
1,599 - 1,499 = 100 SEK
```

A price increase does not trigger an email.

An unchanged price does not trigger an email.

---

## 8.1 First Observation

The first time a product/store combination is observed, there is no previous price.

The first observation establishes the baseline.

It must therefore:

- Be persisted.
- Not trigger a price-decrease notification.

---

## 8.2 New Stores

If a new store appears for an already tracked product, its first observation is also treated as a baseline.

It should not be considered a decrease simply because the store was not present previously.

---

# 9. Notifications

After all products have been scanned, the application should collect every detected price decrease.

If there are no decreases:

```text
Do not send an email.
```

If one or more decreases exist:

```text
Send exactly one email containing all decreases.
```

Example:

```text
PC Price Tracker

3 prices have decreased.

Corsair Vengeance DDR5 32GB
Inet
New price: 1,499 SEK
Decrease: 100 SEK

AMD Ryzen 7 9800X3D
Proshop
New price: 4,799 SEK
Decrease: 200 SEK

Samsung 990 Pro 2TB
Webhallen
New price: 1,599 SEK
Decrease: 150 SEK
```

Each notification entry must contain at minimum:

- Product title.
- New price.
- Price decrease.

Because price tracking is store-specific, the email should also include the store name.

---

# 10. Notification State

The database should preserve enough state to prevent duplicate notifications and allow notification behaviour to be audited.

The minimum useful notification information is:

```text
product
store
previous_price
new_price
notified_at
```

Optionally, a dedicated state may also contain:

```text
last_notified_price
```

However, **price decrease detection should initially be based on the previous successful observation**, not on the historical minimum or some global product price.

This keeps the behaviour predictable:

```text
1599 → 1499
```

triggers a notification.

Then:

```text
1499 → 1499
```

does not.

And:

```text
1499 → 1399
```

triggers another notification.

---

# 11. Database

The initial application should use **SQLite**.

Reasons:

- Single application instance.
- Very small data volume.
- No database server to maintain.
- Easy Docker persistence.
- Supports historical price queries.
- Easy backup.
- Can be replaced later if necessary.

Suggested database location:

```text
/opt/pc-price-tracker/data/pc-price-tracker.db
```

The Docker deployment should mount this directory as persistent storage.

---

# 12. Data Model

The exact implementation may evolve, but the initial model should remain small.

## Products

```text
id
url
title
created_at
updated_at
```

The URL should be unique.

---

## Price Observations

```text
id
product_id
store
price
observed_at
```

This table contains the historical store-specific prices.

Example:

```text
product_id: 42
store: Inet
price: 149900
observed_at: 2026-09-12T07:00:00Z
```

---

## Notifications

Notification records may be persisted for successful notifications.

Example:

```text
id
sent_at
```

Individual changes associated with the notification can contain:

```text
notification_id
product_id
store
previous_price
new_price
```

This provides an audit trail of what was actually included in each email.

The schema should remain minimal and should only grow when concrete requirements require it.

---

# 13. Scheduling

The application should contain its own lightweight scheduler.

A schedule should be configurable through YAML.

Example:

```yaml
schedule:
  cron: '0 7,19 * * *'
  timezone: 'Europe/Stockholm'
```

This example scans twice per day:

```text
07:00
19:00
```

The application should also support running a scan immediately when explicitly invoked, making local development and testing easier.

Only one scan should execute at a time.

If a previous scan is still running when another scheduled execution is reached, overlapping scans should be prevented.

---

# 14. YAML Configuration

The complete non-secret application configuration should live in one YAML file.

Example:

```yaml
products:
  - https://www.prisjakt.nu/produkt.php?p=13438192
  - https://www.prisjakt.nu/produkt.php?p=12345678

schedule:
  cron: '0 7,19 * * *'
  timezone: 'Europe/Stockholm'

notifications:
  email:
    enabled: true
    recipients:
      - 'emil.hornlund@me.com'
    from: 'emil.hornlund@me.com'

    smtp:
      host: 'smtp.mail.me.com'
      port: 587
      secure: false
      usernameEnv: 'SMTP_USERNAME'
      passwordEnv: 'SMTP_PASSWORD'
      timeoutSeconds: 30
```

The configuration must be validated at startup.

Invalid configuration should cause the application to fail immediately with a useful error message.

Examples:

- No products configured.
- Invalid product URL.
- Duplicate product URL.
- Email enabled but no recipient configured.
- Missing SMTP configuration.
- Invalid cron expression.

---

# 15. Secrets

Secrets must **not** be stored directly in `config.yaml`.

The YAML file should instead reference environment variable names:

```yaml
usernameEnv: 'SMTP_USERNAME'
passwordEnv: 'SMTP_PASSWORD'
```

The application resolves these environment variables at startup.

Example Docker environment:

```env
SMTP_USERNAME=example@example.com
SMTP_PASSWORD=secret
```

Missing required secrets should result in a startup error when email notifications are enabled.

---

# 16. Docker

The service must run as a Docker container.

Suggested application paths:

```text
/opt/pc-price-tracker/config.yaml
/opt/pc-price-tracker/data/
```

The Docker image should:

- Use a maintained Node.js LTS runtime.
- Build TypeScript during image creation.
- Run compiled JavaScript in production.
- Contain only production dependencies in the final image where practical.
- Run as a non-root user.
- Persist the SQLite database outside the container filesystem.

---

# 17. Docker Compose

The configuration should support Docker Compose `configs.content`.

Example:

```yaml
services:
  pc-price-tracker:
    image: emils-nuc-server:5000/pc-price-tracker:latest
    container_name: pc-price-tracker
    restart: unless-stopped

    env_file:
      - ./stack.env

    configs:
      - source: pc-price-tracker-config
        target: /opt/pc-price-tracker/config.yaml

    volumes:
      - pc-price-tracker-data:/opt/pc-price-tracker/data

    networks:
      - core-network

configs:
  pc-price-tracker-config:
    content: |
      products:
        - https://www.prisjakt.nu/produkt.php?p=13438192

      schedule:
        cron: "0 7,19 * * *"
        timezone: "Europe/Stockholm"

      notifications:
        email:
          enabled: true
          recipients:
            - "emil.hornlund@me.com"

          from: "emil.hornlund@me.com"

          smtp:
            host: "smtp.mail.me.com"
            port: 587
            secure: false
            usernameEnv: "SMTP_USERNAME"
            passwordEnv: "SMTP_PASSWORD"
            timeoutSeconds: 30

volumes:
  pc-price-tracker-data:

networks:
  core-network:
    external: true
```

This makes the complete application configuration visible and editable from the infrastructure repository while keeping secrets in `stack.env`.

---

# 18. Technology Stack

The project should use the following technologies and tooling.

## Application

- Node.js
- TypeScript

## Package Management

- Yarn

Yarn is the required package manager for local development, dependency installation, tests, builds, GitHub Actions, and Docker image builds.

The committed `yarn.lock` file is authoritative for dependency resolution.

Do not use npm commands or generate `package-lock.json`.

## HTTP and HTML Parsing

- Node.js built-in `fetch`
- Cheerio

Use the built-in `fetch` API for retrieving Prisjakt product pages.

Use Cheerio for parsing the returned HTML.

Do not introduce another HTTP client unless a concrete requirement justifies it.

## Configuration

- YAML

Use a small YAML library for reading `config.yaml`.

Configuration must be mapped into strongly typed TypeScript structures and validated at startup.

## Database

- SQLite

Use a lightweight SQLite library.

Do not introduce an ORM unless later requirements justify one.

## Email

- Nodemailer

Use Nodemailer for SMTP email delivery.

Do not implement custom SMTP protocol handling.

## Scheduling

Use a small established cron scheduling library.

Do not implement cron parsing manually.

## Testing

- Jest

Tests should primarily cover:

- Prisjakt HTML parsing.
- Price normalization.
- Price change detection.
- Configuration parsing and validation.
- Email content generation.
- Database persistence.
- Scan orchestration.

Real Prisjakt requests should not normally be required for automated tests.

Representative HTML fixtures should be stored under `tests/fixtures/`.

## Code Quality

- ESLint
- Prettier
- TypeScript compiler

The repository should expose predictable Yarn commands such as:

    yarn build
    yarn lint
    yarn format:check
    yarn typecheck
    yarn test

## Deployment and CI

- Docker
- Docker Compose
- GitHub Actions

Docker must be used for production deployment.

GitHub Actions must run project validation and build/publish the Docker image as defined by the CI requirements.

---

# 19. Suggested Project Structure

Keep the structure shallow.

Example:

```text
src/
  main.ts

tests/
  fixtures/

config.example.yaml

Dockerfile
package.json
tsconfig.json
eslint.config.js
.prettierrc
README.md
```

Avoid creating additional architectural layers unless they solve an actual problem.

---

# 20. Error Handling

A failure while scraping one product should not prevent the remaining configured products from being scanned.

Example:

```text
Product A → success
Product B → failed
Product C → success
```

Product C must still be processed.

Failures should be logged clearly.

A failed scrape must **not** be interpreted as:

```text
price = 0
```

or as a product/store disappearing in price.

Only successfully parsed observations should participate in price comparison.

---

# 21. Email Failure

Price observations should be persisted before notification is attempted.

If SMTP delivery fails:

- The scan results must remain stored.
- The failure must be logged.
- The application must not falsely record the email as successfully sent.

The implementation should maintain enough notification state that notification behaviour can later be made retry-safe without redesigning price history.

---

# 22. Logging

Logging should remain simple.

Each scan should log:

```text
Scan started
Products configured
Product being processed
Number of store offers discovered
Detected decreases
Email sent / skipped / failed
Scan completed
```

Errors should contain enough context to identify the affected product URL.

Verbose HTML or secrets must never be logged.

---

# 23. GitHub Actions

GitHub Actions should validate every pull request.

The CI workflow should run:

```text
Install dependencies
Lint
Formatting check
Type check
Tests
Build
```

The project should also have a Docker workflow.

On the chosen release branch/tag strategy it should:

```text
Build Docker image
Tag Docker image
Push Docker image to the configured registry
```

The workflow structure should follow the conventions already established in the other repositories where practical, particularly `klurigo` and the infrastructure repository.

---

# 24. Behaviour Summary

For a normal scheduled execution:

```text
1. Scheduler starts a scan.

2. Application reads all configured Prisjakt URLs.

3. Each product page is fetched.

4. Product title and all current store prices are parsed.

5. Current observations are compared with the previous observations.

6. New observations are persisted.

7. Any store-specific price decreases are collected.

8. Remaining products are scanned.

9. After every configured product has been attempted:

   - No decreases:
       No email.

   - One or more decreases:
       Send one consolidated email.

10. Successful notification information is persisted.

11. Scan completes.
```

---

# 25. Example

Configured product:

```yaml
products:
  - https://www.prisjakt.nu/produkt.php?p=13438192
```

Previous observations:

```text
Inet       1,599 SEK
Proshop    1,549 SEK
Webhallen  1,599 SEK
```

New scan:

```text
Inet       1,499 SEK
Proshop    1,549 SEK
Webhallen  1,549 SEK
```

Detected changes:

```text
Inet
1,599 → 1,499
Decrease: 100 SEK

Webhallen
1,599 → 1,549
Decrease: 50 SEK
```

Email:

```text
Subject: PC Price Tracker — 2 price decreases

Corsair Vengeance DDR5 32GB

Inet
New price: 1,499 SEK
Decrease: 100 SEK

Webhallen
New price: 1,549 SEK
Decrease: 50 SEK
```

The database retains all six historical price observations.

---

# 26. Design Principles

The implementation should follow these principles:

### Keep configuration explicit

Products are deliberately added to YAML.

There is no product discovery.

### Preserve raw price history

Do not store only the cheapest offer.

Each store's price is independently tracked.

### Keep notification logic separate from history

Historical observations represent what was seen.

Notifications represent which changes were communicated.

### Prefer boring infrastructure

Use:

```text
TypeScript
Cheerio
SQLite
Nodemailer
YAML
Jest
Docker
GitHub Actions
```

instead of building abstractions that are not currently needed.

### Add complexity only when required

Future functionality such as:

- Favorite stores.
- Historical charts.
- Price thresholds.
- More retailers.
- Web UI.
- Multiple notification mechanisms.

can be built using the stored historical data without complicating version 1.

---

# 27. Definition of Version 1

Version 1 is complete when the application can:

- Read configured Prisjakt URLs from YAML.
- Read SMTP configuration from the same YAML.
- Scrape each individual product page.
- Discover the product title.
- Discover store-specific prices.
- Persist historical store prices in SQLite.
- Run several times per day automatically.
- Compare current prices with the previous scan.
- Detect store-specific price decreases.
- Finish the complete scan before notifying.
- Send one email containing every decrease detected in the scan.
- Run entirely in Docker.
- Persist its database through a Docker volume.
- Accept its YAML configuration through Docker Compose `configs`.
- Keep credentials in environment variables.
- Pass linting, formatting, type checking, tests, and build in GitHub Actions.
- Build and publish its Docker image automatically.

Anything beyond this belongs to a later version unless implementation experience proves that it is required for correctness.
