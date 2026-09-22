// Minimal complex-number helpers, shared by the browser UI and the node test suite.
(function (root) {
  function make(re, im) { return { re: re, im: im }; }

  function cAdd(a, b) { return make(a.re + b.re, a.im + b.im); }
  function cSub(a, b) { return make(a.re - b.re, a.im - b.im); }
  function cMul(a, b) {
    return make(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  }
  function cDiv(a, b) {
    var denom = b.re * b.re + b.im * b.im;
    return make(
      (a.re * b.re + a.im * b.im) / denom,
      (a.im * b.re - a.re * b.im) / denom
    );
  }
  function cAbs(a) { return Math.hypot(a.re, a.im); }
  function cAngleDeg(a) { return Math.atan2(a.im, a.re) * 180 / Math.PI; }

  // z = R/Z0 + jX/Z0  ->  Gamma = (z - 1) / (z + 1)
  function zToGamma(z) {
    return cDiv(cSub(z, make(1, 0)), cAdd(z, make(1, 0)));
  }

  // Gamma -> z = (1 + Gamma) / (1 - Gamma)
  function gammaToZ(gamma) {
    return cDiv(cAdd(make(1, 0), gamma), cSub(make(1, 0), gamma));
  }

  function vswrFromGamma(gamma) {
    var mag = cAbs(gamma);
    if (mag >= 1) return Infinity;
    return (1 + mag) / (1 - mag);
  }

  function returnLossDb(gamma) {
    var mag = cAbs(gamma);
    if (mag <= 0) return Infinity;
    return -20 * Math.log10(mag);
  }

  var api = {
    make: make,
    cAdd: cAdd,
    cSub: cSub,
    cMul: cMul,
    cDiv: cDiv,
    cAbs: cAbs,
    cAngleDeg: cAngleDeg,
    zToGamma: zToGamma,
    gammaToZ: gammaToZ,
    vswrFromGamma: vswrFromGamma,
    returnLossDb: returnLossDb
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Complex = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
