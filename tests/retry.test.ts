import { expect } from "chai";
import { Retry } from "../src/index";

describe("Retry", function () {
  this.timeout(10000);

  it("rejects after exhausting all retry attempts", async function () {
    const maxAttempts = 5;
    let attempts = 0;

    const retry = new Retry<string>((resolve, reject, self) => {
      if (attempts < maxAttempts) {
        attempts += 1;
        resolve(self.reschedule(100));
      } else {
        reject(new Error("exhausted"));
      }
    });

    try {
      await retry.schedule();
      expect.fail("should have rejected");
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect(attempts).to.equal(5);
    }
  });

  it("resolves with the final value after retrying", async function () {
    const expected = "it worked!";
    const maxAttempts = 5;
    let attempts = 0;

    const retry = new Retry<string>((resolve, reject, self) => {
      if (attempts < maxAttempts) {
        attempts += 1;
        resolve(self.reschedule(100));
      } else {
        resolve(expected);
      }
    });

    const result = await retry.schedule();
    expect(result).to.equal(expected);
  });

  it("returns the same promise for concurrent schedule calls", async function () {
    const maxAttempts = 5;
    let attempts = 0;

    const retry = new Retry<Record<string, unknown>>((resolve, reject, self) => {
      const payload = {};

      if (attempts < maxAttempts) {
        attempts += 1;
        resolve(self.reschedule(100));
      } else {
        resolve(payload);
      }
    });

    const first = retry.schedule(100);
    const second = retry.schedule();
    const third = retry.schedule();
    const fourth = retry.schedule();

    const result = await first;
    expect(await second).to.equal(result);
    expect(await third).to.equal(result);
    expect(await fourth).to.equal(result);
  });

  it("invokes onAttempt callback on each attempt", async function () {
    const recorded: number[] = [];
    const maxAttempts = 3;
    let attempts = 0;

    const retry = new Retry<string>(
      (resolve, reject, self) => {
        if (attempts < maxAttempts) {
          attempts += 1;
          resolve(self.reschedule(50));
        } else {
          resolve("done");
        }
      },
      { onAttempt: (n) => recorded.push(n) },
    );

    await retry.schedule();
    expect(recorded).to.deep.equal([1, 2, 3, 4]);
    expect(retry.attemptCount).to.equal(4);
  });

  it("exposes state transitions correctly", async function () {
    const retry = new Retry<string>((resolve) => {
      expect(retry.state).to.equal("running");
      resolve("done");
    });

    expect(retry.state).to.equal("idle");

    const promise = retry.schedule(50);
    expect(retry.state).to.equal("scheduled");

    await promise;
    expect(retry.state).to.equal("completed");
  });
});
