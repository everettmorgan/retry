import { randomUUID } from "crypto";

/** @deprecated Deep-import path kept for 1.0.x compatibility. The Retry class no longer logs. */
export default class Logger {
  readonly uuid: string = randomUUID();

  private name: string;
  private prefix: string;

  constructor(name?: string, prefix?: string) {
    this.name = name ?? "";
    this.prefix = prefix ?? "";
  }

  get set(): { name: (name: string) => void; prefix: (prefix: string) => void } {
    return {
      name: (name: string): void => {
        this.name = name;
      },
      prefix: (prefix: string): void => {
        this.prefix = prefix;
      },
    };
  }

  log(...args: unknown[]): void {
    const now = new Date(Date.now()).toUTCString();
    const name = this.name === "" ? this.uuid : this.name;
    const prefix = this.prefix === "" ? "" : `->${this.prefix}`;
    // eslint-disable-next-line no-console -- emitting to stdout is this class's single responsibility
    console.log(`[${now}]`, `[${name}${prefix}]`, args.join(" "));
  }
}
