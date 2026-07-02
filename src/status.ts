const STATUS_NAMES = ["idle", "scheduled", "retrying", "completed", "failed", "stopped"] as const;

export type RetryStatusName = (typeof STATUS_NAMES)[number];

export class RetryStatus {
  private current: RetryStatusName = "idle";

  get name(): RetryStatusName {
    return this.current;
  }

  set name(value: RetryStatusName) {
    if (STATUS_NAMES.includes(value)) {
      this.current = value;
    }
  }

  get isPending(): boolean {
    return this.current === "scheduled" || this.current === "retrying";
  }
}
