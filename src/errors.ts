export class AbortError extends Error {
  readonly originalError: Error;

  constructor(error: Error | string) {
    const original = error instanceof Error ? error : new Error(error);
    super(original.message);
    this.name = "AbortError";
    this.originalError = original;
    if (original.stack) {
      this.stack = original.stack;
    }
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}
