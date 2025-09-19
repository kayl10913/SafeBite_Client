// spoilageReport.js - Render spoilage rate by food type (bar chart)

// Initialize spoilage report functionality
async function initSpoilageReport() {
  // Load spoilage statistics from API
  await loadSpoilageStats();
  
  // Load chart and summary data from API
  await loadSpoilageChartData();
  await loadSpoiledFoodsSummary();
  
  const canvas = document.getElementById('spoilageChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = 320;

  // Use real data from API
  const chartData = window.spoilageChartData || [];
  const foods = chartData.map(item => item.foodName) || ['Adobo', 'Sinigang', 'Milk', 'Chicken'];
  const rates = chartData.map(item => item.spoilageRate) || [32, 24, 18, 12];

  // Chart area
  const padding = 50;
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - padding * 2;
  const chartH = h - padding * 1.5;
  const maxVal = Math.max(...rates) + 5;

  // Draw Y axis grid/labels
  ctx.font = '14px Open Sans, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const val = Math.round(maxVal * (5 - i) / 5);
    const y = padding + chartH * i / 5;
    ctx.fillText(val, padding - 10, y);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw bars
  const barWidth = chartW / foods.length * 0.6;
  foods.forEach((food, i) => {
    const x = padding + (i + 0.2) * (chartW / foods.length);
    const y = padding + chartH - (rates[i] / maxVal) * chartH;
    const barH = (rates[i] / maxVal) * chartH;
    // Bar gradient
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, '#3b7bfa');
    grad.addColorStop(1, '#22336a');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barWidth, barH);
    // Bar border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, barWidth, barH);
    // Value label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Open Sans, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rates[i], x + barWidth/2, y - 14);
  });

  // Draw X axis labels
  ctx.font = '15px Open Sans, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  foods.forEach((food, i) => {
    const x = padding + (i + 0.2) * (chartW / foods.length) + barWidth/2;
    ctx.fillText(food, x, h - padding/2 + 18);
  });

  // Filter and export stubs
  document.getElementById('export-csv').onclick = () => alert('Export CSV not implemented');
  document.getElementById('export-pdf').onclick = () => alert('Export PDF not implemented');
  document.getElementById('filter-date').onchange = () => alert('Filtering not implemented');
  document.getElementById('filter-user').onchange = () => alert('Filtering not implemented');
  document.getElementById('filter-food').onchange = () => alert('Filtering not implemented');
  
  // Set up navigation buttons
  setupSpoilageNavigation();
}

// Load spoilage statistics from API
async function loadSpoilageStats() {
  try {
    // Get session token for authentication
    const sessionToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
    
    if (!sessionToken) {
      console.error('No session token found');
      return;
    }

    const response = await fetch('/api/users/spoilage-stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      updateSpoilageStats(result.data);
      console.log('Spoilage stats loaded:', result.data);
    } else {
      console.error('Failed to load spoilage stats:', result.error);
    }
  } catch (error) {
    console.error('Error loading spoilage stats:', error);
  }
}

// Update spoilage statistics in the UI
function updateSpoilageStats(stats) {
  // Update stat cards
  const statElements = {
    'Total Items': stats.totalItems,
    'Safe': stats.safe,
    'At Risk': stats.atRisk,
    'Spoiled': stats.spoiled,
    'Expired': stats.expired
  };

  // Find and update each stat card
  const statCards = document.querySelectorAll('.spoilage-stat-card');
  statCards.forEach(card => {
    const labelElement = card.querySelector('.stat-label');
    const valueElement = card.querySelector('.stat-value');
    
    if (labelElement && valueElement) {
      const label = labelElement.textContent.trim();
      if (statElements.hasOwnProperty(label)) {
        valueElement.textContent = statElements[label];
      }
    }
  });
}

// Load spoilage chart data from API
async function loadSpoilageChartData() {
  try {
    // Get session token for authentication
    const sessionToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
    
    if (!sessionToken) {
      console.error('No session token found');
      return;
    }

    const response = await fetch('/api/users/spoilage-chart-data', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      window.spoilageChartData = result.data;
      updateSpoilageChart(result.data);
      console.log('Spoilage chart data loaded:', result.data);
    } else {
      console.error('Failed to load spoilage chart data:', result.error);
    }
  } catch (error) {
    console.error('Error loading spoilage chart data:', error);
  }
}

