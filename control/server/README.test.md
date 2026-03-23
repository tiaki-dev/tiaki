# Testing Guide

## Test Structure

This project separates tests into two categories:

- **Unit Tests**: Pure logic tests with no external dependencies (e.g., `semver.test.ts`)
- **Integration Tests**: Tests requiring a PostgreSQL database (e.g., `db/queries/*.test.ts`)

## Running Tests

### Unit Tests (CI-safe, no database required)
```bash
pnpm test:unit
```

This is the default test command and runs in CI pipelines without requiring a database.

### Integration Tests (requires DATABASE_URL)
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/tiaki_test pnpm test:integration
```

Integration tests require a running PostgreSQL instance. They will automatically skip if `DATABASE_URL` is not set.

### All Tests
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/tiaki_test pnpm test:all
```

## CI Pipeline

The CI pipeline (`.github/workflows/ci.yml`) runs only unit tests to avoid requiring database infrastructure. Integration tests should be run locally before merging.

## Configuration

- `vitest.config.ts`: Excludes integration tests (default for `pnpm test` and `pnpm test:unit`)
- `vitest.integration.config.ts`: Runs all tests including integration tests
