# PC Price Tracker — Implementation Tasks

This document defines the implementation tasks required to complete version 1 of PC Price Tracker.

Tasks are ordered deliberately. Each task should leave the project in a working state and should be completed before moving to the next task.

The requirements in `docs/requirements.md` are authoritative.

---

## [X] 1. Set up the TypeScript project

Initialize the project as a Yarn-based Node.js and TypeScript application.

Implement:

- Use Yarn as the package manager.
- Commit `yarn.lock`.
- Add TypeScript.
- Add the Node.js type definitions.
- Create `tsconfig.json`.
- Use `src/main.ts` as the application entry point.
- Configure compilation into `dist/`.
- Add the initial scripts:

  - `yarn build`
  - `yarn start`
  - `yarn typecheck`

- Update `.gitignore` as necessary.
- Ensure the compiled application can start successfully.

Do not add application functionality yet.

Verification:

```text
yarn install
yarn typecheck
yarn build
yarn start
```

---

## [X] 2. Add ESLint and Prettier

Establish the project's code-quality tooling before application code grows.

Implement:

- Add ESLint with TypeScript support.
- Add Prettier.
- Add appropriate configuration files.
- Make ESLint and Prettier compatible with each other.
- Add scripts:

  - `yarn lint`
  - `yarn format`
  - `yarn format:check`

- Apply the formatting rules to the existing project.

Verification:

```text
yarn lint
yarn format:check
yarn typecheck
yarn build
```

---

## [X] 3. Add Jest test infrastructure

Set up the project's automated test infrastructure.

Implement:

- Add Jest with TypeScript support.
- Add Jest configuration.
- Establish a clear location/naming convention for tests.
- Add the `yarn test` script.
- Add one minimal test proving that the setup works.

Do not add Prisjakt functionality yet.

Verification:

```text
yarn test
yarn lint
yarn format:check
yarn typecheck
yarn build
```

---

## [X] 4. Define and load YAML configuration

Implement application configuration loading from a YAML file.

The configuration must support:

```yaml
products:
  - https://www.prisjakt.nu/produkt.php?p=13438192

schedule:
  cron: '0 7,19 * * *'
  timezone: 'Europe/Stockholm'

notifications:
  email:
    enabled: true
    recipients:
      - 'example@example.com'
    from: 'example@example.com'
    smtp:
      host: 'smtp.example.com'
      port: 587
      secure: false
      usernameEnv: 'SMTP_USERNAME'
      passwordEnv: 'SMTP_PASSWORD'
      timeoutSeconds: 30
```

Implement:

- Add YAML parsing.
- Define strongly typed configuration structures.
- Load configuration from a predictable path.
- Support an explicit config path where useful for local development/testing.
- Add `config.example.yaml`.
- Ensure `config.yaml` remains ignored by Git.
- Add tests for successful configuration loading.

Do not resolve SMTP secrets yet.

---

## [X] 5. Validate application configuration

Add startup validation for the YAML configuration.

Validate at minimum:

- At least one product is configured.
- Every product is a valid Prisjakt product URL.
- Duplicate product URLs are rejected.
- Schedule configuration is present and valid.
- Email recipients are present when email is enabled.
- Sender is present when email is enabled.
- SMTP host and port are valid when email is enabled.
- SMTP username/password environment variable names are configured when email is enabled.
- Cron configuration is valid.
- Timezone configuration is valid.

Startup must fail with a useful error message when configuration is invalid.

Add tests for both valid and invalid configuration.

---

## [X] 6. Resolve configuration secrets from environment variables

Implement SMTP secret resolution.

Given:

```yaml
usernameEnv: 'SMTP_USERNAME'
passwordEnv: 'SMTP_PASSWORD'
```

the application should resolve:

```text
SMTP_USERNAME
SMTP_PASSWORD
```

from the process environment.

Implement:

- Resolve configured secret environment variables.
- Fail clearly at startup when required secrets are missing and email is enabled.
- Do not log secret values.
- Add tests for successful and failed secret resolution.

---

## [X] 7. Fetch an individual Prisjakt product page

Implement the smallest possible HTTP client for configured product pages.

Implement:

- Use the built-in Node.js `fetch`.
- Fetch a configured Prisjakt product URL.
- Handle non-success HTTP responses.
- Use a sensible request timeout.
- Return the fetched HTML.
- Provide enough error context to identify the product URL.
- Do not parse the page in this task.

Add unit tests by mocking HTTP behavior where practical.

Also perform a manual local fetch against one real configured Prisjakt product page to confirm that the request works.

---

## [X] 8. Review and prepare real Prisjakt HTML fixtures

