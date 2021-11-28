import * as chai from 'chai';
const { expect } = chai;

import {Retry} from '../src/index';
import * as chaiAsPromise from 'chai-as-promised';

chai.use(chaiAsPromise);

describe("Retry", function(this: any) {
  this.timeout(10000);

  it ('can retry an execution context x times upon failure', async function() {
    const maxAttempts = 5;
    let attempts = 0;

    const retry = new Retry((resolve, reject, retry) => {
      if (attempts < maxAttempts) {
        attempts++;
        resolve(retry.reschedule(1000));
      } else {
        reject("no worked!");
      }
    })

    await expect(retry.schedule()).to.be.rejected;
    expect(attempts).to.equal(5);
  })

  it ('can return the latest result after x runs', async function() {
    const toResolve = "it worked!";
    const maxAttempts = 5;
    
    let fail = true;
    let attempts = 0;

    const retry = new Retry((resolve, reject, retry) => {
      if (attempts === maxAttempts) fail = false;

      if (fail) {
        if (attempts < maxAttempts) {
          attempts++;
          resolve(retry.reschedule(1000));
        } else {
          reject("no worked!");
        }
      } else {
        resolve(toResolve);
      }
    })

    expect(await retry.schedule().then(res => res, err => err)).to.equal(toResolve);
  })

  it ('can multiplex multiple calls for the same retry', function(done) {
    const maxAttempts = 5;
    
    let fail = true;
    let attempts = 0;

    const retry = new Retry((resolve, reject, retry) => {
      const toResolve = {};

      if (attempts === maxAttempts) fail = false;

      if (fail) {
        if (attempts < maxAttempts) {
          attempts++;
          resolve(retry.reschedule(1000));
        } else {
          reject("no worked!");
        }
      } else {
        resolve(toResolve);
      }
    })

    const r1 = retry.schedule(1000);
    const r2 = retry.schedule();
    const r3 = retry.schedule();
    const r4 = retry.schedule();
    
    r1.then(async (result) => {
      expect(await r2).to.equal(result);
      expect(await r3).to.equal(result);
      expect(await r4).to.equal(result);
      done();
    })
  })

  it('can update the status successfully', function() {
    const retry = new Retry((resolve, reject, $this) => console.log('woo'));
    retry.status = 0;
    const zero = retry.status;
    retry.status = 1;
    const one = retry.status;
    retry.status = 2;
    const two = retry.status;
    retry.status = 3;
    const three = retry.status;
    retry.status = 4;
    const four = retry.status;
    retry.status = 5;
    const five = retry.status;

    expect(zero).to.equal('idle') &&
    expect(one).to.equal('scheduled') &&
    expect(two).to.equal('retrying') &&
    expect(three).to.equal('completed') &&
    expect(four).to.equal('failed') &&
    expect(five).to.equal('stopped');
  })
})