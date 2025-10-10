// js/analyticstat.js - For future analytics and statistics functionality. 

// Draws mini charts in the stat cards.
function initializeDashboardStatCharts() {
  function drawMiniChart(canvasId, chartType, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const height = canvas.height;
    const width = canvas.width;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal;

    if (chartType === 'line') {
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - minVal) / range) * height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    if (chartType === 'bar') {
      const barWidth = width / data.length;
      data.forEach((val, i) => {
        const barHeight = ((val - minVal) / range) * height;
        const x = i * barWidth;
        const y = height - barHeight;
        ctx.fillRect(x, y, barWidth - (barWidth > 4 ? 2 : 0), barHeight);
      });
    }
  }

  // Dummy data
  const userData = [10, 40, 20, 50, 30, 60, 40];
  const deviceData = [30, 20, 50, 40, 70, 60, 80];
  const alertData = [60, 50, 40, 70, 80, 50, 40];

  drawMiniChart('userChart', 'line', userData, 'rgba(233, 236, 239, 0.5)');
  drawMiniChart('deviceChart', 'line', deviceData, 'rgba(233, 236, 239, 0.5)');
  drawMiniChart('alertChart', 'line', alertData, 'rgba(233, 236, 239, 0.5)');
}

document.addEventListener('DOMContentLoaded', () => {
  // Initial draw
  if(document.getElementById('userChart')) { // Only run if dashboard is the initial view
    initializeDashboardStatCharts();
  }
}); 