Before implementing parsing, inspect actual Prisjakt product page HTML.

Implement:

- Review the existing real Prisjakt fixture under `tests/fixtures/`.
- Fetch additional representative product pages only if the existing fixture is insufficient.
- Inspect how the product title is represented.
- Inspect how store offers are represented.
- Inspect how prices are represented.
- Inspect whether each store offer exposes a stable Prisjakt store identifier that can be persisted independently of the store name.
- Identify any embedded structured data that is more stable than presentation markup.
- Keep representative HTML fixture(s) under the test fixtures directory.
- Remove irrelevant bulk content from fixtures only when doing so does not alter the structures being tested.

Fixtures should represent the real page structures that the parser depends on.

Do not design speculative fields beyond:

- Product title.
- Store.
- Price.

---

## [X] 9. Parse the product title

Implement title parsing using Cheerio.

Implement:

- Add Cheerio.
- Accept HTML as parser input.
- Extract the Prisjakt product title.
- Normalize whitespace.
- Return a clear error if the title cannot be found.
- Do not perform HTTP requests inside the parser.

Add fixture-based tests.

---

## [X] 10. Parse store offers

Extend the Prisjakt parser to extract all currently available store offers.

Each parsed offer must contain:

```text
store
price
```

Implement:

- Extract every valid store offer from the product page.
- Preserve the store name.
- Parse the displayed price.
- Ignore entries that are not actual store offers.
- Do not reduce the result to the cheapest offer.
- Return all parsed offers.

Add fixture-based tests verifying multiple stores.

---

## [X] 11. Normalize monetary values

Define one canonical internal price representation.

Use an integer representation, preferably Swedish öre:

```text
1499 SEK -> 149900
```

Implement:

- Parse Prisjakt price formats reliably.
- Handle Swedish thousands/decimal formatting where present.
- Reject malformed prices instead of silently converting them.
- Add focused tests for price parsing and normalization.

No floating-point monetary values should be stored in the database.

---

## [X] 12. Define the Prisjakt parsed product model

Introduce the minimal parsed representation used by the scanner.

Example:

```ts
{
  title: "...",
  offers: [
    {
      store: "...",
      price: 149900
    }
  ]
}
```

Implement:

- Appropriate TypeScript types.
- Keep the parser independent from database code.
- Keep HTTP fetching independent from parsing.
- Ensure parsing tests cover the complete parsed representation.

Do not add generic provider abstractions.

---

## [X] 13. Add SQLite database infrastructure

Introduce SQLite persistence.

Implement:

- Add a lightweight SQLite library.
- Open/create the database on application startup.
- Make the database path configurable internally with the production default:

```text
/opt/pc-price-tracker/data/pc-price-tracker.db
```

- Allow tests to use isolated temporary/in-memory databases.
- Add deterministic schema initialization.
- Ensure database resources are closed correctly.

Do not introduce an ORM.

---

## [X] 14. Create the products table

Implement persistence for tracked products.

The table should contain at minimum:

```text
id
url
title
created_at
updated_at
```

Requirements:

- Product URL is unique.
- A product can be created from a configured URL.
- Its scraped title can be updated.
- Repeated scans must reuse the existing product row.

Add repository/database tests.

---

## [X] 15. Create the stores table

Implement persistence for stores discovered from Prisjakt offers.

The table should contain at minimum:

```text
id
name
created_at
updated_at
```

Requirements:

- `id` is the unique primary key for each store.
- Store names are not required to be unique.
- Do not add a unique constraint to `name`.
- A store can be created from a parsed Prisjakt offer.
- Keep store persistence independent from product persistence.

Add repository/database tests.

---

## [X] 16. Create the price observations table

Implement historical store-specific price persistence.

The table should contain at minimum:

```text
id
product_id
store_id
price
observed_at
```

Requirements:

- `product_id` references the tracked product.
- `store_id` references the store from the `stores` table.
- Store names must not be duplicated into the price observations table.

Implement:

- Insert observations using `product_id` and `store_id`.
- Query the most recent observation for a product/store pair through their ids.
- Query historical observations where useful for tests.
- Preserve every successful observation rather than updating existing history.

Add repository/database tests.

---

## [X] 17. Persist one scraped product

Connect fetching, parsing, and persistence for a single product.

For one configured URL:

1. Fetch the page.
2. Parse its title and offers.
3. Find or create the product.
4. Update its title.
5. For each parsed offer, find or create the corresponding store.
6. Persist the price observation using the product id and store id.

Requirements:

- Repeated scans must reuse existing product rows.
- Do not assume that store names are globally unique when resolving stores.
- Price observations must reference stores through `store_id`.
- Do not duplicate the store name into the price observations table.

