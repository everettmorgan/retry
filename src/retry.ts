import { randomUUID } from "crypto";
import { Scheduler } from "./scheduler";
import { RetryStatus, RetryStatusName } from "./status";

export type RetryContext = (
  resolve: (toResolve: unknown) => void,
  reject: (toReject: unknown) => void,
  $this: Retry,
) => void;

export class Retry {
  /** When the Retry was first created. */
  readonly created: number = Date.now();

  /** The UUID for the Retry. */
  readonly uuid: string = randomUUID();

  /** Max attempts allowed for the Retry. Public since 1.0.x; not enforced internally. */
  max_attempts?: number;

  private readonly context: RetryContext;
  private readonly scheduler = new Scheduler();
  private readonly currentStatus = new RetryStatus();
  private attemptCount = 0;
  private pendingRun?: Promise<unknown>;

  constructor(context: RetryContext) {
    this.context = context;
  }

  get status(): RetryStatusName {
    return this.currentStatus.name;
  }

  set status(value: RetryStatusName) {
    this.currentStatus.name = value;
  }

  get attempts(): number {
    return this.attemptCount;
  }

  /** Schedules the context to run in `time` milliseconds. Returns the in-flight promise if already pending. */
  schedule(time = 0): Promise<unknown> {
    if (this.currentStatus.isPending && this.pendingRun) {
      return this.pendingRun;
    }
    this.pendingRun = this.createRun(time);
    this.currentStatus.name = "scheduled";
    return this.pendingRun;
  }

  /** Cancels any pending run and schedules a new one. Resolve with the returned promise to chain retries. */
  reschedule(newTime: number): Promise<unknown> {
    this.stop();
    return this.schedule(newTime);
  }

  /** Stops the scheduled run. */
  stop(): void {
    this.scheduler.cancel();
    this.currentStatus.name = "stopped";
  }

  private createRun(delayMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.scheduler.schedule(() => {
        this.runContext(resolve, reject);
      }, delayMs);
    });
  }

  private runContext(resolve: (value: unknown) => void, reject: (value: unknown) => void): void {
    this.currentStatus.name = "retrying";
    this.context(this.settleWith("completed", resolve), this.settleWith("failed", reject), this);
  }

  private settleWith(
    status: RetryStatusName,
    settle: (value: unknown) => void,
  ): (value: unknown) => void {
    return (value: unknown): void => {
      this.currentStatus.name = status;
      this.attemptCount += 1;
      settle(value);
    };
  }
}
