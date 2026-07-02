# ejmorgan-retry (1.x)

A simple and lightweight package to retry various execution contexts. Zero dependencies.

> **Looking for the modern API?** Version 2.x replaced this class with a declarative
> `retry()` function (backoff strategies, AbortSignal, timeouts). This `1.x` branch maintains
> the original `Retry` class with no breaking changes. Install the latest major with
> `npm install ejmorgan-retry`.

## Installation

```bash
npm install ejmorgan-retry@1
```

## Usage

### Basic

```javascript
const { Retry } = require("ejmorgan-retry");

const retry = new Retry(function (resolve, reject, retry) {
  if (retry.attempts < 5) resolve(retry.reschedule(2000));
  else reject("oof!");
});

retry
  .schedule()
  .then((ok) => console.log(ok))
  .catch((err) => console.error(err));
```

### HTTP Request

```javascript
const https = require("https");
const { Retry } = require("ejmorgan-retry");

const retry = new Retry((resolve, reject, retry) => {
  const req = https.request({/* opts */}, (res) => {
    let data = "";

    res.on("data", (d) => (data += d));
    res.on("error", (e) => reject(e));

    res.on("end", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(res);
      } else if (retry.attempts < 5) {
        // You MUST resolve() with the reschedule() promise —
        // `return` or `reject` exits the Retry immediately.
        resolve(retry.reschedule(2000));
      } else {
        reject("ERR");
      }
    });
  });

  req.end();
});

retry
  .schedule()
  .then((res) => console.log(res))
  .catch((err) => console.error(err));
```

## API

### `new Retry(context)`

`context(resolve, reject, $this)` — the function to (re)execute.

- `resolve(value)` — settle the retry successfully. Resolve with `$this.reschedule(ms)` to try again.
- `reject(error)` — settle the retry as failed.
- `$this` — the `Retry` instance itself.

### Instance members

| Member            | Type                                                                          | Description                                                                    |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `schedule(time?)` | `(time?: number) => Promise<unknown>`                                         | Run the context in `time` ms (default `0`). Idempotent while a run is pending. |
| `reschedule(ms)`  | `(ms: number) => Promise<unknown>`                                            | Cancel the pending run and schedule a new one.                                 |
| `stop()`          | `() => void`                                                                  | Cancel the pending run.                                                        |
| `attempts`        | `number` (read-only)                                                          | Times the context has settled (resolve or reject).                             |
| `status`          | `"idle" \| "scheduled" \| "retrying" \| "completed" \| "failed" \| "stopped"` | Current lifecycle state.                                                       |
| `created`         | `number` (read-only)                                                          | `Date.now()` at construction.                                                  |
| `uuid`            | `string` (read-only)                                                          | Unique id (UUID v4).                                                           |
| `max_attempts`    | `number \| undefined`                                                         | Not enforced internally; kept for 1.0.x compatibility.                         |

## Changes since 1.0.6

No API changes. Internals were refactored, dependencies were dropped (now zero), and the
internal console logging was removed. See [CHANGELOG.md](CHANGELOG.md).

## Requirements

Node.js >= 14.17.

## License

MIT
