import { expect } from "chai";
import { Retry } from "../src";
import Logger from "../src/lib/logger";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Retry (legacy 1.x contract)", () => {
  it("runs the 1.0.6 README pattern unmodified: reschedule until 5 attempts, then reject", async () => {
    const retry = new Retry(function (resolve, reject, retry) {
      if (retry.attempts < 5) resolve(retry.reschedule(5));
      else reject("oof!");
    });

    let rejection: unknown;
    await retry
      .schedule()
      .then(() => expect.fail("should have rejected"))
      .catch((err: unknown) => (rejection = err));

    expect(rejection).to.equal("oof!");
    expect(retry.attempts).to.equal(6);
    expect(retry.status).to.equal("failed");
  });

  it("resolves with the value passed to resolve()", async () => {
    const retry = new Retry((resolve) => resolve("ok"));
    const result = await retry.schedule();
    expect(result).to.equal("ok");
    expect(retry.status).to.equal("completed");
    expect(retry.attempts).to.equal(1);
  });

  it("rejects with the value passed to reject() and reports failed status", async () => {
    const retry = new Retry((_resolve, reject) => reject("nope"));
    let rejection: unknown;
    await retry.schedule().catch((err: unknown) => (rejection = err));
    expect(rejection).to.equal("nope");
    expect(retry.status).to.equal("failed");
  });

  it("returns the same in-flight promise when schedule() is called while pending", () => {
    const retry = new Retry((resolve) => resolve(undefined));
    const first = retry.schedule(50);
    const second = retry.schedule(0);
    expect(first).to.equal(second);
    retry.stop();
  });

  it("creates a fresh run when schedule() is called after completion", async () => {
    let runs = 0;
    const retry = new Retry((resolve) => resolve(++runs));
    await retry.schedule();
    await retry.schedule();
    expect(runs).to.equal(2);
    expect(retry.attempts).to.equal(2);
  });

  it("stop() cancels a pending run without invoking the context", async () => {
    let invoked = false;
    const retry = new Retry((resolve) => {
      invoked = true;
      resolve(undefined);
    });
    void retry.schedule(20);
    retry.stop();
    await delay(40);
    expect(invoked).to.equal(false);
    expect(retry.status).to.equal("stopped");
    expect(retry.attempts).to.equal(0);
  });

  it("resolve(reschedule(ms)) chains the outer promise to the rescheduled run", async () => {
    const retry = new Retry((resolve, _reject, $this) => {
      if ($this.attempts === 0) resolve($this.reschedule(5));
      else resolve("second run");
    });
    const result = await retry.schedule();
    expect(result).to.equal("second run");
    expect(retry.attempts).to.equal(2);
  });

  it("exposes the 1.0.6 shape: created, uuid, attempts, max_attempts, status", () => {
    const before = Date.now();
    const retry = new Retry((resolve) => resolve(undefined));
    expect(retry.uuid).to.match(UUID_V4);
    expect(retry.created).to.be.at.least(before);
    expect(retry.created).to.be.at.most(Date.now());
    expect(retry.attempts).to.equal(0);
    expect(retry.max_attempts).to.equal(undefined);
    expect(retry.status).to.equal("idle");
  });

  it("transitions status idle -> scheduled while waiting", () => {
    const retry = new Retry((resolve) => resolve(undefined));
    expect(retry.status).to.equal("idle");
    void retry.schedule(50);
    expect(retry.status).to.equal("scheduled");
    retry.stop();
  });

  it("supports the public status setter with valid values", () => {
    const retry = new Retry((resolve) => resolve(undefined));
    retry.status = "failed";
    expect(retry.status).to.equal("failed");
  });

  it("ignores unknown status values instead of corrupting state", () => {
    const retry = new Retry((resolve) => resolve(undefined));
    (retry as { status: string }).status = "bogus";
    expect(retry.status).to.equal("idle");
  });

  it("passes the Retry instance itself as the third context argument", async () => {
    let received: unknown;
    const retry = new Retry((resolve, _reject, $this) => {
      received = $this;
      resolve(undefined);
    });
    await retry.schedule();
    expect(received).to.equal(retry);
  });
});

describe("legacy deep imports", () => {
  it("still resolves ejmorgan-retry/dist/lib/retry", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shim = require("../src/lib/retry") as { Retry: typeof Retry };
    expect(shim.Retry).to.equal(Retry);
  });

  it("still resolves ejmorgan-retry/dist/lib/logger with the 1.0.x Logger shape", () => {
    const logger = new Logger();
    expect(logger.uuid).to.match(UUID_V4);
  });

  it("Logger.log emits the 1.0.x [timestamp] [name->prefix] format", () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]): void => {
      lines.push(args.join(" "));
    };
    try {
      const logger = new Logger("Retry", "abc123");
      logger.log("hello", "world");
      const anonymous = new Logger();
      anonymous.set.name("Named");
      anonymous.set.prefix("p1");
      anonymous.log("again");
    } finally {
      console.log = original;
    }
    expect(lines[0]).to.match(/^\[.+\] \[Retry->abc123\] hello world$/);
    expect(lines[1]).to.match(/^\[.+\] \[Named->p1\] again$/);
  });

  it("Logger falls back to its uuid when unnamed", () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]): void => {
      lines.push(args.join(" "));
    };
    try {
      const logger = new Logger();
      logger.log("x");
      expect(lines[0]).to.contain(logger.uuid);
    } finally {
      console.log = original;
    }
  });
});
