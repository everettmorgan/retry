import { expect } from 'chai';

describe('A test', function() {
  it ('can do something', function() {
    const a: boolean = true;
    const b: boolean = false;
    expect(a).to.not.equal(b);
  })
});