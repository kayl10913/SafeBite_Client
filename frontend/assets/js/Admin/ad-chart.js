// js/ad-chart.js - Renders the Device Activity chart and manages dashboard data

// Global variables to store fetched data
let activeUsersData = 0;
let spoilageAlertsData = 0;
let alertsByUser = [];
let loggedInUserData = null;

// Function to fetch dashboard statistics from API
function fetchDashboardStats() {
  // Get JWT token from localStorage
  const jwtToken = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
  
  if (!jwtToken) {
    console.error('No JWT token found. Please log in again.');
    // Redirect to admin login if no token
    window.location.href = '/admin-login';
    return;
  }
  
  fetch('/api/admin/statistics?type=dashboard-stats', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication failed. Redirecting to login...');
          window.location.href = '/admin-login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success && data.dashboard_stats) {
        activeUsersData = data.dashboard_stats.active_users;
        spoilageAlertsData = data.dashboard_stats.spoilage_alerts;
        // Update device reports data as well
        updateDeviceReportsData(data.dashboard_stats.device_reports);
        
        // Store logged-in user information
        if (data.logged_in_user) {
          loggedInUserData = data.logged_in_user;
          console.log('Logged-in user stats:', data.logged_in_user);
        }
        
        updateDashboardDisplay();
      }
    })
    .catch(error => console.error('Error fetching dashboard stats:', error));
}

// Fetch alerts grouped by user (role = 'User')
function fetchAlertsByUser() {
  const jwtToken = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
  if (!jwtToken) return;
  fetch('/api/admin/alerts-by-user', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  })
    .then(r => r.ok ? r.json() : [])
    .then(rows => {
      alertsByUser = Array.isArray(rows) ? rows : [];
      // Always derive total spoilage alerts from grouped data
      spoilageAlertsData = alertsByUser.reduce((t, it) => t + (parseInt(it.alert_count) || 0), 0);
      updateDashboardDisplay();
    })
    .catch(err => console.error('Error fetching alerts-by-user:', err));
}

// Function to fetch active users count from API (legacy)
function fetchActiveUsers() {
  // Get JWT token from localStorage
  const jwtToken = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
  
  if (!jwtToken) {
    console.error('No JWT token found. Please log in again.');
    return;
  }
  
  fetch('/api/admin/statistics?type=active-users', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication failed.');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      activeUsersData = data.active_user_count;
      updateDashboardDisplay();
    })
    .catch(error => console.error('Error fetching active users:', error));
}

// Function to fetch spoilage alerts count from API (legacy)
function fetchSpoilageAlerts() {
  // Get JWT token from localStorage
  const jwtToken = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
  
  if (!jwtToken) {
    console.error('No JWT token found. Please log in again.');
    return;
  }
  
  fetch('/api/admin/spoilage-alerts', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication failed.');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      alertsByUser = data;
      // Calculate total alerts count
      spoilageAlertsData = data.reduce((total, item) => total + parseInt(item.alert_count), 0);
      updateDashboardDisplay();
    })
    .catch(error => console.error('Error fetching spoilage alerts:', error));
}

// Function to update device reports data
function updateDeviceReportsData(deviceReportsCount) {
  // Update the device reports value in the dashboard data
  const currentDate = new Date().toISOString().split('T')[0];
  if (dashboardData.statCards[currentDate]) {
    dashboardData.statCards[currentDate].deviceReports.value = deviceReportsCount;
  }
}

// Function to get alerts count for a specific user
function getAlertsForUser(userId) {
  const userAlert = alertsByUser.find(item => item.user_id == userId);
  return userAlert ? parseInt(userAlert.alert_count) : 0;
}

// Function to get all alerts data
function getAllAlertsData() {
  return alertsByUser;
}

