import { AbortError, TimeoutError } from "./errors";
import { exponential } from "./backoff";
import type { RetryOptions, RetryableFunction } from "./types";

const DEFAULT_RETRIES = 3;

export async function retry<T>(
  fn: RetryableFunction<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = DEFAULT_RETRIES,
    backoff = exponential(),
    signal,
    timeout,
    totalTimeout,
    shouldRetry,
    onRetry,
    unref = false,
  } = options;

  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    throwIfAborted(signal);
    throwIfTotalTimeoutExceeded(totalTimeout, startTime);

    try {
      const result = await executeAttempt(fn, attempt, timeout, signal);
      return result;
    } catch (error) {
      if (error instanceof AbortError) {
        throw error.originalError;
      }

      throwIfAborted(signal);

      if (shouldRetry && !(await shouldRetry(error))) {
        throw error;
      }

      lastError = error;

      if (attempt <= retries) {
        if (onRetry) {
          await onRetry(error, attempt);
        }
        await sleep(backoff(attempt), unref);
      }
    }
  }

  throw lastError;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const reason = signal.reason;
    throw reason instanceof Error ? reason : new AbortError("The operation was aborted");
  }
}

function throwIfTotalTimeoutExceeded(totalTimeout: number | undefined, startTime: number): void {
  if (totalTimeout === undefined) return;
  const elapsed = Date.now() - startTime;
  if (elapsed >= totalTimeout) {
    throw new TimeoutError(`Total timeout of ${totalTimeout}ms exceeded after ${elapsed}ms`);
  }
}

async function executeAttempt<T>(
  fn: RetryableFunction<T>,
  attempt: number,
  timeout: number | undefined,
  signal: AbortSignal | undefined,
): Promise<T> {
  const bail = (error: Error): never => {
    throw new AbortError(error);
  };

  if (timeout === undefined) {
    return await fn(bail, attempt);
  }

  return await raceWithTimeout(fn(bail, attempt), timeout, signal);
}

async function raceWithTimeout<T>(
  promise: T | Promise<T>,
  timeout: number,
  signal: AbortSignal | undefined,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  let abortHandler: (() => void) | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Attempt timed out after ${timeout}ms`));
    }, timeout);

    if (signal) {
      abortHandler = () => {
        const reason = signal.reason;
        reject(reason instanceof Error ? reason : new AbortError("The operation was aborted"));
      };
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId!);
    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

function sleep(ms: number, unref: boolean): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (unref && typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }
  });
}
