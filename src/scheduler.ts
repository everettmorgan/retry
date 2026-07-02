export class Scheduler {
  private timer?: NodeJS.Timeout;

  schedule(callback: () => void, delayMs: number): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      callback();
    }, delayMs);
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  get isScheduled(): boolean {
    return this.timer !== undefined;
  }
}
