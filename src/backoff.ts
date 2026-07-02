import type { BackoffStrategy } from "./types";

interface ExponentialOptions {
  base?: number;
  factor?: number;
  maxDelay?: number;
  jitter?: boolean;
}

interface LinearOptions {
  base?: number;
  increment?: number;
  maxDelay?: number;
  jitter?: boolean;
}

const EXPONENTIAL_DEFAULTS = { base: 1000, factor: 2, maxDelay: 30_000, jitter: true };
const LINEAR_DEFAULTS = { base: 1000, increment: 1000, maxDelay: 30_000, jitter: false };

export function exponential(options: ExponentialOptions = {}): BackoffStrategy {
  const { base, factor, maxDelay, jitter } = { ...EXPONENTIAL_DEFAULTS, ...options };
  return (attempt: number): number =>
    capAndJitter(base * Math.pow(factor, attempt - 1), maxDelay, jitter);
}

export function linear(options: LinearOptions = {}): BackoffStrategy {
  const { base, increment, maxDelay, jitter } = { ...LINEAR_DEFAULTS, ...options };
  return (attempt: number): number =>
    capAndJitter(base + increment * (attempt - 1), maxDelay, jitter);
}

export function constant(delayMs: number): BackoffStrategy {
  return (): number => delayMs;
}

function capAndJitter(rawDelay: number, maxDelay: number, jitter: boolean): number {
  const delay = Math.min(maxDelay, rawDelay);
  return jitter ? Math.floor(Math.random() * delay) : delay;
}