// Dashboard Data with filter functionality
const dashboardData = {
  // Stat Cards Data - Different data for different dates
  statCards: {
    '2025-06-01': {
      activeUsers: {
        value: 141,
        label: "Active Users",
        icon: "users",
        chartData: [65, 78, 90, 85, 95, 88, 92, 87, 94, 89, 96, 91]
      },
      deviceReports: {
        value: 89,
        label: "Device Reports",
        icon: "devices",
        chartData: [45, 52, 48, 61, 55, 58, 62, 67, 71, 68, 75, 72]
      },
      spoilageAlerts: {
        value: 31,
        label: "Spoilage alerts triggered",
        icon: "alerts",
        chartData: [12, 15, 18, 14, 22, 19, 25, 28, 24, 30, 27, 33]
      }
    },
    '2025-06-02': {
      activeUsers: {
        value: 156,
        label: "Active Users",
        icon: "users",
        chartData: [72, 85, 98, 92, 105, 95, 108, 102, 110, 104, 115, 109]
      },
      deviceReports: {
        value: 103,
        label: "Device Reports",
        icon: "devices",
        chartData: [52, 65, 58, 72, 68, 75, 78, 82, 88, 85, 92, 89]
      },
      spoilageAlerts: {
        value: 28,
        label: "Spoilage alerts triggered",
        icon: "alerts",
        chartData: [10, 13, 16, 12, 20, 17, 23, 26, 22, 28, 25, 29]
      }
    },
    '2025-06-03': {
      activeUsers: {
        value: 128,
        label: "Active Users",
        icon: "users",
        chartData: [58, 71, 83, 77, 87, 80, 85, 79, 88, 82, 90, 84]
      },
      deviceReports: {
        value: 76,
        label: "Device Reports",
        icon: "devices",
        chartData: [38, 45, 42, 55, 48, 52, 58, 62, 68, 65, 72, 69]
      },
      spoilageAlerts: {
        value: 35,
        label: "Spoilage alerts triggered",
        icon: "alerts",
        chartData: [15, 18, 21, 17, 25, 22, 28, 31, 27, 33, 30, 36]
      }
    }
  },
  
  // Device Activity Chart Data - Different data for different filters
  activityChart: {
    'N/A': {
      '2025-06-01': [80, 120, 180, 90, 60, 110, 150, 140, 170, 200, 160, 100],
      '2025-06-02': [95, 135, 195, 105, 75, 125, 165, 155, 185, 215, 175, 115],
      '2025-06-03': [70, 110, 170, 80, 50, 100, 140, 130, 160, 190, 150, 90]
    },
    'Daily': {
      '2025-06-01': [45, 65, 85, 55, 35, 60, 80, 75, 90, 105, 85, 60],
      '2025-06-02': [55, 75, 95, 65, 45, 70, 90, 85, 100, 115, 95, 70],
      '2025-06-03': [40, 60, 80, 50, 30, 55, 75, 70, 85, 100, 80, 55]
    },
    'Weekly': {
      '2025-06-01': [120, 180, 240, 150, 90, 165, 225, 210, 255, 300, 240, 180],
      '2025-06-02': [140, 200, 260, 170, 110, 185, 245, 230, 275, 320, 260, 200],
      '2025-06-03': [100, 160, 220, 130, 70, 145, 205, 190, 235, 280, 220, 160]
    },
    'Monthly': {
      '2025-06-01': [800, 1200, 1800, 900, 600, 1100, 1500, 1400, 1700, 2000, 1600, 1000],
      '2025-06-02': [950, 1350, 1950, 1050, 750, 1250, 1650, 1550, 1850, 2150, 1750, 1150],
      '2025-06-03': [700, 1100, 1700, 800, 500, 1000, 1400, 1300, 1600, 1900, 1500, 900]
    }
  },
  months: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],
  filterLabels: ['N/A', 'Daily', 'Weekly', 'Monthly'],
  
  // Date Selection Data
  dateSelection: {
    currentDate: '2025-06-01',
    availableDates: ['2024-06-01', '2025-06-02', '2025-06-03']
  },
  
  // Activity Filter Data
  activityFilter: {
    currentFilter: 'N/A'
  }
};

// Function to get dashboard data
function getDashboardData() {
  return dashboardData;
}

// Function to update stat card values
function updateStatCard(cardType, newValue) {
  const currentDate = dashboardData.dateSelection.currentDate;
  if (dashboardData.statCards[currentDate] && dashboardData.statCards[currentDate][cardType]) {
    dashboardData.statCards[currentDate][cardType].value = newValue;
  }
}

// Function to update activity chart data
function updateActivityChartData(newData) {
  const currentDate = dashboardData.dateSelection.currentDate;
  const currentFilter = dashboardData.activityFilter.currentFilter;
  if (dashboardData.activityChart[currentFilter] && dashboardData.activityChart[currentFilter][currentDate]) {
    dashboardData.activityChart[currentFilter][currentDate] = newData;
  }
}

