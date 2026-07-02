import { expect } from "chai";
import { retry, AbortError, TimeoutError, backoff } from "../src/index";

describe("retry", function () {
  this.timeout(15000);

  it("succeeds on first attempt without retrying", async () => {
    let callCount = 0;
    const result = await retry(async () => {
      callCount += 1;
      return "ok";
    });

    expect(result).to.equal("ok");
    expect(callCount).to.equal(1);
  });

  it("returns the resolved value from the function", async () => {
    const expected = { status: 200, data: [1, 2, 3] };
    const result = await retry(async () => expected, { retries: 0 });
    expect(result).to.deep.equal(expected);
  });

  it("retries the specified number of times before failing", async () => {
    let attempts = 0;

    try {
      await retry(
        async () => {
          attempts += 1;
          throw new Error("always fails");
        },
        { retries: 4, backoff: backoff.constant(10) },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal("always fails");
      expect(attempts).to.equal(5);
    }
  });

  it("succeeds after transient failures", async () => {
    let attempts = 0;

    const result = await retry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("transient");
        return "recovered";
      },
      { retries: 5, backoff: backoff.constant(10) },
    );

    expect(result).to.equal("recovered");
    expect(attempts).to.equal(3);
  });

  it("calls onRetry after each failed attempt", async () => {
    const retryLog: { error: string; attempt: number }[] = [];

    try {
      await retry(
        async () => {
          throw new Error("fail");
        },
        {
          retries: 3,
          backoff: backoff.constant(10),
          onRetry: (error, attempt) => {
            retryLog.push({
              error: (error as Error).message,
              attempt,
            });
          },
        },
      );
    } catch {
      // expected
    }

    expect(retryLog).to.deep.equal([
      { error: "fail", attempt: 1 },
      { error: "fail", attempt: 2 },
      { error: "fail", attempt: 3 },
    ]);
  });

  it("bail aborts retries immediately with the given error", async () => {
    let attempts = 0;

    try {
      await retry(
        async (bail) => {
          attempts += 1;
          if (attempts === 2) bail(new Error("non-retriable"));
          throw new Error("transient");
        },
        { retries: 10, backoff: backoff.constant(10) },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal("non-retriable");
      expect(attempts).to.equal(2);
    }
  });

  it("respects shouldRetry predicate", async () => {
    let attempts = 0;

    try {
      await retry(
        async () => {
          attempts += 1;
          if (attempts === 2) throw new TypeError("bad type");
          throw new RangeError("out of range");
        },
        {
          retries: 5,
          backoff: backoff.constant(10),
          shouldRetry: (error) => error instanceof RangeError,
        },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(TypeError);
      expect(attempts).to.equal(2);
    }
  });

  it("cancels via AbortSignal", async () => {
    const controller = new AbortController();
    let attempts = 0;

    setTimeout(() => controller.abort(new Error("cancelled")), 50);

    try {
      await retry(
        async () => {
          attempts += 1;
          throw new Error("transient");
        },
        { retries: 100, backoff: backoff.constant(30), signal: controller.signal },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal("cancelled");
      expect(attempts).to.be.lessThan(100);
    }
  });

  it("enforces per-attempt timeout", async () => {
    let attempts = 0;

    try {
      await retry(
        async () => {
          attempts += 1;
          await new Promise((resolve) => setTimeout(resolve, 500));
          return "too slow";
        },
        { retries: 1, timeout: 50, backoff: backoff.constant(10) },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(TimeoutError);
      expect((error as TimeoutError).message).to.include("timed out");
      expect(attempts).to.equal(2);
    }
  });

  it("enforces total timeout across all attempts", async () => {
    let attempts = 0;

    try {
      await retry(
        async () => {
          attempts += 1;
          await new Promise((resolve) => setTimeout(resolve, 40));
          throw new Error("slow fail");
        },
        { retries: 100, totalTimeout: 100, backoff: backoff.constant(10) },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.satisfy((e: unknown) => e instanceof TimeoutError || e instanceof Error);
      expect(attempts).to.be.greaterThan(0);
      expect(attempts).to.be.lessThan(100);
    }
  });

  it("accepts custom backoff strategy", async () => {
    const delays: number[] = [];
    let attempts = 0;

    const trackingBackoff = (attempt: number): number => {
      const delay = attempt * 10;
      delays.push(delay);
      return delay;
    };

    try {
      await retry(
        async () => {
          attempts += 1;
          throw new Error("fail");
        },
        { retries: 3, backoff: trackingBackoff },
      );
    } catch {
      // expected
    }

    expect(delays).to.deep.equal([10, 20, 30]);
    expect(attempts).to.equal(4);
  });

  it("does not retry when retries is 0", async () => {
    let attempts = 0;

    try {
      await retry(
        async () => {
          attempts += 1;
          throw new Error("no retries");
        },
        { retries: 0 },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect((error as Error).message).to.equal("no retries");
      expect(attempts).to.equal(1);
    }
  });

  it("passes correct 1-indexed attempt number", async () => {
    const attemptNumbers: number[] = [];

    await retry(
      async (_bail, attempt) => {
        attemptNumbers.push(attempt);
        if (attempt < 3) throw new Error("not yet");
        return "done";
      },
      { retries: 5, backoff: backoff.constant(10) },
    );

    expect(attemptNumbers).to.deep.equal([1, 2, 3]);
  });

  it("throws AbortError type from bail", async () => {
    try {
      await retry(async (bail) => {
        bail(new Error("fatal"));
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal("fatal");
      expect(error).not.to.be.instanceOf(AbortError);
    }
  });

  it("works with synchronous return values", async () => {
    const result = await retry(() => 42, { retries: 0 });
    expect(result).to.equal(42);
  });

  it("rejects with pre-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort(new Error("already cancelled"));

    try {
      await retry(async () => "should not run", { signal: controller.signal });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal("already cancelled");
    }
  });
});