// Load spoiled foods summary from API
async function loadSpoiledFoodsSummary() {
  try {
    // Get session token for authentication
    const sessionToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
    
    if (!sessionToken) {
      console.error('No session token found');
      return;
    }

    const response = await fetch('/api/users/spoiled-foods-summary', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      updateSpoiledFoodsSummary(result.data);
      console.log('Spoiled foods summary loaded:', result.data);
    } else {
      console.error('Failed to load spoiled foods summary:', result.error);
    }
  } catch (error) {
    console.error('Error loading spoiled foods summary:', error);
  }
}

// Update spoilage chart with real data
function updateSpoilageChart(chartData) {
  // Update the bar chart list
  const barList = document.querySelector('.spoilage-bar-list');
  if (!barList) return;

  barList.innerHTML = '';
  
  chartData.forEach(item => {
    const barRow = document.createElement('div');
    barRow.className = 'spoilage-bar-row';
    
    const barClass = item.spoilageRate > 0 ? 'bar-red' : '';
    
    barRow.innerHTML = `
      <span class="bar-label">${item.foodName}</span>
      <div class="bar-bg">
        <div class="bar-fill ${barClass}" style="width:${item.spoilageRate}%"></div>
      </div>
      <span class="bar-value">${item.spoilageRate}%</span>
    `;
    
    barList.appendChild(barRow);
  });
}

// Update spoiled foods summary with real data
function updateSpoiledFoodsSummary(summaryData) {
  // Update the summary list
  const summaryList = document.querySelector('.spoilage-summary-list');
  if (!summaryList) return;

  summaryList.innerHTML = '';
  
  summaryData.forEach(item => {
    const summaryRow = document.createElement('div');
    summaryRow.className = 'summary-row';
    
    const rateClass = item.spoilageRate > 0 ? 'bar-red' : '';
    
    summaryRow.innerHTML = `
      <span class="summary-label">${item.foodName}</span>
      <span class="summary-desc">${item.spoiledItems} of ${item.totalItems} items spoiled</span>
      <span class="summary-rate ${rateClass}">${item.spoilageRate}%</span>
    `;
    
    summaryList.appendChild(summaryRow);
  });

  // Update total overview
  const totalSpoiled = summaryData.reduce((sum, item) => sum + item.spoiledItems, 0);
  const totalItems = summaryData.reduce((sum, item) => sum + item.totalItems, 0);
  
  const summaryTotal = document.querySelector('.summary-total');
  if (summaryTotal) {
    summaryTotal.innerHTML = `Total Overview: <span class="summary-total-right">${totalSpoiled} spoiled out of ${totalItems} items</span>`;
  }
}

// Initialize detailed report functionality
async function initDetailedReport() {
  // Load detailed report data from API
  await loadDetailedReportData();
  
  // Set up event handlers for detailed report buttons (Apply/Reset like Report Generator)
  const applyFiltersBtn = document.getElementById('apply-filters');
  const exportCsvBtn = document.getElementById('export-csv');
  const exportPdfBtn = document.getElementById('export-pdf');

  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', async function() {
      // Just apply current controls and load data
      const recordsPerPage = getCurrentRecordsPerPage();
      await loadDetailedReportData(1, recordsPerPage, { preserveOnEmpty: false });
    });
  }

  // Export PDF similar to report generator (print dialog fallback)
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', function() {
      // For real PDF export, integrate jsPDF; for now, show a note and open print dialog
      showNotification('PDF export uses the browser print dialog. For best results, set layout to Landscape.', 'info');
      setTimeout(() => {
        window.print();
      }, 600);
    });
  }
  
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', function() {
      exportDetailedReportCSV();
    });
  }
  
  // Set up date range functionality
  const dateRangeSelect = document.getElementById('date-range');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const customDateRangeGroup = document.getElementById('custom-date-range-group');
  const customDateRangeGroupEnd = document.getElementById('custom-date-range-group-end');
  
  // Set default date range based on weekly selection
  if (dateRangeSelect) {
    updateDateRange(dateRangeSelect.value);
    
    // Add event listener for date range changes
    dateRangeSelect.addEventListener('change', (e) => {
      updateDateRange(e.target.value);
      loadDetailedReportData(1, getCurrentRecordsPerPage());
    });
  }
  
  if (startDateInput && endDateInput) {
    // Add event listeners for custom date changes
    startDateInput.addEventListener('change', () => loadDetailedReportData(1, getCurrentRecordsPerPage()));
    endDateInput.addEventListener('change', () => loadDetailedReportData(1, getCurrentRecordsPerPage()));
  }
  
  // Set up filter change listeners
  const foodCategorySelect = document.getElementById('food-category');
  const recordsPerPageSelect = document.getElementById('records-per-page');
  
  if (foodCategorySelect) {
    // Load food categories from database
    loadFoodCategories();
    foodCategorySelect.addEventListener('change', () => {
      console.log('Food category changed to:', foodCategorySelect.value);
      loadDetailedReportData(1, getCurrentRecordsPerPage());
    });
  }
  
  if (recordsPerPageSelect) {
    recordsPerPageSelect.addEventListener('change', () => {
      loadDetailedReportData(1, getCurrentRecordsPerPage());
    });
  }
  
  // Set up pagination event listeners
  const paginationContainer = document.getElementById('detailedReportPagination');
  if (paginationContainer) {
    // Pagination will be handled by onclick handlers in the generated HTML
    console.log('Detailed report pagination container found');
  }
  
  // Set up navigation buttons
  setupSpoilageNavigation();
  
  console.log('Detailed report initialized');
}

