// js/ad-chart.js - Renders the Device Activity chart

// Global variables for chart data
let currentFilter = 'monthly';
const REALTIME_CHART_ENABLED = true;
const REALTIME_REFRESH_MS = 10000; // 10s
let activityChartIntervalId = null;
let chartData = {
  monthly: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0], // September = 2 devices
  yearly: [0, 0, 0, 0, 0, 2] // 2025 = 2 devices
};

async function loadSensorData() {
  try {
    const token = localStorage.getItem('jwt_token') || 
                 localStorage.getItem('sessionToken') || 
                 localStorage.getItem('session_token');
    
    if (!token) {
      console.log('No token found, using default data');
      return;
    }

    console.log('Loading sensor data with filter:', currentFilter);

    // Use the activity-data endpoint for proper filtering
    const response = await fetch(`/api/sensor/activity-data?filter=${currentFilter}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Activity data response:', result);
      
      if (result.success && result.data) {
        const data = result.data;
        
        // Process data based on filter type
        if (currentFilter === 'monthly') {
          // Create monthly data array (12 months)
          chartData.monthly = new Array(12).fill(0);
          
          // The API returns data.datasets with sensor arrays
          if (data.datasets) {
            // Count devices (not sum sensor readings) - one device = 3 sensors
            for (let i = 0; i < 12; i++) {
              let deviceCount = 0;
              // If any sensor has data for this month, count it as 1 device
              if ((data.datasets.temperature && data.datasets.temperature[i] > 0) ||
                  (data.datasets.humidity && data.datasets.humidity[i] > 0) ||
                  (data.datasets.gas && data.datasets.gas[i] > 0)) {
                deviceCount = 1; // One device active this month
              }
              chartData.monthly[i] = deviceCount;
            }
          } else {
            // Fallback to hardcoded data
            chartData.monthly[8] = 2; // September = 2 devices
          }
          
          console.log('Updated monthly data:', chartData.monthly);
        } else if (currentFilter === 'yearly') {
          // Create yearly data array (6 years: 2020-2025)
          chartData.yearly = new Array(6).fill(0);
          
          // The API returns data.datasets with sensor arrays
          if (data.datasets && data.labels) {
            // Map years to our 6-year array (2020-2025)
            data.labels.forEach((yearStr, index) => {
              const year = parseInt(yearStr);
              const yearIndex = year - 2020; // 2020=0, 2021=1, ..., 2025=5
              
              if (yearIndex >= 0 && yearIndex < 6) {
                let deviceCount = 0;
                // If any sensor has data for this year, count it as 1 device
                if ((data.datasets.temperature && data.datasets.temperature[index] > 0) ||
                    (data.datasets.humidity && data.datasets.humidity[index] > 0) ||
                    (data.datasets.gas && data.datasets.gas[index] > 0)) {
                  deviceCount = 1; // One device active this year
                }
                chartData.yearly[yearIndex] = deviceCount;
              }
            });
          } else {
            // Fallback to hardcoded data
            chartData.yearly[5] = 2; // 2025 = 2 devices
          }
          
          console.log('Updated yearly data:', chartData.yearly);
        }
        
        console.log('Using filter:', currentFilter, 'Data:', chartData);
      }
    } else {
      console.log('Failed to fetch data, using default');
      // Use default data based on filter
      if (currentFilter === 'monthly') {
        chartData.monthly = [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]; // September = 2 devices
      } else if (currentFilter === 'yearly') {
        chartData.yearly = [0, 0, 0, 0, 0, 2]; // 2025 = 2 devices
      }
    }
  } catch (error) {
    console.log('Error loading data, using default:', error);
    // Use default data based on filter
    if (currentFilter === 'monthly') {
      chartData.monthly = [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]; // September = 2 devices
    } else if (currentFilter === 'yearly') {
      chartData.yearly = [0, 0, 0, 0, 0, 2]; // 2025 = 2 devices
    }
  }
}

async function loadActivityCounts() {
  try {
    const token = localStorage.getItem('jwt_token') || 
                  localStorage.getItem('sessionToken') || 
                  localStorage.getItem('session_token');
    const elToday = document.getElementById('count-today');
    const el7d = document.getElementById('count-7d');
    const el30d = document.getElementById('count-30d');
    if (!elToday || !el7d || !el30d) return;

    if (!token) {
      elToday.textContent = 'Today: 0';
      el7d.textContent = 'Last 7d: 0';
      el30d.textContent = 'Last 30d: 0';
      return;
    }

    const resp = await fetch('/api/sensor/activity-counts', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('counts fetch failed');
    const json = await resp.json();
    const c = json?.counts || { today: 0, last7d: 0, last30d: 0 };
    elToday.textContent = `Today: ${c.today || 0}`;
    el7d.textContent = `Last 7d: ${c.last7d || 0}`;
    el30d.textContent = `Last 30d: ${c.last30d || 0}`;
  } catch (e) {
    console.log('Failed to load activity counts:', e.message);
  }
}

function initializeActivityChart() {
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;
  
  console.log('Initializing activity chart with filter:', currentFilter);
  console.log('Chart data:', chartData);
  
  const ctx = canvas.getContext('2d');
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;

  // Get data based on current filter
  let data, labels;
  if (currentFilter === 'yearly') {
    data = chartData.yearly;
    labels = ['2020', '2021', '2022', '2023', '2024', '2025'];
  } else {
    // Default to monthly
    data = chartData.monthly;
    labels = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  }

  // Chart area
  const padding = 40;
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - padding * 2;
  const chartH = h - padding * 1.5;

  // Find min/max - Scale for device count (0-5 devices max)
  const maxDataVal = Math.max(...data);
  const maxVal = Math.max(5, Math.ceil(maxDataVal * 1.2)); // At least 5, or 20% above max data
  const minVal = 0;
  const range = maxVal - minVal;

  // Modern gradient fill matching page design
  const grad = ctx.createLinearGradient(0, padding, 0, h);
  grad.addColorStop(0, 'rgba(74, 158, 255, 0.25)');
  grad.addColorStop(0.5, 'rgba(74, 158, 255, 0.15)');
  grad.addColorStop(1, 'rgba(74, 158, 255, 0.05)');

  // Draw curved gradient area under line
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      // Create smooth curves for the fill area too
      const prevX = padding + ((i - 1) * chartW / (data.length - 1));
      const prevY = padding + chartH - ((data[i - 1] - minVal) / range) * chartH;
      const cp1x = prevX + (x - prevX) / 3;
      const cp1y = prevY;
      const cp2x = x - (x - prevX) / 3;
      const cp2y = y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
  });
  ctx.lineTo(padding + chartW, h - padding/2);
  ctx.lineTo(padding, h - padding/2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw smooth curved line
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      // Create smooth curves between points
      const prevX = padding + ((i - 1) * chartW / (data.length - 1));
      const prevY = padding + chartH - ((data[i - 1] - minVal) / range) * chartH;
      const cp1x = prevX + (x - prevX) / 3;
      const cp1y = prevY;
      const cp2x = x - (x - prevX) / 3;
      const cp2y = y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
  });
  ctx.strokeStyle = '#4a9eff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw modern dots matching page design
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    
    // Only draw dots for non-zero values
    if (val > 0) {
      // Outer glow effect
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
      ctx.fill();
      
      // Main dot
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#4a9eff';
      ctx.fill();
      
      // Inner highlight
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  });

  // Draw Y axis labels - Dynamic scaling
  ctx.font = '12px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#bfc9da';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const val = minVal + (range * (5 - i) / 5);
    const y = padding + chartH * i / 5;
    ctx.fillText(Math.round(val), padding - 8, y);
    // Draw subtle grid line matching page design
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw X axis labels
  ctx.font = '11px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#bfc9da';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  labels.forEach((label, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    ctx.fillText(label, x, h - padding/2 + 8);
  });
}

function startRealtimeActivityUpdates() {
  if (!REALTIME_CHART_ENABLED) return;
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;
  if (activityChartIntervalId) return; // already running

  activityChartIntervalId = setInterval(async () => {
    // Do nothing if page is hidden to save resources
    if (document.hidden) return;
    await loadSensorData();
    await loadActivityCounts();
    initializeActivityChart();
  }, REALTIME_REFRESH_MS);
}

function stopRealtimeActivityUpdates() {
  if (activityChartIntervalId) {
    clearInterval(activityChartIntervalId);
    activityChartIntervalId = null;
  }
}

document.addEventListener('visibilitychange', () => {
  // Pause when hidden, resume when visible (if dashboard canvas exists)
  if (document.hidden) {
    stopRealtimeActivityUpdates();
  } else {
    const canvas = document.getElementById('activityChart');
    if (canvas) startRealtimeActivityUpdates();
  }
});

// Function to update chart when filter changes
async function updateChartWithFilter(filter) {
  currentFilter = filter;
  await loadSensorData();
  initializeActivityChart();
}

// Add filter event listener
document.addEventListener('change', (event) => {
  if (event.target && event.target.classList.contains('activity-filter')) {
    console.log('Filter changed to:', event.target.value);
    updateChartWithFilter(event.target.value);
  }
});

// Also listen for clicks on the filter dropdown
document.addEventListener('click', (event) => {
  if (event.target && event.target.classList.contains('activity-filter')) {
    console.log('Filter dropdown clicked');
  }
});

// Initialize chart when dashboard is loaded
function initializeChartOnLoad() {
  const canvas = document.getElementById('activityChart');
  if (canvas) {
    Promise.all([loadSensorData(), loadActivityCounts()]).then(() => {
      initializeActivityChart();
      startRealtimeActivityUpdates();
    });
  }
}

// Listen for dashboard content changes
document.addEventListener('DOMContentLoaded', initializeChartOnLoad);

// Also listen for custom events when dashboard is loaded via SPA
document.addEventListener('dashboardLoaded', initializeChartOnLoad);

// Handle SPA navigation to stop/start polling appropriately
window.addEventListener('spa:navigate:after', (e) => {
  const to = (e && e.detail && e.detail.to) || '';
  if (to === 'dashboard') {
    // Start if on dashboard and canvas exists
    initializeChartOnLoad();
  } else {
    // Stop when leaving dashboard
    stopRealtimeActivityUpdates();
  }
});