Add integration-style tests around the orchestration using fixture HTML and an isolated database.

Do not add notifications yet.

---

## [X] 18. Implement price decrease detection

Implement comparison against the previous successful observation for the same product and store, resolved through `product_id` and `store_id`.

Rules:

```text
No previous observation
→ establish baseline
→ first-observed event

Current == previous
→ no decrease

Current > previous
→ no decrease

Current < previous
→ decrease
```

A detected change should contain at minimum:

```text
product
store
previousPrice
newPrice
decrease
```

Add focused unit tests for all cases.

---

## [X] 19. Ensure observations are compared before insertion

Make scan ordering explicit.

For each product/store offer:

1. Read the previous observation.
2. Compare the new price against it.
3. Determine whether a decrease occurred.
4. Persist the new observation.

This prevents the newly inserted row from accidentally becoming the comparison baseline.

Add regression tests for repeated scans.

---

## [X] 20. Handle newly appearing stores correctly

Implement behavior for stores that appear after earlier product scans.

A previously unseen store must:

- Be created in the `stores` table if it does not already exist.
- Be referenced from the new price observation through `store_id`.
- Establish its initial baseline for that product.
- Produce a first-observed event, not a price decrease.

Add a regression test covering this scenario.

---

## [X] 21. Implement full multi-product scans

Create the scan orchestration that processes every configured product.

A scan must:

1. Iterate through all configured product URLs.
2. Fetch each product.
3. Parse each product.
4. Persist its observations.
5. Collect all detected price events.
6. Continue until every configured product has been attempted.
7. Return one aggregate scan result.

The scan result should distinguish:

- Successful products.
- Failed products.
- Detected price events.

Do not send email inside individual product processing.

---

## [X] 22. Make individual product failures non-fatal to the scan

One broken product must not abort the entire run.

Example:

```text
Product A -> success
Product B -> failure
Product C -> success
```

Product C must still execute.

Implement:

- Catch failures at the individual product boundary.
- Log the failing URL and error.
- Continue processing remaining products.
- Include failure information in the aggregate scan result.
- Never persist a synthetic zero price for a failed scrape.

Add tests covering partial scan failure.

---

## [X] 23. Add structured scan logging

Add simple useful application logging.

Log at minimum:

- Scan started.
- Number of configured products.
- Product URL being processed.
- Product title when available.
- Number of offers parsed.
- Number of price events detected.
- Individual product failures.
- Email skipped/sent/failed.
- Scan completed.

Requirements:

- Do not log HTML bodies.
- Do not log SMTP credentials.
- Avoid introducing a large logging framework unless necessary.

---

## [X] 24. Build email content from price events

Implement pure email content generation.

Input:

```text
list of detected price events
```

Output:

```text
subject
text body
```

Each decrease must include:

- Product title.
- Store.
- New price.
- Price decrease.

Each first-observed event must include:

- Product title.
- Store.
- Current price.
- First-observed status.

The email should represent all price events from the completed scan.

Add snapshot or exact-content unit tests.

Do not send email yet.

---

## [X] 25. Add SMTP email delivery

Implement email sending using Nodemailer.

Implement:

- Create the SMTP transport from resolved configuration.
- Support configured:

  - Host.
  - Port.
  - Secure mode.
  - Username.
  - Password.
  - Timeout.

- Use configured sender and recipients.
- Send generated subject/body.
- Surface delivery failures clearly.

Do not implement custom SMTP handling.

Add tests by mocking the transport.

---

## [X] 26. Send one consolidated notification after a scan

Integrate notifications with scan execution.

After all products have been attempted:

```text
0 price events
→ do not send email

1+ price events
→ send exactly one email
```

The email must contain every price event collected during that scan.

Ensure:

- No email is sent while the scan is still processing products.
- No individual product produces its own email.
- Partial product failures do not prevent decreases from successful products from being emailed.

Add orchestration tests.

---

## [X] 27. Add notification persistence

Create minimal persistence for successfully sent notifications.

Persist enough information to know:

- When the notification was sent.
- Which price events were included.
- Product.
- Store.
- Previous price.
- New price.
- Current price for first-observed events.

Suggested model:

```text
notifications
notification_changes
```

Only mark a notification as successfully sent after SMTP delivery succeeds.

Add database tests.

---

## [X] 28. Make notification failure safe

Ensure SMTP failure does not corrupt scan history.

Required behavior:

1. Price observations remain persisted.
2. SMTP delivery is attempted.
3. If delivery fails:

   - Log the failure.
   - Do not record the notification as successfully sent.
   - Do not roll back valid price observations.

