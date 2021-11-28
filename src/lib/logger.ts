import { v4 as uuidv4 } from 'uuid';

export default class Logger {
  private name : string;
  private prefix : string;
  readonly uuid : string;

  constructor(name? : string, prefix? : string) {
    this.name = name || "";
    this.prefix = prefix || "";
    this.uuid = uuidv4();
  }

  get set() {
    return {
      name: (name: string) => this.name = name,
      prefix: (prefix: string) => this.prefix = prefix,
    }
  }

  log(...args : Array<any>) {
    const now = new Date(Date.now()).toUTCString();
    const name = this.name ? this.name : this.uuid;
    const prefix = this.prefix ? "->" + this.prefix : "";
    console.log(`[${now}]`, `[${name}${prefix}]`, args.join(" "));
  }
}