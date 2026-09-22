// Draws the Smith chart grid and converts between canvas pixels and the
// normalized reflection-coefficient (Gamma) plane.
(function (root) {
  var RESISTANCE_CIRCLES = [0, 0.2, 0.5, 1, 2, 5, 10];
  var REACTANCE_ARCS = [0.2, 0.5, 1, 2, 5, 10];

  function SmithChart(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cx = canvas.width / 2;
    this.cy = canvas.height / 2;
    this.radiusPx = Math.min(canvas.width, canvas.height) / 2 - 20;
  }

  // Gamma-plane (re, im), both in [-1, 1], to canvas pixel coordinates.
  SmithChart.prototype.toPixel = function (re, im) {
    return {
      x: this.cx + re * this.radiusPx,
      y: this.cy - im * this.radiusPx
    };
  };

  // Canvas pixel coordinates back to the Gamma plane.
  SmithChart.prototype.toGamma = function (px, py) {
    return {
      re: (px - this.cx) / this.radiusPx,
      im: -(py - this.cy) / this.radiusPx
    };
  };

  SmithChart.prototype._clipToUnitCircle = function () {
    var ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radiusPx, 0, 2 * Math.PI);
    ctx.clip();
  };

  SmithChart.prototype._strokeCircleGamma = function (centerRe, centerIm, radius) {
    var ctx = this.ctx;
    var c = this.toPixel(centerRe, centerIm);
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius * this.radiusPx, 0, 2 * Math.PI);
    ctx.stroke();
  };

  SmithChart.prototype.draw = function () {
    var ctx = this.ctx;
    var w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Outer unit circle (|Gamma| = 1).
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radiusPx, 0, 2 * Math.PI);
    ctx.stroke();

    // Constant-resistance circles: center (r/(r+1), 0), radius 1/(r+1).
    ctx.save();
    this._clipToUnitCircle();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#2563eb';
    RESISTANCE_CIRCLES.forEach(function (r) {
      var center = r / (r + 1);
      var radius = 1 / (r + 1);
      this._strokeCircleGamma(center, 0, radius);
    }, this);

    // Constant-reactance arcs: center (1, 1/x), radius 1/x, clipped to the chart.
    ctx.strokeStyle = '#16a34a';
    ctx.setLineDash([4, 3]);
    REACTANCE_ARCS.forEach(function (x) {
      this._strokeCircleGamma(1, 1 / x, 1 / x);
      this._strokeCircleGamma(1, -1 / x, 1 / x);
    }, this);
    ctx.setLineDash([]);
    ctx.restore();

    // Real axis (x = 0 line, pure resistance).
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    var left = this.toPixel(-1, 0);
    var right = this.toPixel(1, 0);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  };

  SmithChart.prototype.drawVswrCircle = function (gammaMag) {
    var ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, gammaMag * this.radiusPx, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  };

  SmithChart.prototype.drawPoint = function (re, im) {
    var ctx = this.ctx;
    var p = this.toPixel(re, im);
    ctx.save();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };

  var api = { SmithChart: SmithChart };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SmithChart = SmithChart;
  }
})(typeof window !== 'undefined' ? window : globalThis);