Add a regression test.

Keep the design simple while preserving enough state for later retry improvements.

---

## [X] 29. Implement manual scan execution

Provide a simple way to execute a scan immediately.

This should be useful for:

- Local development.
- Docker testing.
- Troubleshooting.
- CI/integration verification.

Example behavior may be exposed through a command such as:

```text
yarn start --scan
```

or another simple CLI convention.

Do not add an HTTP API.

---

## [X] 30. Add scheduled scan execution

Implement the built-in scheduler.

Use:

```yaml
schedule:
  cron: '0 7,19 * * *'
  timezone: 'Europe/Stockholm'
```

Requirements:

- Read schedule from configuration.
- Respect configured timezone.
- Execute complete scans at scheduled times.
- Keep the process alive between executions.
- Log scheduled scan starts.

Use a small established cron library rather than implementing cron parsing manually.

---

## [X] 31. Prevent overlapping scans

Ensure only one scan can run at a time within the application instance.

If a scheduled execution occurs while another scan is still active:

- Do not start another scan.
- Log that the execution was skipped because a scan is already running.

Add tests around the locking/guard behavior.

No distributed lock is required for version 1.

---

## [X] 32. Complete application startup lifecycle

Wire the application together in `src/main.ts`.

Startup should:

1. Load configuration.
2. Validate configuration.
3. Resolve required environment secrets.
4. Initialize the database.
5. Initialize email delivery when enabled.
6. Initialize scan dependencies.
7. Start scheduled operation or requested manual scan mode.
8. Fail startup clearly if mandatory initialization fails.

Keep composition in the application entry point rather than hiding dependencies behind unnecessary frameworks.

---

## [X] 33. Add graceful shutdown

Handle process shutdown cleanly.

Support at minimum:

```text
SIGTERM
SIGINT
```

On shutdown:

- Stop accepting new scheduled executions.
- Close database resources.
- Exit cleanly.

This is especially important for Docker deployments.

---

## [X] 34. Add Dockerfile

Dockerize the application.

Implement a production-oriented multi-stage Dockerfile.

Requirements:

- Use a maintained Node.js LTS image.
- Use Yarn.
- Install dependencies from `yarn.lock`.
- Build TypeScript during image creation.
- Include only what is needed at runtime.
- Run compiled JavaScript.
- Run as a non-root user.
- Use:

```text
/opt/pc-price-tracker
```

as the application location.

Expected production paths:

```text
/opt/pc-price-tracker/config.yaml
/opt/pc-price-tracker/data/
```

Verify the image builds locally.

---

## [X] 35. Add Docker configuration support

Ensure the container works with a mounted/configured YAML file.

The expected Docker Compose configuration should support:

```yaml
configs:
  - source: pc-price-tracker-config
    target: /opt/pc-price-tracker/config.yaml
```

Ensure the application defaults to reading:

```text
/opt/pc-price-tracker/config.yaml
```

inside the production container.

Do not bake private configuration into the Docker image.

---

## [X] 36. Add persistent Docker database storage

Ensure SQLite data survives container replacement.

The application must store the database below:

```text
/opt/pc-price-tracker/data/
```

Document and verify a Docker volume such as:

```yaml
volumes:
  - pc-price-tracker-data:/opt/pc-price-tracker/data
```

Confirm that recreating the container does not remove price history.

---

## [X] 37. Verify Docker Compose deployment

Create or document a complete deployment example matching the intended infrastructure repository usage.

It must demonstrate:

- Docker image.
- Restart policy.
- `env_file`.
- Inline Docker Compose config.
- Config mount.
- Persistent data volume.
- Existing external network.

Verify that the service can:

1. Start.
2. Read its YAML configuration.
3. Resolve SMTP environment variables.
4. Open the persistent SQLite database.
5. Execute a scan.

---

## [X] 38. Add GitHub Actions CI workflow

Create pull-request CI.

Use Yarn consistently.

The workflow should run:

```text
yarn install --frozen-lockfile
yarn lint
yarn format:check
yarn typecheck
yarn test
yarn build
```

Requirements:

- Use the repository's supported Node.js version.
- Cache Yarn dependencies where appropriate.
- Fail CI on any validation failure.
- Follow established conventions from the other repositories where useful.

---

## [X] 39. Add Docker build validation to CI

Ensure pull requests verify that the production Docker image still builds.

Add a CI job that:

- Builds the Docker image.
- Does not publish it for ordinary pull requests.

This catches Docker/runtime issues separately from the TypeScript build.

---

## [X] 40. Add Docker image publishing workflow

