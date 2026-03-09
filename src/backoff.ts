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

export function exponential(options: ExponentialOptions = {}): BackoffStrategy {
  const {
    base = 1000,
    factor = 2,
    maxDelay = 30_000,
    jitter = true,
  } = options;

  return (attempt: number): number => {
    const delay = Math.min(maxDelay, base * Math.pow(factor, attempt - 1));
    if (!jitter) return delay;
    return Math.floor(Math.random() * delay);
  };
}

export function linear(options: LinearOptions = {}): BackoffStrategy {
  const {
    base = 1000,
    increment = 1000,
    maxDelay = 30_000,
    jitter = false,
  } = options;

  return (attempt: number): number => {
    const delay = Math.min(maxDelay, base + increment * (attempt - 1));
    if (!jitter) return delay;
    return Math.floor(Math.random() * delay);
  };
}

export function constant(delayMs: number): BackoffStrategy {
  return (): number => delayMs;
}
