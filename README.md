# ejmorgan-retry

Production-grade retry with exponential backoff, jitter, abort signals, and timeouts. Zero dependencies.

## Installation

```bash
npm install ejmorgan-retry
```

## Quick Start

```typescript
import { retry } from "ejmorgan-retry";

const data = await retry(async () => {
  const res = await fetch("https://api.example.com/data");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
});
```

Retries 3 times with exponential backoff and jitter by default.

## Bail on Non-Retriable Errors

Use `bail()` to immediately stop retrying when an error is permanent:

```typescript
const data = await retry(async (bail) => {
  const res = await fetch(url);
  if (res.status === 403) bail(new Error("Forbidden"));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}, { retries: 5 });
```

## Backoff Strategies

```typescript
import { retry, backoff } from "ejmorgan-retry";

// Exponential with full jitter (default)
await retry(fn, {
  backoff: backoff.exponential({ base: 1000, factor: 2, maxDelay: 30_000 }),
});

// Linear
await retry(fn, {
  backoff: backoff.linear({ base: 500, increment: 500, maxDelay: 10_000 }),
});

// Constant
await retry(fn, {
  backoff: backoff.constant(2000),
});

// Custom
await retry(fn, {
  backoff: (attempt) => attempt * 1000,
});
```

## Cancellation with AbortSignal

```typescript
const controller = new AbortController();

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30_000);

const data = await retry(async () => {
  return await fetchData();
}, { retries: 10, signal: controller.signal });
```

## Timeouts

```typescript
await retry(fn, {
  timeout: 5_000,       // 5s per attempt
  totalTimeout: 60_000, // 60s across all attempts
  retries: 10,
});
```

## Retry Predicates

Only retry specific errors:

```typescript
await retry(fn, {
  retries: 5,
  shouldRetry: (error) => {
    if (error instanceof TypeError) return false;
    return true;
  },
});
```

## Lifecycle Hooks

```typescript
await retry(fn, {
  retries: 5,
  onRetry: (error, attempt) => {
    console.log(`Attempt ${attempt} failed: ${error}`);
    metrics.increment("retry.count");
  },
});
```

## API

### `retry<T>(fn, options?): Promise<T>`

Executes `fn` and retries on failure according to `options`.

**`fn(bail, attempt)`** — The function to execute.
- `bail(error: Error)` — Call to abort retries immediately. Throws the given error.
- `attempt` — The current attempt number (1-indexed).

**`options`**

| Option | Type | Default | Description |
|---|---|---|---|
| `retries` | `number` | `3` | Maximum number of retries |
| `backoff` | `BackoffStrategy` | `exponential()` | Backoff strategy function |
| `signal` | `AbortSignal` | — | Cancellation signal |
| `timeout` | `number` | — | Per-attempt timeout (ms) |
| `totalTimeout` | `number` | — | Total timeout across all attempts (ms) |
| `shouldRetry` | `(error: unknown) => boolean` | — | Return `false` to stop retrying |
| `onRetry` | `(error: unknown, attempt: number) => void` | — | Called after each failed attempt |
| `unref` | `boolean` | `false` | Unref internal timers |

### `backoff.exponential(options?): BackoffStrategy`

Returns an exponential backoff strategy with full jitter (AWS best practice).

| Option | Default | Description |
|---|---|---|
| `base` | `1000` | Base delay in ms |
| `factor` | `2` | Multiplier per attempt |
| `maxDelay` | `30000` | Maximum delay cap in ms |
| `jitter` | `true` | Apply full jitter randomization |

### `backoff.linear(options?): BackoffStrategy`

Returns a linear backoff strategy.

| Option | Default | Description |
|---|---|---|
| `base` | `1000` | Starting delay in ms |
| `increment` | `1000` | Added per attempt in ms |
| `maxDelay` | `30000` | Maximum delay cap in ms |
| `jitter` | `false` | Apply jitter randomization |

### `backoff.constant(delayMs): BackoffStrategy`

Returns a constant delay strategy.

### `AbortError`

Thrown internally when `bail()` is called. The original error is re-thrown to the caller.

### `TimeoutError`

Thrown when a per-attempt or total timeout is exceeded.

## License

MIT
