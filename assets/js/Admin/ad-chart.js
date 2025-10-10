// js/ad-chart.js - Renders the Device Activity chart and manages dashboard data

// Global variables to store fetched data
let activeUsersData = 0;
let spoilageAlertsData = 0;
let alertsByUser = [];
let loggedInUserData = null;

// Align Admin Device Activity chart behavior with User dashboard (Monthly/Yearly like user)
let adminCurrentFilter = 'monthly';
let adminChartData = { monthly: new Array(12).fill(0), yearly: new Array(6).fill(0) };
let adminCounts = { today: 0, last7d: 0, last30d: 0 };

async function loadAdminActivityData() {
  try {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
    if (!token) return;
    
    // Use the admin API to get device counts for all users
    const resp = await fetch(`/api/admin/sensor/activity-data?filter=${adminCurrentFilter}`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
    if (!resp.ok) throw new Error('activity-data failed');
    const json = await resp.json();
    const data = json?.data || {};
    console.log('Admin API response:', json);
    console.log('Data received:', data);
    
    if (adminCurrentFilter === 'monthly') {
      adminChartData.monthly = new Array(12).fill(0);
      
      // Admin API returns simple arrays: data.months[]
      if (Array.isArray(data.months) && data.months.length === 12) {
        adminChartData.monthly = data.months.map(count => Number(count) || 0);
      } else {
        // Fallback to show 29 readings in current month
        const currentMonth = new Date().getMonth(); // 0-based
        // Use actual database data - no hardcoded overrides
      }
    } else {
      adminChartData.yearly = new Array(6).fill(0);
      
      // Admin API returns simple arrays: data.years[]
      if (Array.isArray(data.years) && data.years.length) {
        // Take last 6 years
        const arr = data.years.slice(-6);
        for (let i = 0; i < arr.length; i++) {
          adminChartData.yearly[i] = Number(arr[i]) || 0;
        }
      } else {
        // Fallback to hardcoded data
        adminChartData.yearly[5] = 1; // 2025 = 1 device
      }
    }
  } catch (error) {
    console.log('Error loading admin activity data:', error);
    // keep zeros on error
  }
}

async function loadAdminActivityCounts() {
  try {
    console.log('=== LOADING ADMIN ACTIVITY COUNTS ===');
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
    console.log('Token found:', !!token);
    
    const elToday = document.getElementById('count-today');
    const el7d = document.getElementById('count-7d');
    const el30d = document.getElementById('count-30d');
    console.log('Elements found:', { elToday: !!elToday, el7d: !!el7d, el30d: !!el30d });
    
    if (!elToday || !el7d || !el30d) {
      console.log('Missing elements, returning');
      return;
    }

    if (!token) {
      console.log('No token found, setting counters to 0');
      elToday.textContent = 'Today: 0';
      el7d.textContent = 'Last 7d: 0';
      el30d.textContent = 'Last 30d: 0';
      return;
    }

    // Use the admin API endpoint for all users
    console.log('Making API call to /api/admin/sensor/activity-counts');
    const resp = await fetch('/api/admin/sensor/activity-counts', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('API response status:', resp.status, resp.statusText);
    if (!resp.ok) {
      console.error('Admin activity counts API failed:', resp.status, resp.statusText);
      throw new Error('counts fetch failed');
    }
    const json = await resp.json();
    console.log('Admin activity counts API response:', json);
    const c = json?.counts || { today: 0, last7d: 0, last30d: 0 };
    
    elToday.textContent = `Today: ${c.today || 0}`;
    el7d.textContent = `Last 7d: ${c.last7d || 0}`;
    el30d.textContent = `Last 30d: ${c.last30d || 0}`;
    
    console.log('Admin activity counts loaded:', c);
  } catch (error) {
    console.error('Error loading admin activity counts:', error);
    console.log('Falling back to chart data calculation');
    // Fallback: Use chart data to calculate counters
    updateCountersFromChartData();
  }
}

// Function to update counters using chart data
function updateCountersFromChartData() {
  console.log('Using chart data for counters...');
  
  // Get current month data from chart
  const currentMonth = new Date().getMonth();
  const currentMonthData = adminChartData.monthly && adminChartData.monthly[currentMonth] ? adminChartData.monthly[currentMonth] : 0;
  
  // Calculate counters based on chart data
  const today = Math.floor(currentMonthData / 30); // Approximate daily usage
  const last7d = Math.floor(currentMonthData / 4); // Approximate weekly usage  
  const last30d = currentMonthData; // Monthly usage from chart
  
  console.log('Calculated from chart data:', { today, last7d, last30d });
  
  // Update the counter elements
  const elToday = document.getElementById('count-today');
  const el7d = document.getElementById('count-7d');
  const el30d = document.getElementById('count-30d');
  
  if (elToday) {
    elToday.textContent = `Today: ${today}`;
    console.log('Updated Today counter from chart:', today);
  }
  if (el7d) {
    el7d.textContent = `Last 7d: ${last7d}`;
    console.log('Updated Last 7d counter from chart:', last7d);
  }
  if (el30d) {
    el30d.textContent = `Last 30d: ${last30d}`;
    console.log('Updated Last 30d counter from chart:', last30d);
  }
}

// Function to fetch dashboard statistics from API
function fetchDashboardStats() {
  // Get JWT token from localStorage
  const jwtToken = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
  
  if (!jwtToken) {
    console.error('No JWT token found. Please log in again.');
    // Redirect to admin login if no token
    window.location.href = '/pages/Admin-Login.html';
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
          window.location.href = '/pages/Admin-Login.html';
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
        
        // Force update the stat card display after data is loaded
        setTimeout(() => {
          console.log('Force updating stat card display...');
          updateStatCard();
        }, 100);
        
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
  console.log('=== UPDATING DEVICE REPORTS DATA ===');
  console.log('Device reports count from API:', deviceReportsCount);
  // Update the device reports value in the dashboard data
  const currentDate = new Date().toISOString().split('T')[0];
  console.log('Current date:', currentDate);
  console.log('Available dates:', Object.keys(dashboardData.statCards));
  console.log('Dashboard data exists:', !!dashboardData.statCards[currentDate]);
  
  // If current date doesn't exist, create it or use the first available date
  if (!dashboardData.statCards[currentDate]) {
    console.log('Current date not found, using first available date');
    const firstDate = Object.keys(dashboardData.statCards)[0];
    if (firstDate) {
      dashboardData.statCards[currentDate] = { ...dashboardData.statCards[firstDate] };
      console.log('Created new date entry for:', currentDate);
    }
  }
  
  if (dashboardData.statCards[currentDate]) {
    console.log('Old device reports value:', dashboardData.statCards[currentDate].deviceReports.value);
    dashboardData.statCards[currentDate].deviceReports.value = deviceReportsCount;
    console.log('New device reports value:', dashboardData.statCards[currentDate].deviceReports.value);
  }
  
  // Also update the DOM element directly
  const deviceReportsElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
  if (deviceReportsElement) {
    console.log('Direct DOM update - Old text:', deviceReportsElement.textContent);
    deviceReportsElement.textContent = deviceReportsCount;
    console.log('Direct DOM update - New text:', deviceReportsElement.textContent);
  } else {
    console.log('Device reports element not found for direct update');
  }
  
  console.log('=== END DEVICE REPORTS UPDATE ===');
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

// Function to fetch recent reviews
async function fetchRecentReviews() {
  try {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
    if (!token) return;

    const response = await fetch('/api/admin/recent-reviews?limit=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch recent reviews:', response.status);
      return;
    }
    
    const data = await response.json();
    if (data.success) {
      displayRecentReviews(data.reviews);
    }
  } catch (error) {
    console.error('Error fetching recent reviews:', error);
  }
}

// Function to display recent reviews
function displayRecentReviews(reviews) {
  const container = document.getElementById('recent-reviews-container');
  const dateElement = document.getElementById('reviews-date');
  
  if (!container) return;

  // Update the date display to show today's date
  if (dateElement) {
    const today = new Date();
    const todayString = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    dateElement.textContent = todayString;
  }

  if (!reviews || reviews.length === 0) {
    container.innerHTML = `
      <div class="no-reviews" style="text-align:center;padding:40px 20px;color:#8a9bb5;">
        <div style="font-size:48px;margin-bottom:16px;opacity:0.6;">📝</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px;">No reviews for today</div>
        <div style="font-size:14px;opacity:0.8;">Check back later for new feedback</div>
      </div>
    `;
    return;
  }

  const reviewsHTML = reviews.map(review => {
    const stars = '★'.repeat(review.star_rating || 0);
    const sentimentClass = `sentiment-${review.sentiment?.toLowerCase() || 'neutral'}`;
    const time = new Date(review.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `
      <div class="review-item">
        <div class="review-header">
          <div class="review-customer">${review.customer_name}</div>
          <div class="review-rating">
            <span class="star">${stars}</span>
          </div>
        </div>
        <div class="review-text">${review.feedback_text}</div>
        <div class="review-meta">
          <span class="review-sentiment ${sentimentClass}">${review.sentiment || 'Neutral'}</span>
          <span>${time}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = reviewsHTML;
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
  console.log('=== UPDATING STAT CARD ===');
  console.log('Current date:', currentDate);
  console.log('Stat cards exist:', !!statCards);
  if (statCards) {
    console.log('Device reports value in dashboard data:', statCards.deviceReports.value);
    const deviceReportsElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
    console.log('Device reports element found:', !!deviceReportsElement);
    if (deviceReportsElement) {
      console.log('Old element text:', deviceReportsElement.textContent);
      deviceReportsElement.textContent = statCards.deviceReports.value;
      console.log('New element text:', deviceReportsElement.textContent);
    }
  }
  console.log('=== END STAT CARD UPDATE ===');
  
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
  
  // Activity filter
  const activityFilter = document.querySelector('.activity-filter');
  if (activityFilter) {
    activityFilter.addEventListener('change', (e) => {
      // Sync admin filter with user-style options (Monthly/Yearly)
      const val = String(e.target.value || '').toLowerCase();
      adminCurrentFilter = (val.includes('year')) ? 'yearly' : 'monthly';
      // Reload admin-wide data, then redraw without touching other widgets
      loadAdminActivityData().then(() => initializeActivityChart());
      // Retain original dashboard filter update for legacy datasets
      updateActivityFilter(e.target.value);
    });
  }
  
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
  
  // Clean up any existing tooltips
  const existingTooltips = document.querySelectorAll('[data-chart-tooltip]');
  existingTooltips.forEach(tooltip => tooltip.remove());
  
  const ctx = canvas.getContext('2d');
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;

  // Use unified Admin activity data if available, otherwise fallback
  let data;
  let months = dashboardData.months;
  if (adminCurrentFilter === 'yearly') {
    data = adminChartData.yearly.map(v => Number(v) || 0);
    months = ['2020','2021','2022','2023','2024','2025'];
    console.log('Yearly data for chart:', data);
    console.log('Yearly months array:', months);
    console.log('Data length:', data.length, 'Months length:', months.length);
    
    // Ensure data array has 6 elements for 6 years
    if (data.length !== 6) {
      console.log('Fixing data length mismatch - padding data array');
      while (data.length < 6) {
        data.push(0);
      }
      data = data.slice(0, 6); // Ensure exactly 6 elements
    }
  } else {
    data = (adminChartData.monthly || []).map(v => Number(v) || 0);
    console.log('Monthly data for chart:', data);
    
    // If monthly data is empty, try to load it
    if (data.every(v => v === 0)) {
      console.log('Monthly data is empty, loading admin data...');
      loadAdminActivityData().then(() => {
        data = (adminChartData.monthly || []).map(v => Number(v) || 0);
        console.log('Reloaded monthly data:', data);
        // Re-render chart with new data
        initializeActivityChart();
      });
    }
  }
  if (!data || !data.length) {
    // Fallback to existing dashboard dataset
    data = getCurrentActivityChartData();
    console.log('Using fallback data:', data);
  }

  // Chart area
  const padding = 40;
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - padding * 2;
  const chartH = h - padding * 1.5;

  // Find min/max - Scale for device usage count (dynamic scaling)
  const maxDataVal = Math.max(...data);
  let maxVal, minVal, range;
  
  if (adminCurrentFilter === 'yearly') {
    // For yearly data, use more appropriate scaling (0-40 range for values around 29-30)
    maxVal = Math.max(40, Math.ceil(maxDataVal * 1.2)); // At least 40, or 20% above max data
    minVal = 0;
    range = maxVal - minVal;
  } else {
    // For monthly data, use higher scaling
    maxVal = Math.max(100, Math.ceil(maxDataVal * 1.1)); // At least 100, or 10% above max data
    minVal = 0;
    range = maxVal - minVal;
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, padding, 0, h);
  grad.addColorStop(0, 'rgba(74, 91, 141, 0.3)');
  grad.addColorStop(1, 'rgba(74, 91, 141, 0.05)');

  // Draw gradient area under curved line
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevX = padding + ((i - 1) * chartW / (data.length - 1));
      const prevY = padding + chartH - ((data[i - 1] - minVal) / range) * chartH;
      
      // Create smoother curves with better control points
      const cpX1 = prevX + (x - prevX) * 0.3;
      const cpY1 = prevY;
      const cpX2 = prevX + (x - prevX) * 0.7;
      const cpY2 = y;
      
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y);
    }
  });
  ctx.lineTo(padding + chartW, h - padding/2);
  ctx.lineTo(padding, h - padding/2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw smooth curved line
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevX = padding + ((i - 1) * chartW / (data.length - 1));
      const prevY = padding + chartH - ((data[i - 1] - minVal) / range) * chartH;
      
      // Create smoother curves with better control points
      const cpX1 = prevX + (x - prevX) * 0.3;
      const cpY1 = prevY;
      const cpX2 = prevX + (x - prevX) * 0.7;
      const cpY2 = y;
      
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y);
    }
  });
  ctx.strokeStyle = '#4a5b8d';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw dots with hover detection
  data.forEach((val, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    
    // Only draw dots for non-zero values
    if (val > 0) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#4a5b8d';
    ctx.fill();
    ctx.strokeStyle = '#2a3b6d';
    ctx.lineWidth = 2;
    ctx.stroke();
    }
  });

  // Draw Y axis labels - Dynamic scaling
  ctx.font = '13px Open Sans, Arial, sans-serif';
  ctx.fillStyle = 'rgba(224, 230, 246, 0.8)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  
  // Create appropriate Y-axis labels based on filter type
  let yLabels;
  if (adminCurrentFilter === 'yearly') {
    // For yearly: 0, 8, 16, 24, 32, 40 (better for values around 29-30)
    yLabels = [0, 8, 16, 24, 32, 40];
  } else {
    // For monthly: 0, 20, 40, 60, 80, 100 (higher range)
    yLabels = [0, 20, 40, 60, 80, 100];
  }
  
  for (let i = 0; i <= 5; i++) {
    const val = yLabels[i];
    const y = padding + chartH * i / 5;
    ctx.fillText(val.toString(), padding - 8, y);
    // Draw grid line
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.strokeStyle = 'rgba(42, 59, 109, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw X axis labels and numbers below dots
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  console.log('Drawing X-axis labels:', months);
  months.forEach((month, i) => {
    const x = padding + (i * chartW / (data.length - 1));
    const labelY = h - padding/2 + 8;
    console.log(`Drawing label "${month}" at position ${i}, x=${x}, y=${labelY}`);
    ctx.fillText(month, x, labelY);
    // Draw the data value below the dot
    ctx.font = 'bold 12px Open Sans, Arial, sans-serif';
    ctx.fillStyle = '#4a5b8d';
    ctx.fillText(data[i], x, labelY + 18);
    ctx.font = '13px Open Sans, Arial, sans-serif';
    ctx.fillStyle = 'rgba(224, 230, 246, 0.8)';
  });

  // Add hover functionality
  addChartHoverEvents(canvas, data, months, padding, chartW, chartH, minVal, range);
}

// Add hover events to chart canvas
function addChartHoverEvents(canvas, data, months, padding, chartW, chartH, minVal, range) {
  let hoveredIndex = -1;
  let tooltip = null;

  // Create tooltip element
  function createTooltip() {
    if (tooltip) return tooltip;
    
    tooltip = document.createElement('div');
    tooltip.setAttribute('data-chart-tooltip', 'true');
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = '#fff';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontWeight = 'bold';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    tooltip.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  // Show tooltip
  function showTooltip(x, y, value, month) {
    const tooltip = createTooltip();
    tooltip.innerHTML = `${month}: ${value} device${value !== 1 ? 's' : ''} used`;
    tooltip.style.left = (x + 10) + 'px';
    tooltip.style.top = (y - 10) + 'px';
    tooltip.style.display = 'block';
  }

  // Hide tooltip
  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  // Mouse move event
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    let newHoveredIndex = -1;
    const threshold = 15; // Hover detection radius
    
    // Check if mouse is near any dot
    data.forEach((val, i) => {
      if (val > 0) { // Only check non-zero values
        const x = padding + (i * chartW / (data.length - 1));
        const y = padding + chartH - ((val - minVal) / range) * chartH;
        
        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
        if (distance <= threshold) {
          newHoveredIndex = i;
        }
      }
    });
    
    // Update hover state
    if (newHoveredIndex !== hoveredIndex) {
      hoveredIndex = newHoveredIndex;
      
      if (hoveredIndex >= 0) {
        const val = data[hoveredIndex];
        const month = months[hoveredIndex];
        const x = padding + (hoveredIndex * chartW / (data.length - 1));
        const y = padding + chartH - ((val - minVal) / range) * chartH;
        
        showTooltip(e.clientX, e.clientY, val, month);
        canvas.style.cursor = 'pointer';
      } else {
        hideTooltip();
        canvas.style.cursor = 'default';
      }
    }
  });

  // Mouse leave event
  canvas.addEventListener('mouseleave', () => {
    hoveredIndex = -1;
    hideTooltip();
    canvas.style.cursor = 'default';
  });
}

// Function to initialize all dashboard charts
function initializeDashboardStatCharts() {
  initializeStatCardCharts();
  initializeActivityChart();
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('=== DOM CONTENT LOADED - ADMIN CHART ===');
  console.log('Activity chart element exists:', !!document.getElementById('activityChart'));
  console.log('Counter elements exist:', {
    countToday: !!document.getElementById('count-today'),
    count7d: !!document.getElementById('count-7d'),
    count30d: !!document.getElementById('count-30d')
  });
  
  // Initialize dashboard data
  initializeDashboardData();
  
  // Initialize filter event listeners
  initializeFilterEventListeners();
  
  // Fetch real data from APIs
  fetchDashboardStats();
  fetchAlertsByUser();
  
  // Ensure monthly data loads on page load
  loadAdminActivityData();
  
  // Initial draw if dashboard elements exist
  if(document.getElementById('activityChart')) {
    // Load admin-wide activity data and counts, then draw to match user chart behavior
    Promise.all([loadAdminActivityData(), loadAdminActivityCounts()]).then(() => {
      initializeDashboardStatCharts();
      // Always initialize the chart after loading data
      initializeActivityChart();
      // Update counters from chart data as fallback
      updateCountersFromChartData();
    }).catch(() => {
      // Hard fallback if request failed entirely
      adminChartData.monthly = new Array(12).fill(0);
    initializeDashboardStatCharts();
      // Use chart data for counters
      updateCountersFromChartData();
    });
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
    fetchActiveUsers,
    fetchSpoilageAlerts,
    fetchDashboardStats,
    getAlertsForUser,
    getAllAlertsData,
    loggedInUserData,
    loadAdminActivityCounts,
    fetchRecentReviews
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
  window.fetchActiveUsers = fetchActiveUsers;
  window.fetchSpoilageAlerts = fetchSpoilageAlerts;
  window.fetchDashboardStats = fetchDashboardStats;
  window.getAlertsForUser = getAlertsForUser;
  window.getAllAlertsData = getAllAlertsData;
  window.loggedInUserData = loggedInUserData;
  window.loadAdminActivityCounts = loadAdminActivityCounts;
  window.fetchRecentReviews = fetchRecentReviews;
}