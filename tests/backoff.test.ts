import { expect } from "chai";
import { backoff } from "../src/index";

describe("backoff", () => {
  describe("exponential", () => {
    it("computes correct delays without jitter", () => {
      const strategy = backoff.exponential({ base: 100, factor: 2, jitter: false });

      expect(strategy(1)).to.equal(100);
      expect(strategy(2)).to.equal(200);
      expect(strategy(3)).to.equal(400);
      expect(strategy(4)).to.equal(800);
    });

    it("caps delay at maxDelay", () => {
      const strategy = backoff.exponential({
        base: 1000,
        factor: 2,
        maxDelay: 5000,
        jitter: false,
      });

      expect(strategy(1)).to.equal(1000);
      expect(strategy(4)).to.equal(5000);
      expect(strategy(10)).to.equal(5000);
    });

    it("adds jitter within expected range", () => {
      const strategy = backoff.exponential({ base: 1000, factor: 2, jitter: true });

      for (let i = 0; i < 100; i++) {
        const delay = strategy(1);
        expect(delay).to.be.at.least(0);
        expect(delay).to.be.lessThan(1000);
      }
    });

    it("uses sensible defaults", () => {
      const strategy = backoff.exponential({ jitter: false });

      expect(strategy(1)).to.equal(1000);
      expect(strategy(2)).to.equal(2000);
      expect(strategy(3)).to.equal(4000);
      expect(strategy(4)).to.equal(8000);
      expect(strategy(5)).to.equal(16000);
      expect(strategy(6)).to.equal(30000);
    });
  });

  describe("linear", () => {
    it("increments delay linearly", () => {
      const strategy = backoff.linear({ base: 500, increment: 500, jitter: false });

      expect(strategy(1)).to.equal(500);
      expect(strategy(2)).to.equal(1000);
      expect(strategy(3)).to.equal(1500);
      expect(strategy(4)).to.equal(2000);
    });

    it("caps delay at maxDelay", () => {
      const strategy = backoff.linear({
        base: 1000,
        increment: 1000,
        maxDelay: 3000,
        jitter: false,
      });

      expect(strategy(5)).to.equal(3000);
      expect(strategy(100)).to.equal(3000);
    });
  });

  describe("constant", () => {
    it("returns same delay every time", () => {
      const strategy = backoff.constant(2000);

      expect(strategy(1)).to.equal(2000);
      expect(strategy(2)).to.equal(2000);
      expect(strategy(50)).to.equal(2000);
    });
  });
});