Add automated Docker image publishing.

Follow the repository/infrastructure conventions for the target registry.

Implement:

- Authenticate to the configured registry.
- Build the production Docker image.
- Tag it appropriately.
- Push the image.
- Publish `latest` according to the chosen branch/release strategy.

Secrets must come from GitHub Actions secrets/configuration.

Do not hard-code registry credentials.

---

## [X] 41. Expand automated coverage for the complete scan flow

Add higher-level tests covering the primary version 1 behavior.

At minimum test:

### First scan

```text
No prior observations
→ observations persisted
→ first-observed notifications sent
```

### Unchanged prices

```text
same prices
→ new observations persisted
→ no notification
```

### Price increase

```text
price increases
→ observation persisted
→ no notification
```

### Single decrease

```text
one store decreases
→ one consolidated email
```

### Multiple decreases

```text
multiple products/stores decrease
→ exactly one email
→ email contains every decrease
```

### New store

```text
new store appears
→ first-observed notification
→ no false decrease
```

### Partial scrape failure

```text
one product fails
→ remaining products processed
→ valid decreases still notified
```

### SMTP failure

```text
observations persisted
→ email failure recorded/logged
→ notification not marked successful
```

Avoid live Prisjakt requests in the automated test suite.

---

## [X] 42. Review and simplify project structure

Before considering version 1 complete, review the implementation for unnecessary complexity.

Ensure:

- No unused provider abstraction exists.
- No product discovery code exists.
- No search-page scraper exists.
- No ORM was introduced without necessity.
- No unnecessary API/server exists.
- No generic job queue exists.
- No speculative domain model exists.
- HTTP fetching, parsing, persistence, scanning, and email responsibilities remain understandable.
- Product, store, and price observation persistence remain normalized and understandable.
- Price observations reference stores by `store_id` rather than duplicating store names.
- Directory structure remains shallow.

Refactor only where this materially improves the implementation.

---

## [X] 43. Complete README documentation

Expand `README.md` for actual project use.

Document:

- What PC Price Tracker does.
- Requirements.
- Yarn setup.
- Local installation.
- Configuration.
- Environment variables.
- Manual scan execution.
- Scheduled execution.
- Tests.
- Build.
- Docker build/run.
- Docker Compose deployment.
- Persistent data location.

Link to:

```text
docs/requirements.md
docs/tasks.md
```

Avoid duplicating the complete requirements document in the README.

---

## [X] 44. Perform complete local verification

Before version 1 is considered complete, run the complete project validation locally:

```text
yarn install --frozen-lockfile
yarn lint
yarn format:check
yarn typecheck
yarn test
yarn build
docker build .
```

Also perform a real manual scan against at least one configured Prisjakt product.

Confirm:

- Title is parsed correctly.
- Multiple stores are parsed.
- Prices are correct.
- Database rows are persisted.
- Repeated scans create history.
- Price-change detection behaves correctly.

---

## [ ] 45. Perform end-to-end Docker verification

Run the application using its production Docker deployment model.

Verify:

1. YAML config is supplied through Docker Compose `configs.content`.
2. SMTP credentials are supplied through environment variables.
3. SQLite data uses the persistent volume.
4. Application starts without development dependencies.
5. A real scan succeeds.
6. Container restart preserves historical observations.
7. Scheduler starts correctly.
8. Graceful shutdown works.

---

## [ ] 46. Verify consolidated email behavior

Before release, explicitly verify notification behavior using controlled price data or integration fixtures.

Confirm:

```text
No price events
→ no email

One decrease
→ one email

Several price events across several products
→ one email containing all of them
```

Confirm each entry contains:

- Product title.
- Store.
- New price.
- Price decrease.

Confirm no duplicate per-product emails are generated.

---

## [ ] 47. Verify GitHub Actions and image publishing

Complete repository-level verification.

Confirm:

- Pull-request CI passes.
- Lint passes.
- Formatting passes.
- Type checking passes.
- Tests pass.
- Build passes.
- Docker build passes.
- Production image publishing workflow succeeds.
- Published image can be pulled by the target infrastructure.

---

# Version 1 Completion

Version 1 is complete only when all tasks above are finished and the resulting application satisfies `docs/requirements.md`.

The finished system should have one straightforward lifecycle:

```text
YAML product URLs
        ↓
Scheduled scan
        ↓
Fetch Prisjakt pages
        ↓
Parse product + store prices
        ↓
Compare with previous observations
        ↓
Persist price history
        ↓
Collect price events
        ↓
Send one consolidated email
        ↓
Wait for next scan
```

Do not expand scope beyond this lifecycle until version 1 is complete.
