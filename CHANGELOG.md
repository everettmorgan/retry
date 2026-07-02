# Changelog

## 2.0.0

Complete API redesign. The class-based `Retry` API is replaced by a single async `retry()`
function. Legacy consumers should stay on the `1.x` line (`npm install ejmorgan-retry@1`),
which remains maintained on the `1.x` branch.

### Breaking changes

- Removed the `Retry` class. Use `retry(fn, options)` instead.
- Added an `exports` map: deep imports (e.g. `ejmorgan-retry/dist/lib/retry`) are no longer
  supported.
- Requires Node.js >= 18.

### Added

- `retry<T>(fn, options)` with `retries`, `backoff`, `signal` (AbortSignal), per-attempt
  `timeout`, `totalTimeout`, `shouldRetry`, `onRetry`, and `unref` options.
- `bail(error)` callback to stop retrying immediately.
- Backoff strategies: `backoff.exponential()` (full jitter, default), `backoff.linear()`,
  `backoff.constant()`.
- `AbortError` and `TimeoutError` error classes.
- Zero runtime dependencies (dropped `uuid` and `dotenv`).

## 1.1.0

Internal modernization of the `Retry` class. No API changes — code written against 1.0.6
continues to work unmodified.

### Changed

- Internals refactored into small single-responsibility collaborators; behavior preserved
  (idempotent `schedule()`, `resolve(retry.reschedule(ms))` chaining, status lifecycle).
- Zero runtime dependencies: dropped `uuid` (uses `node:crypto` `randomUUID`) and the unused
  `dotenv`.
- Improved TypeScript types: `any` widened to `unknown` / string unions. Runtime behavior is
  identical.

### Removed

- Internal console logging ("retrying...attempt #N" with an md5 checksum prefix). The output
  was unconditional and not part of the public API.

## 1.0.6

Last release of the original implementation.
