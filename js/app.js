(function () {
  var canvas = document.getElementById('smith-canvas');
  var chart = new SmithChart(canvas);

  var z0Input = document.getElementById('z0-input');
  var rInput = document.getElementById('r-input');
  var xInput = document.getElementById('x-input');
  var plotBtn = document.getElementById('plot-btn');

  var resZ = document.getElementById('res-z');
  var resGammaRect = document.getElementById('res-gamma-rect');
  var resGammaPolar = document.getElementById('res-gamma-polar');
  var resVswr = document.getElementById('res-vswr');
  var resRl = document.getElementById('res-rl');

  function fmt(n, digits) {
    if (!isFinite(n)) return '&infin;';
    return n.toFixed(digits === undefined ? 3 : digits);
  }

  function renderResults(z, gamma) {
    var vswr = Complex.vswrFromGamma(gamma);
    var rl = Complex.returnLossDb(gamma);
    var mag = Complex.cAbs(gamma);
    var angle = Complex.cAngleDeg(gamma);

    resZ.textContent = fmt(z.re) + (z.im >= 0 ? ' + j' : ' - j') + fmt(Math.abs(z.im));
    resGammaRect.textContent = fmt(gamma.re) + (gamma.im >= 0 ? ' + j' : ' - j') + fmt(Math.abs(gamma.im));
    resGammaPolar.textContent = fmt(mag) + ' ∠ ' + fmt(angle, 1) + '°';
    resVswr.textContent = isFinite(vswr) ? fmt(vswr, 2) + ' : 1' : '∞ : 1';
    resRl.textContent = isFinite(rl) ? fmt(rl, 2) + ' dB' : '∞ dB';
  }

  function plotFromRX(r, x, z0) {
    var z = Complex.make(r / z0, x / z0);
    var gamma = Complex.zToGamma(z);

    chart.draw();
    chart.drawVswrCircle(Complex.cAbs(gamma));
    chart.drawPoint(gamma.re, gamma.im);
    renderResults(z, gamma);
  }

  function plotFromInputs() {
    var z0 = parseFloat(z0Input.value) || 50;
    var r = parseFloat(rInput.value) || 0;
    var x = parseFloat(xInput.value) || 0;
    plotFromRX(r, x, z0);
  }

  plotBtn.addEventListener('click', plotFromInputs);
  [z0Input, rInput, xInput].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') plotFromInputs();
    });
  });

  canvas.addEventListener('click', function (e) {
    var rect = canvas.getBoundingClientRect();
    var px = (e.clientX - rect.left) * (canvas.width / rect.width);
    var py = (e.clientY - rect.top) * (canvas.height / rect.height);
    var gamma = chart.toGamma(px, py);

    if (Complex.cAbs(gamma) > 1) return; // outside the chart

    var z0 = parseFloat(z0Input.value) || 50;
    var z = Complex.gammaToZ(gamma);
    var r = z.re * z0;
    var x = z.im * z0;

    rInput.value = r.toFixed(2);
    xInput.value = x.toFixed(2);
    plotFromRX(r, x, z0);
  });

  chart.draw();
  plotFromInputs();
})();
