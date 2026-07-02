import { AbortError, abortReasonToError } from "./abort-error";
import { TimeoutError } from "./timeout-error";
import { exponential } from "./backoff";
import { executeAttempt } from "./attempt";
import type { BackoffStrategy, RetryOptions, RetryableFunction } from "./types";

const DEFAULT_RETRIES = 3;

type ResolvedOptions = RetryOptions & {
  retries: number;
  backoff: BackoffStrategy;
  unref: boolean;
};

export async function retry<T>(fn: RetryableFunction<T>, options: RetryOptions = {}): Promise<T> {
  const config = withDefaults(options);
  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.retries + 1; attempt++) {
    throwIfAborted(config.signal);
    throwIfTotalTimeoutExceeded(config.totalTimeout, startTime);

    try {
      return await executeAttempt(fn, attempt, config);
    } catch (error) {
      lastError = await handleAttemptFailure(error, attempt, config);
    }
  }

  throw lastError;
}

function withDefaults(options: RetryOptions): ResolvedOptions {
  return { retries: DEFAULT_RETRIES, backoff: exponential(), unref: false, ...options };
}

async function handleAttemptFailure(
  error: unknown,
  attempt: number,
  config: ResolvedOptions,
): Promise<unknown> {
  if (error instanceof AbortError) {
    throw error.originalError;
  }
  throwIfAborted(config.signal);
  if (config.shouldRetry && !(await config.shouldRetry(error))) {
    throw error;
  }
  if (attempt <= config.retries) {
    await waitBeforeRetry(error, attempt, config);
  }
  return error;
}

async function waitBeforeRetry(
  error: unknown,
  attempt: number,
  config: ResolvedOptions,
): Promise<void> {
  await config.onRetry?.(error, attempt);
  await sleep(config.backoff(attempt), config.unref);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const reason: unknown = signal.reason;
    throw abortReasonToError(reason);
  }
}

function throwIfTotalTimeoutExceeded(totalTimeout: number | undefined, startTime: number): void {
  if (totalTimeout === undefined) {
    return;
  }
  const elapsed = Date.now() - startTime;
  if (elapsed >= totalTimeout) {
    throw new TimeoutError(`Total timeout of ${totalTimeout}ms exceeded after ${elapsed}ms`);
  }
}

function sleep(ms: number, unref: boolean): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (unref) {
      timer.unref();
    }
  });
}
