import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line import/no-unresolved, import/extensions
import Logger from './logger';

// eslint-disable-next-line
enum RetryStatus {
  // eslint-disable-next-line
  Idle,       // 0
  // eslint-disable-next-line
  Scheduled,  // 1
  // eslint-disable-next-line
  Retrying,   // 2
  // eslint-disable-next-line
  Completed,  // 3
  // eslint-disable-next-line
  Failed,     // 4
  // eslint-disable-next-line
  Stopped     // 5
}

/**
 * @class Retry
 */
// eslint-disable-next-line
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
  protected attempts: number;

  /**
   * The Retry's current status
   */
  protected status: RetryStatus;

  /**
   * The Retry's Logger
   */
  private logger: any;

  /**
   * Important references for the Retry
   */
  // eslint-disable-next-line no-use-before-define
  private refs: RetryRefs;

  /**
   * When the Retry is set to run next (milliseconds)
   */
  protected milliseconds_from_now?: number;

  /**
   * When the Retry is set to run next (ISO)
   */
  protected milliseconds_from_now_string?: string;

  // eslint-disable-next-line no-use-before-define
  constructor(context: RetryContext) {
    this.milliseconds_from_now = undefined;
    this.milliseconds_from_now_string = undefined;
    this.created = Date.now();
    this.max_attempts = undefined;
    this.uuid = uuidv4();
    this.attempts = 0;
    this.status = 0;

    this.logger = new Logger();
    this.logger.set.name('Retry');
    this.logger.set.prefix(`${this.checksum()}`);

    this.refs = {
      promise: undefined,
      timeout: undefined,
      context,
    };
  }

  /**
   * Returns the MD5 computed checksum for the Retry.
   */
  private checksum(): string {
    const uid = `${this.created}:${this.uuid}`;
    return createHash('md5')
      .update(uid)
      .digest('hex');
  }

  /**
   * Schedules the Retry to trigger for the `context` based on the `time`.
   *
   * @param time - time to schedule the Retry (milliseconds).
   */
  public async schedule(time: number = 0): Promise<any> {
    if (this.status === RetryStatus.Retrying || this.status === RetryStatus.Scheduled) {
      this.logger.log('already retrying -> returning watcher promise');
      return this.refs.promise;
    }

    this.milliseconds_from_now = time;
    this.milliseconds_from_now_string = new Date(Date.now() + time).toUTCString();

    this.refs.promise = new Promise((resolve, reject) => {
      const wrapResolve = (toResolve: any) => {
        this.status = RetryStatus.Completed;
        this.attempts += 1;
        resolve(toResolve);
      };

      const wrapReject = (toReject: any) => {
        this.status = RetryStatus.Failed;
        this.attempts += 1;
        reject(toReject);
      };

      this.refs.timeout = setTimeout(async () => {
        this.status = RetryStatus.Retrying;
        if (this.attempts) this.logger.log(`retrying...attempt #${this.attempts}`);
        if (this.refs.context) {
          this.refs.context(wrapResolve, wrapReject, this);
        }
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
    if (this.attempts) this.logger.log(`rescheduled for ${this.milliseconds_from_now_string}`);
    this.stop();
    return this.schedule(newTime);
  }

  /**
   * Stops the scheduled Retry.
   */
  public stop(): void {
    // eslint-disable-next-line no-undef
    clearTimeout(this.refs.timeout as NodeJS.Timeout);
    this.refs.timeout = undefined;
    this.status = RetryStatus.Stopped;
  }
}

interface RetryContext {
  (
    /**
     * The Retry's resolve() function
     */
    // eslint-disable-next-line no-unused-vars
    resolve: (toResolve: any) => void,

    /**
     * The Retry's reject() function
     */
    // eslint-disable-next-line no-unused-vars
    reject: (toReject: any) => void,

    /**
     * A reference to the parent Retry
     */
    // eslint-disable-next-line no-unused-vars
    $this: Retry

  ): void;
}

interface RetryRefs {
  /**
   * The promise that's returned from the Retry
   */
  promise?: Promise<any>,
  /**
   * The setTimeout used to schedule the Retry
   */
  // eslint-disable-next-line no-undef
  timeout?: NodeJS.Timeout,
  /**
   * The function for Retry to call
   */
  context?: RetryContext,
}