// Load food categories from database
async function loadFoodCategories() {
  try {
    const sessionToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
    
    if (!sessionToken) {
      console.error('No session token found');
      return;
    }

    const response = await fetch('/api/users/food-types', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.types) {
      const foodCategorySelect = document.getElementById('food-category');
      if (foodCategorySelect) {
        // Store current selection if any
        const currentSelection = foodCategorySelect.value;
        
        // Clear existing options except "All Categories"
        foodCategorySelect.innerHTML = '<option value="all">All Categories</option>';
        
        // Add categories from database
        result.types.forEach(category => {
          const option = document.createElement('option');
          option.value = category;
          option.textContent = category;
          foodCategorySelect.appendChild(option);
        });
        
        // Restore selection if it still exists in the new list
        if (currentSelection && currentSelection !== 'all') {
          const optionExists = Array.from(foodCategorySelect.options).some(option => option.value === currentSelection);
          if (optionExists) {
            foodCategorySelect.value = currentSelection;
          }
        }
        
        console.log('Food categories refreshed:', result.types);
      }
    } else {
      console.error('Failed to load food categories:', result.error);
    }
  } catch (error) {
    console.error('Error loading food categories:', error);
  }
}

// Helper function to get current records per page
function getCurrentRecordsPerPage() {
  const recordsSelect = document.getElementById('records-per-page');
  return recordsSelect ? parseInt(recordsSelect.value) : 25;
}

// Update date range based on selection
function updateDateRange(rangeType) {
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const customDateRangeGroup = document.getElementById('custom-date-range-group');
  const customDateRangeGroupEnd = document.getElementById('custom-date-range-group-end');
  
  if (!startDateInput || !endDateInput) return;
  
  const today = new Date();
  let startDate = new Date();
  let endDate = new Date();
  
  switch (rangeType) {
    case 'daily':
      startDate = today;
      endDate = today;
      customDateRangeGroup.style.display = 'none';
      customDateRangeGroupEnd.style.display = 'none';
      break;
    case 'weekly':
      startDate = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      endDate = today;
      customDateRangeGroup.style.display = 'none';
      customDateRangeGroupEnd.style.display = 'none';
      break;
    case 'monthly':
      startDate = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
      endDate = today;
      customDateRangeGroup.style.display = 'none';
      customDateRangeGroupEnd.style.display = 'none';
      break;
    case 'yearly':
      startDate = new Date(today.getTime() - (365 * 24 * 60 * 60 * 1000));
      endDate = today;
      customDateRangeGroup.style.display = 'none';
      customDateRangeGroupEnd.style.display = 'none';
      break;
    case 'custom':
      customDateRangeGroup.style.display = 'block';
      customDateRangeGroupEnd.style.display = 'block';
      // Set default custom range (last 30 days)
      startDate = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
      endDate = today;
      break;
  }
  
  startDateInput.value = startDate.toISOString().split('T')[0];
  endDateInput.value = endDate.toISOString().split('T')[0];
}

