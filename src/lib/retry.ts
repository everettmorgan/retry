import Logger from './logger';
import {createHash} from 'crypto';
import {v4 as uuidv4} from 'uuid';

enum RetryStatus { 
  Idle,       // 0
  Scheduled,  // 1
  Retrying,   // 2
  Completed,  // 3
  Failed,     // 4
  Stopped     // 5
}

interface RetryRefs {
  /**
   * The promise that's returned from the Retry
   */
  promise?: Promise<any>,
  /**
   * The setTimeout used to schedule the Retry
   */
  timeout?: NodeJS.Timeout,
  /**
   * The function for Retry to call
   */
  context?: RetryContext,
}

interface RetryContext {
  (
    /**
     * The Retry's resolve() function
     */
    resolve: (toResolve: any) => void,

    /**
     * The Retry's reject() function
     */
    reject: (toReject: any) => void,

    /**
     * A reference to the parent Retry
     */
    $this: Retry

  ): void;
}

/**
 * @class Retry
 */
export class Retry {
  /**
   * When the Retry was first created.
   */
  created: number;
  
  /**
   * Max attempts allowed for the Retry.
   */
  max_attempts?: number;

  /**
   * The UUID for the Retry.
   */
  readonly uuid: string;

  /**
   * Number of attempts that the Retry has made
   */
  private _attempts: number;

  /**
   * The Retry's current status
   */
  private _status: RetryStatus;

  /**
   * The Retry's Logger
   */
  private logger: any;

  /**
   * Important references for the Retry
   */
  private refs: RetryRefs;

  /**
   * When the Retry is set to run next (milliseconds)
   */
  protected milliseconds_from_now?: number;

  /**
   * When the Retry is set to run next (ISO)
   */
  protected milliseconds_from_now_string?: string;

  constructor(context: RetryContext) {
    this.milliseconds_from_now = undefined;
    this.milliseconds_from_now_string = undefined;
    this.created = Date.now();
    this.max_attempts = undefined;
    this.uuid = uuidv4();
    this._attempts = 0;
    this._status = 0;

    this.logger = new Logger();
    this.logger.set.name("Retry");
    this.logger.set.prefix(`${this.checksum()}`);

    this.refs = {
      promise: undefined,
      timeout: undefined,
      context: context,
    }
  }


  /**
   * Returns the status as a String
   */
  get status() {
    switch (this._status) {
      case RetryStatus.Idle:
        return "idle";
      case RetryStatus.Scheduled:
        return "scheduled";
      case RetryStatus.Retrying:
        return "retrying";
      case RetryStatus.Completed:
        return "completed";
      case RetryStatus.Failed:
        return "failed";
      case RetryStatus.Stopped:
        return "stopped";
    }
  }


  /**
   * Updates this.status based on a status.Something
   * 
   * @param new_val - new status value
   */
  set status(new_val: any) {
    this._status = new_val;
  }

  get attempts() {
    return this._attempts;
  }

  /**
   * Returns the MD5 computed checksum for the Retry.
   */
  private checksum(): string {
    const uid = `${this.created}:${this.uuid}`;
    return createHash("md5")
      .update(uid)
      .digest("hex");
  }

  /**
   * Schedules the Retry to trigger for the `context` based on the `time`.
   * 
   * @param time - time to schedule the Retry (milliseconds).
   */
  public async schedule(time: number = 0): Promise<any> {
    if (this._status === RetryStatus.Retrying || this._status === RetryStatus.Scheduled) {
      this.logger.log("already retrying -> returning watcher promise");
      return this.refs.promise;
    }

    this.milliseconds_from_now = time;
    this.milliseconds_from_now_string = new Date(Date.now() + time).toUTCString();

    this.refs.promise = new Promise((resolve, reject) => {
      const wrapResolve = (toResolve: any) => {
        this.status = RetryStatus.Completed;
        this._attempts++;
        resolve(toResolve);
      }

      const wrapReject = (toReject: any) => {
        this.status = RetryStatus.Failed;
        this._attempts++;
        reject(toReject);
      }

      this.refs.timeout = setTimeout(async () => {
        this._status = RetryStatus.Retrying;
        if (this._attempts) this.logger.log(`retrying...attempt #${this._attempts}`);        
        this.refs.context && this.refs.context(wrapResolve, wrapReject, this);
      }, time);
    });

    this.status = RetryStatus.Scheduled;
    return this.refs.promise;
  }


  /**
   * Clears any pending timeouts and runs schedule() for the new time.
   * 
   * @param newTime - new time to schedule the Retry (milliseconds).
   */
  public async reschedule(newTime: number): Promise<any> {
    if (this._attempts) this.logger.log(`rescheduled for ${this.milliseconds_from_now_string}`);
    this.stop();
    return this.schedule(newTime);
  }

  /**
   * Stops the scheduled Retry.
   */
  public stop(): void {
    if (this.status !== RetryStatus.Retrying) {
      clearTimeout(this.refs.timeout as NodeJS.Timeout);
      this.status = RetryStatus.Stopped;
    }
  }
}