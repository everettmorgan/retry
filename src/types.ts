export type BackoffStrategy = (attempt: number) => number;

export type RetryableFunction<T> = (
  bail: (error: Error) => never,
  attempt: number,
) => T | Promise<T>;

export interface RetryOptions {
  /** Maximum number of retries. Default: 3 */
  retries?: number;

  /** Backoff strategy function. Default: exponential with jitter */
  backoff?: BackoffStrategy;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;

  /** Per-attempt timeout in milliseconds */
  timeout?: number;

  /** Total timeout across all attempts in milliseconds */
  totalTimeout?: number;

  /** Predicate to determine if an error is retriable. Return false to stop retrying. */
  shouldRetry?: (error: unknown) => boolean | Promise<boolean>;

  /** Called after each failed attempt. Receives the error and the attempt number that failed. */
  onRetry?: (error: unknown, attempt: number) => void | Promise<void>;

  /** If true, internal timers will be unreffed so they don't keep the Node.js process alive. */
  unref?: boolean;
}
