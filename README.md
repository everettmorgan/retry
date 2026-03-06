# ejmorgan-retry

A simple and lightweight package to retry various execution contexts.

## Installation

```bash
npm install ejmorgan-retry
// or
yarn add ejmorgan-retry
```

## Usage

### Basic

```typescript
import { Retry } from "ejmorgan-retry";

const retry = new Retry<string>((resolve, reject, retry) => {
  if (retry.attemptCount < 5) {
    resolve(retry.reschedule(2000));
  } else {
    reject(new Error("exhausted"));
  }
});

retry.schedule()
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
```

### HTTP Request

```typescript
import https from "https";
import { Retry } from "ejmorgan-retry";

const retry = new Retry<string>((resolve, reject, retry) => {
  const req = https.request({/* opts */}, (res) => {
    let data = "";

    res.on("data", (d) => data += d);

    res.on("error", (e) => reject(e));

    res.on("end", () => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
        resolve(data);
      } else if (retry.attemptCount < 5) {
        resolve(retry.reschedule(2000));
      } else {
        reject(new Error(`Request failed with status ${res.statusCode}`));
      }
    });
  });

  req.end();
});

retry.schedule()
  .then((res) => console.log(res))
  .catch((err) => console.error(err));
```

### With Attempt Logging

```typescript
import { Retry } from "ejmorgan-retry";

const retry = new Retry<string>(
  (resolve, reject, retry) => {
    if (retry.attemptCount < 3) {
      resolve(retry.reschedule(1000));
    } else {
      resolve("success");
    }
  },
  { onAttempt: (n) => console.log(`Attempt #${n}`) },
);

await retry.schedule();
```

## API

### `new Retry<T>(callback, options?)`

Creates a new retry instance.

- **callback** `(resolve, reject, retry) => void` — The execution context to retry.
- **options.onAttempt** `(attemptNumber: number) => void` — Optional hook called after each attempt.

### `retry.schedule(delayMs?: number): Promise<T>`

Schedules the callback to execute after `delayMs` milliseconds (default `0`). Concurrent calls return the same promise.

### `retry.reschedule(delayMs: number): Promise<T>`

Stops the current schedule and creates a new one with the given delay.

### `retry.stop(): void`

Cancels any pending scheduled execution.

### `retry.attemptCount: number`

The number of times the callback has settled (resolved or rejected).

### `retry.state: RetryState`

The current state: `"idle"` | `"scheduled"` | `"running"` | `"completed"` | `"failed"` | `"stopped"`.

### `retry.uuid: string`

A unique identifier for this retry instance.

### `retry.created: number`

Timestamp (ms since epoch) when the instance was created.