// Function to update date selection
function updateDateSelection(newDate) {
  dashboardData.dateSelection.currentDate = newDate;
  updateDashboardDisplay();
}

// Function to update activity filter
function updateActivityFilter(newFilter) {
  dashboardData.activityFilter.currentFilter = newFilter;
  updateDashboardDisplay();
}

// Function to get stat card data by type
function getStatCardData(cardType) {
  const currentDate = dashboardData.dateSelection.currentDate;
  return dashboardData.statCards[currentDate]?.[cardType] || null;
}

// Function to get current activity chart data
function getCurrentActivityChartData() {
  const currentDate = dashboardData.dateSelection.currentDate;
  const currentFilter = dashboardData.activityFilter.currentFilter;
  return dashboardData.activityChart[currentFilter]?.[currentDate] || dashboardData.activityChart['N/A']['2024-06-01'];
}

// Function to initialize dashboard data
function initializeDashboardData() {
  console.log('Dashboard data initialized:', dashboardData);
  return dashboardData;
}

// Function to update dashboard display based on current filters
function updateDashboardDisplay() {
  const currentDate = dashboardData.dateSelection.currentDate;
  const currentFilter = dashboardData.activityFilter.currentFilter;
  
  console.log(`Updating dashboard display for date: ${currentDate}, filter: ${currentFilter}`);
  
  // Update stat card values using fetched data
  // Update Active Users with real data from API
  const activeUsersElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
  if (activeUsersElement) {
    activeUsersElement.textContent = activeUsersData;
  }
  
  // Update Device Reports (keep existing logic for now)
  const statCards = dashboardData.statCards[currentDate];
  if (statCards) {
    const deviceReportsElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (deviceReportsElement) {
      deviceReportsElement.textContent = statCards.deviceReports.value;
    }
  }
  
  // Update Spoilage Alerts with real data from API
  const spoilageAlertsElement = document.querySelector('.stat-card:nth-child(3) .stat-value');
  if (spoilageAlertsElement) {
    spoilageAlertsElement.textContent = spoilageAlertsData;
  }
  
  // Display logged-in user information if available
  if (loggedInUserData) {
    console.log(`Logged-in user: ${loggedInUserData.first_name} ${loggedInUserData.last_name} (${loggedInUserData.role})`);
    console.log(`Active users with same role: ${loggedInUserData['Active Users']}`);
    const thisUserAlertCount = getAlertsForUser(loggedInUserData.user_id);
    console.log(`Spoilage alerts triggered by this user: ${thisUserAlertCount}`);
  }
  
  // Update stat card charts
  initializeStatCardCharts();
  
  // Update activity chart
  initializeActivityChart();
}

// Function to initialize filter event listeners
function initializeFilterEventListeners() {
  // Native date input functionality
  initializeNativeDateInput();
  
  // Activity filter
  const activityFilter = document.querySelector('.activity-filter');
  if (activityFilter) {
    activityFilter.addEventListener('change', (e) => {
      updateActivityFilter(e.target.value);
    });
  }
  
  // Refresh dashboard button
  const refreshBtn = document.getElementById('refreshDashboardBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Add loading state
      refreshBtn.style.opacity = '0.6';
      refreshBtn.style.pointerEvents = 'none';
      
      // Fetch fresh data
      fetchDashboardStats();
      
      // Reset button state after a short delay
      setTimeout(() => {
        refreshBtn.style.opacity = '1';
        refreshBtn.style.pointerEvents = 'auto';
      }, 1000);
    });
  }
}

// Native date input functionality for dashboard date filter
function initializeNativeDateInput() {
  const calendarInput = document.getElementById('calendar-input');
  if (!calendarInput) return;

  // Set min, max, and initial value
  const availableDates = dashboardData.dateSelection.availableDates;
  if (availableDates && availableDates.length) {
    calendarInput.setAttribute('min', availableDates[0]);
    calendarInput.setAttribute('max', availableDates[availableDates.length - 1]);
  }
  if (dashboardData.dateSelection.currentDate) {
    calendarInput.value = dashboardData.dateSelection.currentDate;
  }

  // Listen for changes and update dashboard if date is available
  calendarInput.addEventListener('input', function(e) {
    const selectedDate = e.target.value;
    if (availableDates.includes(selectedDate)) {
      updateDateSelection(selectedDate);
    } else {
      // Optionally, show a message or clear dashboard
      // updateDateSelection('');
    }
  });
}

