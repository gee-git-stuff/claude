const assert = require('assert');
const {
  make, cAbs, zToGamma, gammaToZ, vswrFromGamma, returnLossDb
} = require('../js/complex.js');

function approxEqual(a, b, eps) {
  return Math.abs(a - b) < (eps || 1e-9);
}

// Matched load (z = 1): Gamma = 0, VSWR = 1, infinite return loss.
(function testMatchedLoad() {
  const gamma = zToGamma(make(1, 0));
  assert.ok(approxEqual(gamma.re, 0));
  assert.ok(approxEqual(gamma.im, 0));
  assert.ok(approxEqual(vswrFromGamma(gamma), 1));
  assert.strictEqual(returnLossDb(gamma), Infinity);
})();

// Short circuit (z = 0): Gamma = -1, VSWR -> infinity.
(function testShortCircuit() {
  const gamma = zToGamma(make(0, 0));
  assert.ok(approxEqual(gamma.re, -1));
  assert.ok(approxEqual(gamma.im, 0));
  assert.strictEqual(vswrFromGamma(gamma), Infinity);
})();

// z = 2 (pure resistive, double Z0): Gamma = 1/3, VSWR = 2.
(function testDoubleImpedance() {
  const gamma = zToGamma(make(2, 0));
  assert.ok(approxEqual(gamma.re, 1 / 3));
  assert.ok(approxEqual(gamma.im, 0));
  assert.ok(approxEqual(vswrFromGamma(gamma), 2));
})();

// Round trip z -> Gamma -> z should return the original impedance.
(function testRoundTrip() {
  const cases = [make(1, 1), make(0.5, -0.5), make(3, 2), make(0.2, 4)];
  cases.forEach(function (z) {
    const gamma = zToGamma(z);
    assert.ok(cAbs(gamma) <= 1 + 1e-9, 'Gamma should stay within the unit circle for passive z');
    const back = gammaToZ(gamma);
    assert.ok(approxEqual(back.re, z.re, 1e-6));
    assert.ok(approxEqual(back.im, z.im, 1e-6));
  });
})();

console.log('All Smith chart math tests passed.');
