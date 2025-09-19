// js/ad-chart.js - Renders the Device Activity chart

function initializeActivityChart() {
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;

  // Dummy data
  const data = [80, 120, 180, 90, 60, 110, 150, 140, 170, 200, 160, 100];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  // Chart area
  const padding = 40;
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - padding * 2;
  const chartH = h - padding * 1.5;

  // Find min/max
  const maxVal = 200;
  const minVal = 0;
  const range = maxVal - minVal;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, padding, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0.02)');

  // Draw gradient area under line
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(padding + chartW, h - padding/2);
  ctx.lineTo(padding, h - padding/2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw smooth line
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw dots
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#22336a';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Draw Y axis labels
  ctx.font = '13px Open Sans, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const val = minVal + (range * (4 - i) / 4);
    const y = padding + chartH * i / 4;
    ctx.fillText(Math.round(val), padding - 8, y);
    // Draw grid line
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw X axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  months.forEach((month, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    ctx.fillText(month, x, h - padding/2 + 8);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Initial draw
  if(document.getElementById('activityChart')) { // Only run if dashboard is the initial view
    initializeActivityChart();
  }
});