// Function to render stat card mini charts
function renderStatCardChart(canvasId, chartData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = 40;

  const w = canvas.width;
  const h = canvas.height;
  const padding = 5;
  const chartW = w - padding * 2;
  const chartH = h - padding * 2;

  // Find min/max for this specific chart
  const maxVal = Math.max(...chartData);
  const minVal = Math.min(...chartData);
  const range = maxVal - minVal || 1;

  // Draw mini line chart
  ctx.beginPath();
  chartData.forEach((val, i) => {
    const x = padding + (i * chartW / (chartData.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Function to initialize all stat card charts
function initializeStatCardCharts() {
  // Initialize user chart
  const userData = dashboardData.statCards[dashboardData.dateSelection.currentDate].activeUsers.chartData;
  renderStatCardChart('userChart', userData);
  
  // Initialize device chart
  const deviceData = dashboardData.statCards[dashboardData.dateSelection.currentDate].deviceReports.chartData;
  renderStatCardChart('deviceChart', deviceData);
  
  // Initialize alert chart
  const alertData = dashboardData.statCards[dashboardData.dateSelection.currentDate].spoilageAlerts.chartData;
  renderStatCardChart('alertChart', alertData);
}

function initializeActivityChart() {
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;

  // Use data from dashboardData
  const data = getCurrentActivityChartData();
  const months = dashboardData.months;

  // Chart area
  const padding = 40;
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - padding * 2;
  const chartH = h - padding * 1.5;

  // Find min/max dynamically from data
  let maxVal = Math.max(...data);
  let minVal = Math.min(...data);
  if (minVal > 0) minVal = 0; // Always start Y-axis at 0 for clarity
  const range = maxVal - minVal || 1;

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

  // Draw Y axis labels (dynamic)
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

  // Draw X axis labels and numbers below dots
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  months.forEach((month, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const labelY = h - padding/2 + 8;
    ctx.fillText(month, x, labelY);
    // Draw the data value below the dot
    ctx.font = 'bold 12px Open Sans, Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(data[i], x, labelY + 18);
    ctx.font = '13px Open Sans, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
  });
}

// Function to initialize all dashboard charts
function initializeDashboardStatCharts() {
  initializeStatCardCharts();
  initializeActivityChart();
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize dashboard data
  initializeDashboardData();
  
  // Initialize filter event listeners
  initializeFilterEventListeners();
  
  // Fetch real data from APIs
  fetchDashboardStats();
  fetchAlertsByUser();
  
  // Initial draw if dashboard elements exist
  if(document.getElementById('activityChart')) {
    initializeDashboardStatCharts();
  }
});

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dashboardData,
    getDashboardData,
    updateStatCard,
    updateActivityChartData,
    updateDateSelection,
    updateActivityFilter,
    getStatCardData,
    getCurrentActivityChartData,
    initializeDashboardData,
    initializeDashboardStatCharts,
    updateDashboardDisplay,
    initializeFilterEventListeners,
    initializeNativeDateInput,
    fetchActiveUsers,
    fetchSpoilageAlerts,
    fetchDashboardStats,
    getAlertsForUser,
    getAllAlertsData,
    loggedInUserData
  };
} else {
  window.dashboardData = dashboardData;
  window.getDashboardData = getDashboardData;
  window.updateStatCard = updateStatCard;
  window.updateActivityChartData = updateActivityChartData;
  window.updateDateSelection = updateDateSelection;
  window.updateActivityFilter = updateActivityFilter;
  window.getStatCardData = getStatCardData;
  window.getCurrentActivityChartData = getCurrentActivityChartData;
  window.initializeDashboardData = initializeDashboardData;
  window.initializeDashboardStatCharts = initializeDashboardStatCharts;
  window.updateDashboardDisplay = updateDashboardDisplay;
  window.initializeFilterEventListeners = initializeFilterEventListeners;
  window.initializeNativeDateInput = initializeNativeDateInput;
  window.fetchActiveUsers = fetchActiveUsers;
  window.fetchSpoilageAlerts = fetchSpoilageAlerts;
  window.fetchDashboardStats = fetchDashboardStats;
  window.getAlertsForUser = getAlertsForUser;
  window.getAllAlertsData = getAllAlertsData;
  window.loggedInUserData = loggedInUserData;
}