// ad-gauge.js
// Usage: Place <div class="gauge" data-label="Label" data-value="42" data-unit="unit"></div> in your HTML.
// To update: window.setGaugeValue(element, value)
//
// Example for demo/testing:
//
// // Set initial gauge value for demo
// const gauge = document.querySelector('.gauge[data-label="Moisture Rate"]');
// window.setGaugeValue(gauge, 50); // sets value to 50%
//
// // Temporary demo data for all gauges
// setTimeout(() => {
//   document.querySelectorAll('.gauge').forEach((el, i) => {
//     window.setGaugeValue(el, [50, 70, 30][i] || 40);
//   });
//   // Change again after 2 seconds
//   setTimeout(() => {
//     document.querySelectorAll('.gauge').forEach((el, i) => {
//       window.setGaugeValue(el, [20, 90, 60][i] || 60);
//     });
//   }, 2000);
// }, 2000);

(function() {
  function renderGauge(el) {
    const value = el.getAttribute('data-value') || '';
    const unit = el.getAttribute('data-unit') || '';
    const size = 120;
    const stroke = 12;
    const radius = (size - stroke) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const startAngle = 135;
    const endAngle = 405;
    const percent = parseFloat(value) / 100;
    const angle = startAngle + (endAngle - startAngle) * percent;
    const arc = describeArc(cx, cy, radius, startAngle, angle);
    const bgArc = describeArc(cx, cy, radius, startAngle, endAngle);
    el.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <path d="${bgArc}" fill="none" stroke="#444e6e" stroke-width="${stroke}" />
        <path d="${arc}" fill="none" stroke="url(#gaugeGradient)" stroke-width="${stroke}" stroke-linecap="round" />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#bfc9da"/>
            <stop offset="60%" stop-color="#ffea92"/>
            <stop offset="100%" stop-color="#ff5e5e"/>
          </linearGradient>
        </defs>
        <text x="50%" y="58%" text-anchor="middle" font-size="1.3em" fill="#fff" font-family="inherit">${value}</text>
        <text x="50%" y="70%" text-anchor="middle" font-size="0.8em" fill="#bfc9da" font-family="inherit">${unit}</text>
      </svg>
    `;
  }

  // Helper to describe an SVG arc
  function describeArc(cx, cy, r, start, end) {
    const startRad = (Math.PI / 180) * start;
    const endRad = (Math.PI / 180) * end;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = end - start <= 180 ? 0 : 1;
    return `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}`;
  }

  // Render all gauges on page load
  function renderAllGauges() {
    document.querySelectorAll('.gauge').forEach(renderGauge);
  }

  // Expose a function to update gauge value
  window.setGaugeValue = function(el, value, unit) {
    el.setAttribute('data-value', value);
    if (unit !== undefined) el.setAttribute('data-unit', unit);
    renderGauge(el);
  };

  // Initial render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAllGauges);
  } else {
    renderAllGauges();
  }
})(); 