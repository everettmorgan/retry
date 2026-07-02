import { AbortError, abortReasonToError } from "./abort-error";
import { TimeoutError } from "./timeout-error";
import type { RetryableFunction, RetryOptions } from "./types";

interface CancelableRejection {
  promise: Promise<never>;
  cancel: () => void;
}

export async function executeAttempt<T>(
  fn: RetryableFunction<T>,
  attempt: number,
  config: Pick<RetryOptions, "timeout" | "signal">,
): Promise<T> {
  if (config.timeout === undefined) {
    return await fn(bail, attempt);
  }
  return await raceWithTimeout(fn(bail, attempt), config.timeout, config.signal);
}

function bail(error: Error): never {
  throw new AbortError(error);
}

async function raceWithTimeout<T>(
  promise: T | Promise<T>,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<T> {
  const timeout = timeoutRejection(timeoutMs);
  const abort = abortRejection(signal);
  try {
    return await Promise.race([promise, timeout.promise, abort.promise]);
  } finally {
    timeout.cancel();
    abort.cancel();
  }
}

function timeoutRejection(timeoutMs: number): CancelableRejection {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`Attempt timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return {
    promise,
    cancel: (): void => {
      clearTimeout(timer);
    },
  };
}

function abortRejection(signal: AbortSignal | undefined): CancelableRejection {
  if (!signal) {
    return { promise: new Promise<never>(() => undefined), cancel: () => undefined };
  }
  let onAbort: (() => void) | undefined;
  const promise = new Promise<never>((_resolve, reject) => {
    onAbort = (): void => {
      reject(abortReasonToError(signal.reason));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  return {
    promise,
    cancel: (): void => {
      if (onAbort) {
        signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