// Load detailed report data from API
// Keep a cache of the last successful payload so refresh never leaves the table empty
let lastDetailedReportData = null;
let lastDetailedReportPagination = null;

async function loadDetailedReportData(page = 1, limit = 25, options = { preserveOnEmpty: true, autoRelaxDate: true, _relaxed: false }) {
  try {
    // Get session token for authentication
    const sessionToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
    
    if (!sessionToken) {
      console.error('No session token found');
      return;
    }

    // Get filter values
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    const foodCategory = document.getElementById('food-category')?.value;

    // Build query parameters
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    const hadDateFilter = Boolean(startDate && endDate);
    if (hadDateFilter) {
      params.append('start_date', startDate);
      params.append('end_date', endDate);
    }

    if (foodCategory && foodCategory !== 'all') {
      params.append('food_category', foodCategory);
    }

    const response = await fetch(`/api/users/detailed-spoilage-report?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('API Response:', result);
    
    if (result.success && Array.isArray(result.data)) {
      if (result.data.length > 0) {
        // Update cache on successful non-empty payload
        lastDetailedReportData = result.data;
        lastDetailedReportPagination = result.pagination;
        console.log('Data received, updating table...');
        updateDetailedReportTable(result.data, result.pagination);
        console.log('Detailed report data loaded:', result.data);
        console.log('Pagination info:', result.pagination);
      } else {
        // Empty data
        // If category is applied and date filter was used, optionally retry without date filter
        if (!options?._relaxed && options?.autoRelaxDate && foodCategory && foodCategory !== 'all' && hadDateFilter) {
          console.warn('Empty result with date filter; retrying without date filter for category filter.');
          const retryParams = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
          retryParams.append('food_category', foodCategory);
          const retryResp = await fetch(`/api/users/detailed-spoilage-report?${retryParams.toString()}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' }
          });
          if (retryResp.ok) {
            const retryResult = await retryResp.json();
            console.log('Retry (no date) API Response:', retryResult);
            if (retryResult.success && Array.isArray(retryResult.data) && retryResult.data.length > 0) {
              lastDetailedReportData = retryResult.data;
              lastDetailedReportPagination = retryResult.pagination;
              updateDetailedReportTable(retryResult.data, retryResult.pagination);
              return; // done
            }
          }
        }
        if (options?.preserveOnEmpty && lastDetailedReportData) {
          console.warn('API returned empty data. Preserving previous table.');
          updateDetailedReportTable(lastDetailedReportData, lastDetailedReportPagination);
        } else {
          updateDetailedReportTable([], result.pagination);
        }
      }
    } else {
      console.error('Failed to load detailed report data:', result.error);
      console.error('Full response:', result);
      if (options?.preserveOnEmpty && lastDetailedReportData) {
        console.warn('Using cached table due to API failure.');
        updateDetailedReportTable(lastDetailedReportData, lastDetailedReportPagination);
      }
    }
  } catch (error) {
    console.error('Error loading detailed report data:', error);
    if (options?.preserveOnEmpty && lastDetailedReportData) {
      console.warn('Using cached table due to load error.');
      updateDetailedReportTable(lastDetailedReportData, lastDetailedReportPagination);
    }
  }
}

