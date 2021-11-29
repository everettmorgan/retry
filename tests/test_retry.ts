/* eslint-disable
no-undef,
no-unused-vars,
prefer-arrow-callback,
import/no-unresolved,
import/extensions
*/

import * as chaiAsPromise from 'chai-as-promised';
import * as chai from 'chai';

import { Retry } from '../src/index';

const { expect } = chai;

chai.use(chaiAsPromise);

describe('Retry', function Main(this: any) {
  this.timeout(10000);

  // eslint-disable-next-line no-undef
  it('can retry an execution context x times upon failure', async function canRetryManyTimes() {
    const maxAttempts = 5;
    let attempts = 0;

    const retry = new Retry((resolve: any, reject: any, $this: any) => {
      if (attempts < maxAttempts) {
        attempts += 1;
        resolve($this.reschedule(1000));
      } else {
        reject('no worked!');
      }
    });

    await expect(retry.schedule()).to.be.rejected;
    expect(attempts).to.equal(5);
  });

  it('can return the latest result after x runs', async function canReturnLatestResult() {
    const toResolve = 'it worked!';
    const maxAttempts = 5;

    let fail = true;
    let attempts = 0;

    const retry = new Retry((resolve: any, reject: any, $this: any) => {
      if (attempts === maxAttempts) fail = false;

      if (fail) {
        if (attempts < maxAttempts) {
          attempts += 1;
          resolve($this.reschedule(1000));
        } else {
          reject('no worked!');
        }
      } else {
        resolve(toResolve);
      }
    });

    expect(
      await retry.schedule().then(
        (res: any) => res,
        (err: any) => err,
      ),
    ).to.equal(toResolve);
  });

  it('can multiplex multiple calls for the same retry', function canMultiplex(done) {
    const maxAttempts = 5;

    let fail = true;
    let attempts = 0;

    const retry = new Retry((resolve: any, reject: any, $this: any) => {
      const toResolve = {};

      if (attempts === maxAttempts) fail = false;

      if (fail) {
        if (attempts < maxAttempts) {
          attempts += 1;
          resolve($this.reschedule(1000));
        } else {
          reject('no worked!');
        }
      } else {
        resolve(toResolve);
      }
    });

    const r1 = retry.schedule(1000);
    const r2 = retry.schedule();
    const r3 = retry.schedule();
    const r4 = retry.schedule();

    r1.then(async (result: any) => {
      expect(await r2).to.equal(result);
      expect(await r3).to.equal(result);
      expect(await r4).to.equal(result);
      done();
    });
  });
});
