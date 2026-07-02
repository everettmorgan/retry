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

export function abortReasonToError(reason: unknown): Error {
  return reason instanceof Error ? reason : new AbortError("The operation was aborted");
}