// Update detailed report table with real data
function updateDetailedReportTable(data, pagination) {
  const tableBody = document.querySelector('.detailed-report-table tbody');
  if (!tableBody) {
    console.error('Table body not found!');
    return;
  }

  console.log('Updating table with data:', data);
  console.log('Data length:', data.length);

  // Clear existing table data
  tableBody.innerHTML = '';

  // Check if data is empty - show report generator style empty state
  if (!data || data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-content">
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-title">No Data Available</div>
            <div class="empty-state-desc">No available data.</div>
          </div>
        </td>
      </tr>
    `;
    console.log('No data found, showing empty state');
    return;
  }

  // Populate table with data
  data.forEach(item => {
    const row = document.createElement('tr');
    
    const statusClass = getStatusClass(item['STATUS']);
    const riskClass = getRiskClass(item['RISK SCORE']);
    const alertClass = getAlertClass(item['ALERT COUNT']);
    
    // Format expiry date with additional context
    const expiryInfo = formatExpiryDate(item['EXPIRY DATE']);
    
    row.innerHTML = `
      <td>
        ${item['FOOD ITEM'] || ''}<br><span class="created-date">Created: ${formatDate(item['EXPIRY DATE'])}</span>
      </td>
      <td><span class="cat-badge">${item['CATEGORY'] || ''}</span></td>
      <td><span class="status-badge ${statusClass}">${item['STATUS'] || ''}</span></td>
      <td><span class="risk-score ${riskClass}">${item['RISK SCORE'] || ''}%</span></td>
      <td>
        ${formatDate(item['EXPIRY DATE'])}<br><span class="${expiryInfo.cssClass}">${expiryInfo.text}</span>
      </td>
      <td>${formatSensorReadings(item['SENSOR READINGS'])}</td>
      <td><span class="alert-badge ${alertClass}">${item['ALERT COUNT'] === 0 ? 'No alerts' : item['ALERT COUNT'] + ' alerts'}</span></td>
    `;
    
    tableBody.appendChild(row);
  });

  // Update pagination if available
  if (pagination) {
    updateDetailedReportPagination(pagination);
  }

  // Update report title with item count
  const reportTitle = document.querySelector('.detailed-report-title');
  if (reportTitle) {
    reportTitle.textContent = `Detailed Spoilage Report (${pagination?.total_records || data.length} items)`;
  }
}

// Get CSS class for status
function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'safe': return 'status-fresh';
    case 'fresh': return 'status-fresh'; // Keep backward compatibility
    case 'at risk': return 'status-warning';
    case 'spoiled': return 'status-danger';
    case 'expired': return 'status-expired';
    default: return 'status-unknown';
  }
}

// Get CSS class for risk score
function getRiskClass(riskScore) {
  const score = parseInt(riskScore) || 0;
  if (score <= 30) return 'risk-low';
  if (score <= 70) return 'risk-medium';
  return 'risk-high';
}

// Get CSS class for alert count
function getAlertClass(alertCount) {
  const count = parseInt(alertCount) || 0;
  if (count === 0) return 'none';
  return '';
}

// Format sensor readings to display sensor data
function formatSensorReadings(sensorData) {
  if (!sensorData || sensorData === 'No sensor data') {
    return 'No sensor data';
  }
  
  // Format the sensor reading (e.g., "Temperature: 25.5 °C")
  const formattedReading = sensorData.replace(/^(\w+):/, (match, sensorType) => {
    return sensorType.charAt(0).toUpperCase() + sensorType.slice(1).toLowerCase() + ':';
  });
  
  return formattedReading;
}

// Format expiry date with context
function formatExpiryDate(expiryDate) {
  if (!expiryDate) return { text: 'No expiry date', cssClass: 'expiry-days' };
  
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: `Expired ${Math.abs(diffDays)} days ago`, cssClass: 'expiry-expired' };
  } else if (diffDays === 0) {
    return { text: 'Expires today', cssClass: 'expiry-today' };
  } else if (diffDays === 1) {
    return { text: 'Expires tomorrow', cssClass: 'expiry-today' };
  } else if (diffDays <= 3) {
    return { text: `${diffDays} days left`, cssClass: 'expiry-today' };
  } else {
    return { text: `${diffDays} days left`, cssClass: 'expiry-days' };
  }
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// Update detailed report pagination
function updateDetailedReportPagination(pagination) {
  const paginationContainer = document.getElementById('detailedReportPagination');
  if (!paginationContainer) return;

  const currentPage = pagination.current_page || 1;
  const totalPages = pagination.total_pages || 1;
  const totalRecords = pagination.total_records || 0;
  const limit = pagination.limit || 25;
  const startRecord = (currentPage - 1) * limit + 1;
  const endRecord = Math.min(currentPage * limit, totalRecords);

  let paginationHTML = `
    <div class="pagination-info">
      Showing ${startRecord} to ${endRecord} of ${totalRecords} records
    </div>
    <div class="pagination-controls">
  `;

  // Previous button
  if (currentPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="goToDetailedReportPage(${currentPage - 1})">Previous</button>`;
  }

  // Page numbers - show exactly 3 pages like in the image
  const maxVisiblePages = 3;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  // Adjust start page if we don't have enough pages at the end
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    if (i === currentPage) {
      paginationHTML += `<span class="pagination-current">${i}</span>`;
    } else {
      paginationHTML += `<button class="pagination-btn" onclick="goToDetailedReportPage(${i})">${i}</button>`;
    }
  }

  // Next button
  if (currentPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="goToDetailedReportPage(${currentPage + 1})">Next</button>`;
  }

  paginationHTML += '</div>';
  paginationContainer.innerHTML = paginationHTML;
  paginationContainer.style.display = 'block';
}




// Go to specific page in detailed report
function goToDetailedReportPage(page) {
  loadDetailedReportData(page, getCurrentRecordsPerPage());
}



// Export detailed report to CSV
function exportDetailedReportCSV() {
  // Get current filter values
  const startDate = document.getElementById('start-date')?.value;
  const endDate = document.getElementById('end-date')?.value;
  const foodCategory = document.getElementById('food-category')?.value;

  // Create CSV content
  let csvContent = 'data:text/csv;charset=utf-8,';
  
  // Add headers
  const headers = [
    'Food Item', 'Category', 'Status', 'Risk Score', 'Expiry Date', 'Sensor Readings', 'Alert Count'
  ];
  csvContent += headers.join(',') + '\n';

  // Get table data
  const tableRows = document.querySelectorAll('.detailed-report-table tbody tr');
  tableRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const rowData = Array.from(cells).map(cell => {
      // Remove HTML tags and escape quotes
      const text = cell.textContent.replace(/"/g, '""');
      return `"${text}"`;
    });
    csvContent += rowData.join(',') + '\n';
  });

  // Create download link
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  
  // Create filename with filters
  let filename = 'detailed-spoilage-report';
  if (startDate && endDate) filename += `-${startDate}-to-${endDate}`;
  if (foodCategory && foodCategory !== 'all') filename += `-${foodCategory}`;
  filename += `-${new Date().toISOString().split('T')[0]}.csv`;
  
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Show success notification
  showNotification('Detailed report exported to CSV successfully!', 'success');
}

// Show notification function
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;

  const colors = {
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8'
  };
  notification.style.backgroundColor = colors[type] || colors.info;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Set up navigation buttons for spoilage reports
function setupSpoilageNavigation() {
  const navigationButtons = document.querySelectorAll('.spoilage-btn');
  navigationButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation(); // prevent global SPA handler from catching this
      const targetPage = this.getAttribute('data-page');
      if (targetPage) {
        // Translate internal "dashboard" to SPA page "spoilage-report"
        const spaTarget = (targetPage === 'dashboard') ? 'spoilage-report' : targetPage;

        // Update active state
        navigationButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Navigate to the target page
        if (window.switchPage) {
          window.switchPage(spaTarget);
        }
      }
    });
  });
}

// Make functions globally available
window.initSpoilageReport = initSpoilageReport;
window.initDetailedReport = initDetailedReport;
window.setupSpoilageNavigation = setupSpoilageNavigation;
window.loadSpoilageStats = loadSpoilageStats;
window.updateSpoilageStats = updateSpoilageStats;
window.loadSpoilageChartData = loadSpoilageChartData;
window.loadSpoiledFoodsSummary = loadSpoiledFoodsSummary;
window.updateSpoilageChart = updateSpoilageChart;
window.updateSpoiledFoodsSummary = updateSpoiledFoodsSummary;
window.loadDetailedReportData = loadDetailedReportData;
window.updateDetailedReportTable = updateDetailedReportTable;
window.goToDetailedReportPage = goToDetailedReportPage;
window.exportDetailedReportCSV = exportDetailedReportCSV;
window.showNotification = showNotification;
window.formatSensorReadings = formatSensorReadings;
window.getCurrentRecordsPerPage = getCurrentRecordsPerPage;
window.updateDateRange = updateDateRange;
window.loadFoodCategories = loadFoodCategories;

// Refresh function to reload categories and data
window.refreshDetailedReport = async function() {
  await loadFoodCategories();
  loadDetailedReportData(1, getCurrentRecordsPerPage());
};


document.addEventListener('DOMContentLoaded', () => {
  // Initialize if DOM is already loaded
  if (document.getElementById('spoilageChart')) {
    initSpoilageReport();
  }
}); 