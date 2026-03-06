import { randomUUID } from "crypto";

export type RetryState =
  | "idle"
  | "scheduled"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export type RetryCallback<T> = (
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason: unknown) => void,
  retry: Retry<T>,
) => void;

export interface RetryOptions {
  onAttempt?: (attemptNumber: number) => void;
}

export class Retry<T> {
  readonly uuid: string;
  readonly created: number;

  private _attemptCount = 0;
  private _state: RetryState = "idle";
  private readonly callback: RetryCallback<T>;
  private readonly onAttempt?: (attemptNumber: number) => void;
  private pendingPromise?: Promise<T>;
  private pendingTimeout?: ReturnType<typeof setTimeout>;

  constructor(callback: RetryCallback<T>, options?: RetryOptions) {
    this.uuid = randomUUID();
    this.created = Date.now();
    this.callback = callback;
    this.onAttempt = options?.onAttempt;
  }

  get attemptCount(): number {
    return this._attemptCount;
  }

  get state(): RetryState {
    return this._state;
  }

  schedule(delayMs = 0): Promise<T> {
    if (this.isActive() && this.pendingPromise) {
      return this.pendingPromise;
    }

    this.pendingPromise = this.createAttemptPromise(delayMs);
    this._state = "scheduled";
    return this.pendingPromise;
  }

  reschedule(delayMs: number): Promise<T> {
    this.stop();
    return this.schedule(delayMs);
  }

  stop(): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = undefined;
    }
    this._state = "stopped";
  }

  private isActive(): boolean {
    return this._state === "scheduled" || this._state === "running";
  }

  private createAttemptPromise(delayMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pendingTimeout = setTimeout(() => {
        this._state = "running";
        this.callback(
          (value) => this.settle("completed", resolve, value),
          (reason) => this.settle("failed", reject, reason),
          this,
        );
      }, delayMs);
    });
  }

  private settle<V>(
    finalState: RetryState,
    settleFn: (value: V) => void,
    value: V,
  ): void {
    this._state = finalState;
    this._attemptCount += 1;
    this.onAttempt?.(this._attemptCount);
    settleFn(value);
  }
}
