// spoilageReport.js - Render spoilage rate by food type (bar chart)

// Load and display logged user information
async function loadUserInfo() {
  try {
    console.log('Loading user info...');
    
    const sessionToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
    
    if (!sessionToken) {
      console.error('No session token found');
      return;
    }

    console.log('Session token found, fetching user profile...');

    const response = await fetch((typeof buildApiUrl === 'function' ? buildApiUrl('/api/users/profile') : '/api/users/profile'), {
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
    console.log('API response:', result);
    
    if (result.success && result.user) {
      // Update user name in sidebar header
      const userNameElement = document.querySelector('.user-name');
      console.log('User name element found:', userNameElement);
      
      if (userNameElement && result.user.first_name) {
        const fullName = `${result.user.first_name} ${result.user.last_name || ''}`.trim();
        userNameElement.textContent = fullName || 'User';
        console.log('Updated user name to:', fullName);
      }
      
      // Update account text in sidebar footer
      const accountTextElement = document.getElementById('accountText');
      console.log('Account text element found:', accountTextElement);
      
      if (accountTextElement) {
        accountTextElement.textContent = 'Profile';
        console.log('Updated account text to: Profile');
      }
      
      console.log('User info loaded successfully:', result.user);
    } else {
      console.error('Failed to load user info:', result.error);
    }
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

// This function is now handled by the SpoilageAnalytics class

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

    const response = await fetch((typeof buildApiUrl === 'function' ? buildApiUrl('/api/spoilage-analytics/stats') : '/api/spoilage-analytics/stats'), {
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

    const response = await fetch((typeof buildApiUrl === 'function' ? buildApiUrl('/api/spoilage-analytics/summary') : '/api/spoilage-analytics/summary'), {
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
      // Use the topSpoiledFoods from the new API structure
      window.spoilageChartData = result.data.topSpoiledFoods || [];
      updateSpoilageChart(result.data.topSpoiledFoods || []);
      console.log('Spoilage chart data loaded:', result.data.topSpoiledFoods || []);
    } else {
      console.error('Failed to load spoilage chart data:', result.error);
    }
  } catch (error) {
    console.error('Error loading spoilage chart data:', error);
  }
}

// This function is now handled by the SpoilageAnalytics class

// Update spoilage chart with real data
function updateSpoilageChart(chartData) {
  // Update the bar chart list
  const barList = document.querySelector('.spoilage-bar-list');
  if (!barList) return;

  barList.innerHTML = '';
  
  // Check if we have data
  if (!chartData || chartData.length === 0) {
    barList.innerHTML = `
      <div class="no-data-state">
        <div class="no-data-icon">📊</div>
        <div class="no-data-title">No Food Data Available</div>
        <div class="no-data-description">Start scanning food items to see spoilage rates by food type</div>
        <div class="no-data-action">Use the Smart Training feature to scan your first food item</div>
      </div>
    `;
    return;
  }
  
  chartData.forEach(item => {
    const barRow = document.createElement('div');
    barRow.className = 'spoilage-bar-row';
    
    const barClass = item.spoilage_rate > 0 ? 'bar-red' : '';
    
    barRow.innerHTML = `
      <span class="bar-label">${item.food_name}</span>
      <div class="bar-bg">
        <div class="bar-fill ${barClass}" style="width:${item.spoilage_rate}%"></div>
      </div>
      <span class="bar-value">${item.spoilage_rate}%</span>
    `;
    
    barList.appendChild(barRow);
  });
}

// This function is now handled by the SpoilageAnalytics class

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
      // Process current date picker values before applying filters
      const dateRangeSelect = document.getElementById('date-range');
      const weekPicker = document.getElementById('week-picker');
      const monthPicker = document.getElementById('month-picker');
      const yearPicker = document.getElementById('year-picker');
      
      if (dateRangeSelect) {
        const rangeType = dateRangeSelect.value;
        
        // If a specific picker is visible, use its value to update the date range
        if (rangeType === 'weekly' && weekPicker && weekPicker.value) {
          const [year, week] = weekPicker.value.split('-W');
          const weekStart = getWeekStartFromWeekNumber(parseInt(year), parseInt(week));
          const weekEnd = getWeekEndFromWeekNumber(parseInt(year), parseInt(week));
          
          const startDateInput = document.getElementById('start-date');
          const endDateInput = document.getElementById('end-date');
          if (startDateInput && endDateInput) {
            startDateInput.value = weekStart.toISOString().split('T')[0];
            endDateInput.value = weekEnd.toISOString().split('T')[0];
          }
        } else if (rangeType === 'monthly' && monthPicker && monthPicker.value) {
          const [year, month] = monthPicker.value.split('-');
          const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
          const monthEnd = new Date(parseInt(year), parseInt(month), 0);
          
          const startDateInput = document.getElementById('start-date');
          const endDateInput = document.getElementById('end-date');
          if (startDateInput && endDateInput) {
            startDateInput.value = monthStart.toISOString().split('T')[0];
            endDateInput.value = monthEnd.toISOString().split('T')[0];
          }
        } else if (rangeType === 'yearly' && yearPicker && yearPicker.value) {
          const yearStart = new Date(parseInt(yearPicker.value), 0, 1);
          const yearEnd = new Date(parseInt(yearPicker.value), 11, 31);
          
          const startDateInput = document.getElementById('start-date');
          const endDateInput = document.getElementById('end-date');
          if (startDateInput && endDateInput) {
            startDateInput.value = yearStart.toISOString().split('T')[0];
            endDateInput.value = yearEnd.toISOString().split('T')[0];
          }
        }
      }
      
      // Apply current controls and load data
      const recordsPerPage = getCurrentRecordsPerPage();
      await loadDetailedReportData(1, recordsPerPage, { preserveOnEmpty: false });
    });
  }

  // Export PDF with proper PDF generation
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', function() {
      exportDetailedReportPDF();
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
  
  // Set default date range based on daily selection
  if (dateRangeSelect) {
    updateDateRange(dateRangeSelect.value);
    
    // Add event listener for date range changes
    dateRangeSelect.addEventListener('change', (e) => {
      updateDateRange(e.target.value);
      // Removed automatic refresh - will only refresh when Apply Filters is clicked
    });
  }
  
  if (startDateInput && endDateInput) {
    // Add event listeners for custom date changes
    startDateInput.addEventListener('change', () => {
      // Removed automatic refresh - will only refresh when Apply Filters is clicked
    });
    endDateInput.addEventListener('change', () => {
      // Removed automatic refresh - will only refresh when Apply Filters is clicked
    });
  }
  
  // Add event listeners for week/month/year pickers
  const weekPicker = document.getElementById('week-picker');
  const monthPicker = document.getElementById('month-picker');
  const yearPicker = document.getElementById('year-picker');
  
  if (weekPicker) {
    weekPicker.addEventListener('change', (e) => {
      const weekValue = e.target.value;
      if (weekValue) {
        const [year, week] = weekValue.split('-W');
        const weekStart = getWeekStartFromWeekNumber(parseInt(year), parseInt(week));
        const weekEnd = getWeekEndFromWeekNumber(parseInt(year), parseInt(week));
        
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput && endDateInput) {
          startDateInput.value = weekStart.toISOString().split('T')[0];
          endDateInput.value = weekEnd.toISOString().split('T')[0];
          // Removed automatic refresh - will only refresh when Apply Filters is clicked
        }
      }
    });
  }
  
  if (monthPicker) {
    monthPicker.addEventListener('change', (e) => {
      const monthValue = e.target.value;
      if (monthValue) {
        const [year, month] = monthValue.split('-');
        const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthEnd = new Date(parseInt(year), parseInt(month), 0);
        
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput && endDateInput) {
          startDateInput.value = monthStart.toISOString().split('T')[0];
          endDateInput.value = monthEnd.toISOString().split('T')[0];
          // Removed automatic refresh - will only refresh when Apply Filters is clicked
        }
      }
    });
  }
  
  if (yearPicker) {
    yearPicker.addEventListener('change', (e) => {
      const yearValue = e.target.value;
      if (yearValue) {
        const yearStart = new Date(parseInt(yearValue), 0, 1);
        const yearEnd = new Date(parseInt(yearValue), 11, 31);
        
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput && endDateInput) {
          startDateInput.value = yearStart.toISOString().split('T')[0];
          endDateInput.value = yearEnd.toISOString().split('T')[0];
          // Removed automatic refresh - will only refresh when Apply Filters is clicked
        }
      }
    });
  }
  
  // Set up filter change listeners
  const foodCategorySelect = document.getElementById('food-category');
  const recordsPerPageSelect = document.getElementById('records-per-page');
  
  if (foodCategorySelect) {
    // Load food categories from database
    loadFoodCategories();
    foodCategorySelect.addEventListener('change', () => {
      console.log('Food category changed to:', foodCategorySelect.value);
      // Removed automatic refresh - will only refresh when Apply Filters is clicked
    });
  }
  
  if (recordsPerPageSelect) {
    recordsPerPageSelect.addEventListener('change', () => {
      // Removed automatic refresh - will only refresh when Apply Filters is clicked
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

    const response = await fetch((typeof buildApiUrl === 'function' ? buildApiUrl('/api/users/food-types') : '/api/users/food-types'), {
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
  const weekPickerGroup = document.getElementById('week-picker-group');
  const monthPickerGroup = document.getElementById('month-picker-group');
  const yearPickerGroup = document.getElementById('year-picker-group');
  const weekPicker = document.getElementById('week-picker');
  const monthPicker = document.getElementById('month-picker');
  const yearPicker = document.getElementById('year-picker');
  
  if (!startDateInput || !endDateInput) return;
  
  // Hide all picker groups first
  customDateRangeGroup.style.display = 'none';
  customDateRangeGroupEnd.style.display = 'none';
  weekPickerGroup.style.display = 'none';
  monthPickerGroup.style.display = 'none';
  yearPickerGroup.style.display = 'none';
  
  const today = new Date();
  let startDate = new Date();
  let endDate = new Date();
  
  switch (rangeType) {
    case 'daily':
      startDate = today;
      endDate = today;
      console.log('🔍 Detailed Report Daily Debug:');
      console.log('  Today:', today);
      console.log('  Start Date:', startDate);
      console.log('  End Date:', endDate);
      break;
    case 'weekly':
      weekPickerGroup.style.display = 'block';
      // Set default to current week
      const currentWeek = getWeekString(today);
      if (weekPicker) weekPicker.value = currentWeek;
      // Calculate start and end of current week
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      startDate = weekStart;
      endDate = weekEnd;
      break;
    case 'monthly':
      monthPickerGroup.style.display = 'block';
      // Set default to current month
      const currentMonth = getMonthString(today);
      if (monthPicker) monthPicker.value = currentMonth;
      // Calculate start and end of current month
      const monthStart = getMonthStart(today);
      const monthEnd = getMonthEnd(today);
      startDate = monthStart;
      endDate = monthEnd;
      break;
    case 'yearly':
      yearPickerGroup.style.display = 'block';
      // Set default to current year
      if (yearPicker) yearPicker.value = today.getFullYear();
      // Calculate start and end of current year
      const yearStart = getYearStart(today);
      const yearEnd = getYearEnd(today);
      startDate = yearStart;
      endDate = yearEnd;
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
  
  console.log('🔍 Detailed Report Date Range Set:');
  console.log('  Range Type:', rangeType);
  console.log('  Formatted Start Date:', startDateInput.value);
  console.log('  Formatted End Date:', endDateInput.value);
}

// Helper functions for date calculations
function getWeekString(date) {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getWeekNumber(date) {
  // ISO week calculation
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay();
  const daysToMonday = jan4Day === 0 ? 6 : jan4Day - 1;
  
  const week1Start = new Date(jan4);
  week1Start.setDate(jan4.getDate() - daysToMonday);
  
  const diffInTime = date.getTime() - week1Start.getTime();
  const diffInDays = Math.floor(diffInTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffInDays / 7) + 1;
  
  return Math.max(1, weekNumber);
}

function getWeekStart(date) {
  // ISO week starts on Monday
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const weekStart = new Date(date);
  weekStart.setDate(diff);
  return weekStart;
}

function getWeekEnd(date) {
  const weekStart = getWeekStart(new Date(date));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}

function getMonthString(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getYearStart(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function getYearEnd(date) {
  return new Date(date.getFullYear(), 11, 31);
}

// Helper functions for week number calculations
function getWeekStartFromWeekNumber(year, week) {
  // ISO week calculation - week starts on Monday
  // January 4th is always in week 1 of the year
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = jan4Day === 0 ? 6 : jan4Day - 1; // Days to get to Monday
  
  // Calculate the start of week 1
  const week1Start = new Date(jan4);
  week1Start.setDate(jan4.getDate() - daysToMonday);
  
  // Calculate the start of the requested week
  const weekStart = new Date(week1Start);
  weekStart.setDate(week1Start.getDate() + (week - 1) * 7);
  
  return weekStart;
}

function getWeekEndFromWeekNumber(year, week) {
  const weekStart = getWeekStartFromWeekNumber(year, week);
  return new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
}

// Load detailed report data from API
// Keep a cache of the last successful payload so refresh never leaves the table empty
let lastDetailedReportData = null;
let lastDetailedReportPagination = null;

// Show loading state for detailed report table
function showDetailedReportLoadingState() {
  const tableBody = document.querySelector('.detailed-report-table tbody');
  if (!tableBody) {
    console.error('Table body not found!');
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="7" style="padding: 0;">
        <div class="no-data-state">
          <div class="no-data-icon">⏳</div>
          <div class="no-data-title">Loading Spoilage Data...</div>
          <div class="no-data-description">Please wait while we fetch your food spoilage analytics</div>
        </div>
      </td>
    </tr>
  `;
}

async function loadDetailedReportData(page = 1, limit = 25, options = { preserveOnEmpty: true, autoRelaxDate: true, _relaxed: false }) {
  try {
    // Show loading state before fetching data
    if (!options?.preserveOnEmpty || !lastDetailedReportData) {
      showDetailedReportLoadingState();
    }

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
      
      // Debug logging for daily date range
      if (startDate === endDate) {
        console.log('🔍 Daily Report Debug:');
        console.log('  Start Date:', startDate);
        console.log('  End Date:', endDate);
        console.log('  Date Range Type: Daily');
      }
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
        <td colspan="8" class="empty-state">
          <div class="empty-state-content">
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-title">No Data Available</div>
            <div class="empty-state-desc">No available data.</div>
          </div>
        </td>
      </tr>
    `;
    console.log('No data found, showing empty state');
    
    // Hide pagination when no data
    const paginationContainer = document.getElementById('detailedReportPagination');
    if (paginationContainer) {
      paginationContainer.style.display = 'none';
    }
    
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
        ${item['FOOD ITEM'] || ''}<br><span class="created-date">Created: ${formatDate(item['CREATED AT'] || item.createdAt || item['EXPIRY DATE'])}</span>
      </td>
      <td><span class="cat-badge">${item['CATEGORY'] || ''}</span></td>
      <td><span class="status-badge ${statusClass}">${item['STATUS'] || ''}</span></td>
      <td><span class="risk-score ${riskClass}">${item['RISK SCORE'] || ''}%</span></td>
      <td>
        ${formatDate(item['EXPIRY DATE'])}<br><span class="${expiryInfo.cssClass}">${expiryInfo.text}</span>
      </td>
      <td>${formatSensorReadings(item['SENSOR READINGS'])}</td>
      <td>${formatRecommendations(item['RECOMMENDATIONS'])}</td>
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
    const totalRecords = pagination?.total_records || pagination?.totalRecords || data.length;
    reportTitle.textContent = `Detailed Spoilage Report (${totalRecords} items)`;
  }
}

// Get CSS class for status
function getStatusClass(status) {
  const normalizedStatus = status?.toLowerCase().trim();
  switch (normalizedStatus) {
    case 'safe': return 'status-fresh';
    case 'fresh': return 'status-fresh'; // Keep backward compatibility
    case 'at risk': return 'status-warning';
    case 'caution': return 'status-warning'; // Handle caution status
    case 'spoiled': return 'status-danger';
    case 'unsafe': return 'status-danger'; // Handle unsafe status
    case 'expired': return 'status-expired';
    default: 
      console.warn('Unknown status for CSS class:', status);
      return 'status-unknown';
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

// Format recommendations for display
function formatRecommendations(recommendations) {
  if (!recommendations) return '<span class="no-recommendations">No recommendations</span>';
  
  try {
    // Parse JSON string if it's a string
    let recData = recommendations;
    if (typeof recommendations === 'string') {
      recData = JSON.parse(recommendations);
    }
    
    // Handle object format with main and details
    if (recData && typeof recData === 'object' && !Array.isArray(recData)) {
      if (recData.main && recData.details && Array.isArray(recData.details)) {
        // Format main recommendation and details with proper styling
        let formatted = `<div class="recommendations-content">
          <div class="recommendations-main">${recData.main}</div>
          <div class="recommendations-details">
            <ul>${recData.details.map(detail => {
              const detailText = typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
              return `<li>${detailText}</li>`;
            }).join('')}</ul>
          </div>
        </div>`;
        return formatted;
      } else if (recData.main) {
        // Only main recommendation
        return `<div class="recommendations-content">
          <div class="recommendations-main">${recData.main}</div>
        </div>`;
      } else if (Array.isArray(recData.details) && recData.details.length > 0) {
        // Only details array
        return `<div class="recommendations-content">
          <div class="recommendations-details">
            <ul>${recData.details.map(detail => {
              const detailText = typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
              return `<li>${detailText}</li>`;
            }).join('')}</ul>
          </div>
        </div>`;
      }
    }
    
    // Handle array format (legacy)
    if (Array.isArray(recData) && recData.length > 0) {
      return `<div class="recommendations-content">
        <div class="recommendations-details">
          <ul>${recData.map(rec => {
            const recText = typeof rec === 'object' ? JSON.stringify(rec) : String(rec);
            return `<li>${recText}</li>`;
          }).join('')}</ul>
        </div>
      </div>`;
    }
    
    return '<span class="no-recommendations">No recommendations</span>';
  } catch (error) {
    console.error('Error parsing recommendations:', error);
    return '<span class="no-recommendations">Invalid recommendations</span>';
  }
}

// Update detailed report pagination
function updateDetailedReportPagination(pagination) {
  const paginationContainer = document.getElementById('detailedReportPagination');
  if (!paginationContainer) return;

  console.log('Pagination data received:', pagination);

  const currentPage = pagination?.current_page || 1;
  const totalPages = pagination?.total_pages || pagination?.totalPages || 1;
  const totalRecords = pagination?.total_records || pagination?.totalRecords || 0;
  const limit = pagination?.records_per_page || pagination?.recordsPerPage || pagination?.limit || 25;
  
  console.log('Pagination values:', { currentPage, totalPages, totalRecords, limit });
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
  
  // Only show pagination if there are records and multiple pages
  if (totalRecords > 0 && totalPages > 1) {
  paginationContainer.style.display = 'block';
  } else {
    paginationContainer.style.display = 'none';
  }
}




// Go to specific page in detailed report
function goToDetailedReportPage(page) {
  // Show loading state when navigating to a different page
  showDetailedReportLoadingState();
  loadDetailedReportData(page, getCurrentRecordsPerPage(), { preserveOnEmpty: false });
}



// Export detailed report to CSV
function exportDetailedReportCSV() {
  try {
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
  if (tableRows.length === 0) {
    showNotification('No data available to export. Please apply filters first.', 'warning');
    return;
  }
  
  tableRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length > 0) {
      const rowData = Array.from(cells).map(cell => {
        // Remove HTML tags and escape quotes
        const text = cell.textContent.replace(/"/g, '""').trim();
        return `"${text}"`;
      });
      csvContent += rowData.join(',') + '\n';
    }
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
  } catch (error) {
    console.error('Error exporting CSV:', error);
    showNotification('Failed to export CSV. Please try again.', 'error');
  }
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
// Create initSpoilageReport function for SPA compatibility
window.initSpoilageReport = function() {
    // Initialize spoilage analytics if not already done
    if (window.spoilageAnalytics) {
        window.spoilageAnalytics.refresh();
    } else {
        // Create new instance if it doesn't exist
        window.spoilageAnalytics = new SpoilageAnalytics();
    }
    
    // Setup navigation buttons
    setupSpoilageNavigation();
    
    // Load user info
    loadUserInfo();
};

window.initDetailedReport = initDetailedReport;
window.setupSpoilageNavigation = setupSpoilageNavigation;
window.loadSpoilageStats = loadSpoilageStats;
window.updateSpoilageStats = updateSpoilageStats;
window.loadSpoilageChartData = loadSpoilageChartData;
// These functions are now handled by the SpoilageAnalytics class
window.updateSpoilageChart = updateSpoilageChart;
window.loadDetailedReportData = loadDetailedReportData;
window.updateDetailedReportTable = updateDetailedReportTable;
window.goToDetailedReportPage = goToDetailedReportPage;
window.exportDetailedReportCSV = exportDetailedReportCSV;
window.showNotification = showNotification;
window.formatSensorReadings = formatSensorReadings;
window.getCurrentRecordsPerPage = getCurrentRecordsPerPage;
window.updateDateRange = updateDateRange;
window.loadFoodCategories = loadFoodCategories;
window.exportSpoilageReportCSV = exportSpoilageReportCSV;
window.exportSpoilageReportPDF = exportSpoilageReportPDF;
window.applySpoilageFilters = applySpoilageFilters;
window.loadUserInfo = loadUserInfo;

// Refresh function to reload categories and data
window.refreshDetailedReport = async function() {
  await loadFoodCategories();
  loadDetailedReportData(1, getCurrentRecordsPerPage());
};


// ============================================================================
// SPOILAGE REPORT EXPORT AND FILTER FUNCTIONS
// ============================================================================

// Export spoilage report to CSV
function exportSpoilageReportCSV() {
  try {
    // Get current chart data
    const chartData = window.spoilageChartData || [];
    
    if (chartData.length === 0) {
      showNotification('No data available to export', 'warning');
      return;
    }

    // Create CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Add headers
    csvContent += 'Food Name,Spoilage Rate,Total Items,Spoiled Items\n';
    
    // Add data rows
    chartData.forEach(item => {
      const row = [
        `"${item.foodName || ''}"`,
        item.spoilageRate || 0,
        item.totalItems || 0,
        item.spoiledItems || 0
      ].join(',');
      csvContent += row + '\n';
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `spoilage-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Spoilage report exported to CSV successfully!', 'success');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    showNotification('Failed to export CSV. Please try again.', 'error');
  }
}

// Export detailed report to PDF
async function exportDetailedReportPDF() {
  try {
    // Ensure jsPDF and autoTable are loaded
    const ensurePdfLibs = async () => {
      const loadScript = (src) => new Promise((resolve, reject) => {
        // Avoid duplicate loads
        if ([...document.getElementsByTagName('script')].some(s => s.src === src)) return resolve();
        const s = document.createElement('script');
        s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load '+src));
        document.head.appendChild(s);
      });

      if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      // After jsPDF, ensure autotable
      const hasAutoTable = !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
      if (!hasAutoTable) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js');
      }
      return (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
    };

    const libsOk = await ensurePdfLibs();
    if (!libsOk) {
      showNotification('PDF export libraries not available. Please check your internet connection and try again.', 'error');
      return;
    }

    // Get current report data
    let reportData = lastDetailedReportData;
    console.log('PDF Export - Report Data:', reportData);
    console.log('PDF Export - Data Type:', typeof reportData);
    console.log('PDF Export - Is Array:', Array.isArray(reportData));
    console.log('PDF Export - Data Length:', reportData?.length);
    
    // Fallback: try to get data from the table if cached data is not available
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
      console.log('PDF Export - No cached data, trying to get from table...');
      reportData = getDataFromTable();
      console.log('PDF Export - Table Data:', reportData);
    }
    
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
      showNotification('No data available to export. Please apply filters first.', 'warning');
      return;
    }

    // Create PDF document with professional settings
    const doc = new window.jspdf.jsPDF({ 
      orientation: 'landscape', 
      unit: 'pt', 
      format: 'A4',
      compress: true
    });
    
    // Calculate available width for table (landscape A4 = 842pt, minus margins)
    const pageWidth = doc.internal.pageSize.width;
    const marginLeft = 40;
    const marginRight = 40;
    const availableWidth = pageWidth - marginLeft - marginRight;
    
    // Add professional header with logo area
    doc.setFillColor(74, 158, 255); // SafeBite blue
    doc.rect(0, 0, doc.internal.pageSize.width, 80, 'F');
    
    // Company name and title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('SafeBite', 40, 35);
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    doc.text('Detailed Spoilage Report', 40, 55);
    
    // Reset text color for content
    doc.setTextColor(0, 0, 0);
    
    // Add report metadata in a professional box
    doc.setFillColor(248, 249, 250);
    doc.rect(40, 100, doc.internal.pageSize.width - 80, 60, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(40, 100, doc.internal.pageSize.width - 80, 60, 'S');
    
    // Report info with better formatting
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    doc.text(`Report Generated: ${currentDate} at ${currentTime}`, 50, 120);
    doc.text(`Total Records: ${reportData.length}`, 50, 135);
    
    // Get filter values for report info
    const dateRange = document.getElementById('date-range')?.value || 'All';
    const foodCategory = document.getElementById('food-category')?.value || 'All';
    doc.text(`Date Range: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`, 50, 150);
    doc.text(`Food Category: ${foodCategory.charAt(0).toUpperCase() + foodCategory.slice(1)}`, 300, 150);
    
    // Prepare table data
    const tableData = reportData.map(item => {
      // Format expiry date properly
      const expiryDate = item['EXPIRY DATE'] || '';
      const formattedExpiry = expiryDate ? new Date(expiryDate).toLocaleDateString() : '';
      
      // Format risk score with percentage
      const riskScore = item['RISK SCORE'] || 0;
      const formattedRiskScore = `${parseFloat(riskScore).toFixed(1)}%`;
      
      // Format recommendations for PDF (shorter format)
      const recommendations = item['RECOMMENDATIONS'] || '';
      let formattedRecommendations = 'None';
      if (recommendations) {
        try {
          const recArray = typeof recommendations === 'string' ? JSON.parse(recommendations) : recommendations;
          if (Array.isArray(recArray) && recArray.length > 0) {
            // Limit to first 2 recommendations for PDF
            const limitedRecs = recArray.slice(0, 2);
            formattedRecommendations = limitedRecs.join('; ');
            if (recArray.length > 2) {
              formattedRecommendations += '...';
            }
          } else if (typeof recArray === 'object' && recArray.main) {
            // Handle object format
            formattedRecommendations = recArray.main;
          }
        } catch (error) {
          formattedRecommendations = 'Invalid';
        }
      }
      
      // Format sensor readings for PDF (shorter format)
      const sensorReadings = item['SENSOR READINGS'] || '';
      let formattedSensorReadings = sensorReadings;
      if (sensorReadings && sensorReadings.length > 50) {
        // Truncate long sensor readings for PDF
        formattedSensorReadings = sensorReadings.substring(0, 47) + '...';
      }
      
      return [
        item['FOOD ITEM'] || '',
        item['CATEGORY'] || '',
        item['STATUS'] || '',
        formattedRiskScore,
        formattedExpiry,
        formattedSensorReadings,
        formattedRecommendations
      ];
    });
    
    // Calculate optimal column widths to fit the page
    const columnWidths = {
      0: Math.floor(availableWidth * 0.20), // Food Item (20%)
      1: Math.floor(availableWidth * 0.14), // Category (14%)
      2: Math.floor(availableWidth * 0.12), // Status (12%)
      3: Math.floor(availableWidth * 0.12), // Risk Score (12%)
      4: Math.floor(availableWidth * 0.14), // Expiry Date (14%)
      5: Math.floor(availableWidth * 0.22), // Sensor Readings (22%)
      6: Math.floor(availableWidth * 0.16)  // Recommendations (16%)
    };
    
    // Add professional table
    if (typeof doc.autoTable !== 'function') {
      // Fallback if plugin attached to prototype
      if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && typeof window.jspdf.jsPDF.API.autoTable === 'function') {
        window.jspdf.jsPDF.API.autoTable.apply(doc, [{
          head: [['Food Item', 'Category', 'Status', 'Risk Score', 'Expiry Date', 'Sensor Readings', 'Recommendations']],
          body: tableData,
          startY: 180,
          margin: { left: marginLeft, right: marginRight },
          tableWidth: 'wrap',
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', halign: 'left', valign: 'top', lineColor: [200,200,200], lineWidth: 0.5, textColor: [0,0,0] },
          headStyles: { fillColor: [74,158,255], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9, halign: 'center', valign: 'middle' },
          alternateRowStyles: { fillColor: [248,249,250] },
          columnStyles: {
            0: { cellWidth: columnWidths[0], halign: 'left' },
            1: { cellWidth: columnWidths[1], halign: 'center' },
            2: { cellWidth: columnWidths[2], halign: 'center' },
            3: { cellWidth: columnWidths[3], halign: 'center' },
            4: { cellWidth: columnWidths[4], halign: 'center' },
            5: { cellWidth: columnWidths[5], halign: 'left' },
            6: { cellWidth: columnWidths[6], halign: 'center' },
            7: { cellWidth: columnWidths[7], halign: 'left' }
          },
          didDrawPage: function (data) {
            doc.setFontSize(8); doc.setTextColor(128,128,128);
            doc.text(`Page ${data.pageNumber} of ${data.pageCount}`, doc.internal.pageSize.width - 100, doc.internal.pageSize.height - 20);
          }
        }]);
      } else {
        throw new Error('autoTable plugin not available');
      }
    } else {
      doc.autoTable({
      head: [['Food Item', 'Category', 'Status', 'Risk Score', 'Expiry Date', 'Sensor Readings', 'Recommendations']],
      body: tableData,
      startY: 180,
      margin: { left: marginLeft, right: marginRight },
      tableWidth: 'wrap',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'top',
        lineColor: [200, 200, 200],
        lineWidth: 0.5,
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [74, 158, 255],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { cellWidth: columnWidths[0], halign: 'left' },   // Food Item
        1: { cellWidth: columnWidths[1], halign: 'center' }, // Category
        2: { cellWidth: columnWidths[2], halign: 'center' }, // Status
        3: { cellWidth: columnWidths[3], halign: 'center' }, // Risk Score
        4: { cellWidth: columnWidths[4], halign: 'center' }, // Expiry Date
        5: { cellWidth: columnWidths[5], halign: 'left' },   // Sensor Readings
        6: { cellWidth: columnWidths[6], halign: 'left' }    // Recommendations
      },
      didDrawPage: function (data) {
        // Add page number
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${data.pageNumber} of ${data.pageCount}`, 
                 doc.internal.pageSize.width - 100, 
                 doc.internal.pageSize.height - 20);
      }
      });
    }
    
    // Save the PDF
    const fileName = `SafeBite_Detailed_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    showNotification('PDF exported successfully!', 'success');
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    showNotification('Failed to export PDF. Please try again.', 'error');
  }
}

// Get data from the current table display as fallback
function getDataFromTable() {
  try {
    const table = document.querySelector('.detailed-report-table tbody');
    if (!table) return [];
    
    const rows = table.querySelectorAll('tr');
    const data = [];
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 7) {
        const rowData = {
          'FOOD ITEM': cells[0]?.textContent?.trim() || '',
          'CATEGORY': cells[1]?.textContent?.trim() || '',
          'STATUS': cells[2]?.textContent?.trim() || '',
          'RISK SCORE': cells[3]?.textContent?.trim() || '',
          'EXPIRY DATE': cells[4]?.textContent?.trim() || '',
          'SENSOR READINGS': cells[5]?.textContent?.trim() || '',
          'ALERT COUNT': cells[6]?.textContent?.trim() || '0'
        };
        data.push(rowData);
      }
    });
    
    return data;
  } catch (error) {
    console.error('Error extracting data from table:', error);
    return [];
  }
}

// Export spoilage report to PDF (legacy function)
function exportSpoilageReportPDF() {
  exportDetailedReportPDF();
}

// Apply spoilage filters
function applySpoilageFilters() {
  try {
    // Get filter values
    const dateFilter = document.getElementById('filter-date')?.value;
    const userFilter = document.getElementById('filter-user')?.value;
    const foodFilter = document.getElementById('filter-food')?.value;
    
    console.log('Applying filters:', { dateFilter, userFilter, foodFilter });
    
    // Reload data with filters
    if (window.spoilageAnalytics) {
      window.spoilageAnalytics.refresh();
    }
    
    // Also reload the chart data
    loadSpoilageChartData();
    
    showNotification('Filters applied successfully', 'success');
  } catch (error) {
    console.error('Error applying filters:', error);
    showNotification('Failed to apply filters. Please try again.', 'error');
  }
}

// ============================================================================
// SPOILAGE ANALYTICS CLASS - Added to integrate with existing spoilage report
// ============================================================================

class SpoilageAnalytics {
    constructor() {
        this.spoilageData = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        // Only load data if we're on the spoilage report page
        if (this.isOnSpoilageReportPage()) {
            await this.loadSpoilageData();
        }
        
        // Listen for SPA navigation events
        document.addEventListener('spa:navigate:after', (event) => {
            const { to } = event.detail;
            if (to === 'spoilage-report' || to === 'detailed-report') {
                setTimeout(() => this.loadSpoilageData(), 100);
            }
        });
        
        // Also listen for direct clicks on sidebar navigation
        document.addEventListener('click', (event) => {
            if (event.target.closest('.sidebar-nav') || event.target.closest('.nav-item')) {
                setTimeout(() => {
                    if (this.isOnSpoilageReportPage()) {
                        this.loadSpoilageData();
                    }
                }, 100);
            }
        });
    }
    
    isOnSpoilageReportPage() {
        const mainContent = document.getElementById('main-content');
        return mainContent && (
            mainContent.querySelector('#spoilage-report-template') ||
            mainContent.querySelector('.spoilage-analytics-container') ||
            mainContent.querySelector('#spoilageChart')
        );
    }

    async loadSpoilageData() {
        if (this.isLoading) return;
        
        console.log('Loading spoilage data...');
        this.isLoading = true;
        
        // Clear existing content immediately to prevent blink effect
        this.clearContent();
        
        try {
            const token = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');

            if (!token) {
                console.error('No authentication token found - user not logged in');
                this.showLoginMessage();
                return;
            }

            // Fetch both summary and stats data with cache busting
            const timestamp = Date.now();
            const [summaryResponse, statsResponse] = await Promise.all([
                fetch((typeof buildApiUrl === 'function' ? buildApiUrl(`/api/spoilage-analytics/summary?t=${timestamp}`) : `/api/spoilage-analytics/summary?t=${timestamp}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch((typeof buildApiUrl === 'function' ? buildApiUrl(`/api/spoilage-analytics/stats?t=${timestamp}`) : `/api/spoilage-analytics/stats?t=${timestamp}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!summaryResponse.ok || !statsResponse.ok) {
                if (summaryResponse.status === 401 || statsResponse.status === 401) {
                    console.error('User not authenticated');
                    this.showLoginMessage();
                    return;
                }
                throw new Error('Failed to fetch spoilage data');
            }

            const summaryData = await summaryResponse.json();
            const statsData = await statsResponse.json();

            if (summaryData.success && statsData.success) {
                console.log('Spoilage data received:', summaryData.data);
                this.spoilageData = {
                    summary: summaryData.data,
                    stats: statsData.data
                };
                
                this.updateSpoilageDashboard();
            } else {
                console.error('API returned unsuccessful response:', summaryData, statsData);
                throw new Error('API returned unsuccessful response');
            }

        } catch (error) {
            console.error('Error loading spoilage data:', error);
            // Show error message instead of hardcoded data
            this.showErrorMessage(error);
        } finally {
            this.isLoading = false;
        }
    }

    clearContent() {
        const barList = document.querySelector('.spoilage-bar-list');
        const summaryList = document.querySelector('.spoilage-summary-list');
        
        if (barList) {
            barList.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon">⏳</div>
                    <div class="no-data-title">Loading Spoilage Data...</div>
                    <div class="no-data-description">Please wait while we fetch your food spoilage analytics</div>
                </div>
            `;
        }
        
        if (summaryList) {
            summaryList.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon">⏳</div>
                    <div class="no-data-title">Loading Summary Data...</div>
                    <div class="no-data-description">Please wait while we fetch your category summary</div>
                </div>
            `;
        }
        
        // Reset stat cards to show loading state
        document.querySelectorAll('.spoilage-stat-card .stat-value').forEach(el => {
            el.textContent = '...';
        });
        
        // Reset total overview
        const totalOverview = document.querySelector('.summary-total-right');
        if (totalOverview) {
            totalOverview.textContent = 'Loading...';
        }
    }

    showErrorMessage(error = null) {
        const barList = document.querySelector('.spoilage-bar-list');
        const summaryList = document.querySelector('.spoilage-summary-list');
        
        // Determine error message based on error type
        let errorTitle = 'Failed to Load Data';
        let errorDescription = 'Unable to fetch spoilage data. Please check your connection and try again.';
        
        if (error) {
            if (error.message && error.message.includes('401')) {
                errorTitle = 'Authentication Required';
                errorDescription = 'Please log in again to access spoilage data.';
            } else if (error.message && error.message.includes('500')) {
                errorTitle = 'Server Error';
                errorDescription = 'There was a server error. Please try again later.';
            } else if (error.message && error.message.includes('Network')) {
                errorTitle = 'Connection Error';
                errorDescription = 'Unable to connect to the server. Please check your internet connection.';
            }
        }
        
        if (barList) {
            barList.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon">⚠️</div>
                    <div class="no-data-title">${errorTitle}</div>
                    <div class="no-data-description">${errorDescription}</div>
                    <div class="no-data-action" onclick="window.spoilageAnalytics && window.spoilageAnalytics.loadSpoilageData()" style="cursor: pointer; color: #4a9eff; text-decoration: underline;">Click refresh to retry</div>
                </div>
            `;
        }
        
        if (summaryList) {
            summaryList.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon">⚠️</div>
                    <div class="no-data-title">${errorTitle}</div>
                    <div class="no-data-description">${errorDescription}</div>
                    <div class="no-data-action" onclick="window.spoilageAnalytics && window.spoilageAnalytics.loadSpoilageData()" style="cursor: pointer; color: #4a9eff; text-decoration: underline;">Click refresh to retry</div>
                </div>
            `;
        }
        
        // Reset stat cards to show error state
        document.querySelectorAll('.spoilage-stat-card .stat-value').forEach(el => {
            el.textContent = '--';
        });
        
        // Reset total overview
        const totalOverview = document.querySelector('.summary-total-right');
        if (totalOverview) {
            totalOverview.textContent = 'Unable to load data';
        }
    }

    updateSpoilageDashboard() {
        if (!this.spoilageData) return;

        // Update spoilage stats cards
        this.updateSpoilageStats();
        
        // Update spoilage rate bars
        this.updateSpoilageRateBars();
        
        // Update top spoiled foods summary
        this.updateTopSpoiledFoodsSummary();
        
        // Update chart
        this.updateChart();
    }

    updateSpoilageStats() {
        const stats = this.spoilageData.stats;
        
        // Update stat cards
        const statCards = document.querySelectorAll('.spoilage-stat-card');
        statCards.forEach(card => {
            const label = card.querySelector('.stat-label').textContent.toLowerCase();
            const valueElement = card.querySelector('.stat-value');
            
            switch (label) {
                case 'total items':
                    valueElement.textContent = stats.total_items || 0;
                    break;
                case 'safe':
                    valueElement.textContent = stats.safe_count || 0;
                    break;
                case 'at risk':
                    valueElement.textContent = stats.caution_count || 0;
                    break;
                case 'spoiled':
                    valueElement.textContent = stats.spoiled_count || stats.unsafe_count || 0;
                    break;
                case 'expired':
                    valueElement.textContent = stats.expired_count || 0;
                    break;
            }
        });
    }

    updateSpoilageRateBars() {
        const topSpoiledFoods = this.spoilageData.summary.topSpoiledFoods;
        const barList = document.querySelector('.spoilage-bar-list');
        
        if (!barList) return;

        // Clear existing bars
        barList.innerHTML = '';

        // Check if we have data - only show no data state if we truly have no data
        if (!topSpoiledFoods || topSpoiledFoods.length === 0) {
            // Check if we have any data at all in the system
            const stats = this.spoilageData.stats;
            if (stats && stats.total_items > 0) {
                // We have data but no spoiled foods - show a positive message
                barList.innerHTML = `
                    <div class="no-data-state">
                        <div class="no-data-icon">✅</div>
                        <div class="no-data-title">No Spoiled Foods Detected</div>
                        <div class="no-data-description">Great news! All your food items are currently safe and fresh</div>
                        <div class="no-data-action">Continue monitoring to maintain food safety</div>
                    </div>
                `;
            } else {
                // No data at all in the system
                barList.innerHTML = `
                    <div class="no-data-state">
                        <div class="no-data-icon">📊</div>
                        <div class="no-data-title">No Food Data Available</div>
                        <div class="no-data-description">Start scanning food items to see spoilage rates by food type</div>
                        <div class="no-data-action">Use the Smart Training feature to scan your first food item</div>
                    </div>
                `;
            }
            return;
        }

        // Create bars for top 5 spoiled foods
        topSpoiledFoods.forEach(food => {
            const barRow = document.createElement('div');
            barRow.className = 'spoilage-bar-row';
            
            const spoilageRate = food.spoilage_rate || 0;
            const barClass = spoilageRate >= 50 ? 'bar-red' : spoilageRate >= 25 ? 'bar-yellow' : 'bar-green';
            
            barRow.innerHTML = `
                <span class="bar-label">${food.food_name}</span>
                <div class="bar-bg">
                    <div class="bar-fill ${barClass}" style="width:${spoilageRate}%"></div>
                </div>
                <span class="bar-value">${spoilageRate}%</span>
            `;
            
            barList.appendChild(barRow);
        });
    }

    updateTopSpoiledFoodsSummary() {
        const categorySummary = this.spoilageData.summary.categorySummary;
        const summaryList = document.querySelector('.spoilage-summary-list');
        
        if (!summaryList) return;

        // Clear existing summary items
        summaryList.innerHTML = '';

        // Check if we have data - only show no data state if we truly have no data
        if (!categorySummary || categorySummary.length === 0) {
            // Check if we have any data at all in the system
            const stats = this.spoilageData.stats;
            if (stats && stats.total_items > 0) {
                // We have data but no category summary - show a positive message
                summaryList.innerHTML = `
                    <div class="no-data-state">
                        <div class="no-data-icon">✅</div>
                        <div class="no-data-title">All Categories Safe</div>
                        <div class="no-data-description">Excellent! No spoilage detected across any food categories</div>
                        <div class="no-data-action">Keep up the good food safety practices</div>
                    </div>
                `;
                
                // Update total overview for positive data
                const totalOverview = document.querySelector('.summary-total-right');
                if (totalOverview) {
                    totalOverview.textContent = `0 spoiled out of ${stats.total_items} items`;
                }
            } else {
                // No data at all in the system
                summaryList.innerHTML = `
                    <div class="no-data-state">
                        <div class="no-data-icon">📈</div>
                        <div class="no-data-title">No Category Data Available</div>
                        <div class="no-data-description">Start scanning food items to see spoilage summary by category</div>
                        <div class="no-data-action">Use the Smart Training feature to scan your first food item</div>
                    </div>
                `;
                
                // Update total overview for no data
                const totalOverview = document.querySelector('.summary-total-right');
                if (totalOverview) {
                    totalOverview.textContent = '0 spoiled out of 0 items';
                }
            }
            return;
        }

        // Create summary items for each category
        categorySummary.forEach(category => {
            const summaryRow = document.createElement('div');
            summaryRow.className = 'summary-row';
            
            const spoilageRate = category.spoilage_rate || 0;
            const rateClass = spoilageRate >= 50 ? 'bar-red' : spoilageRate >= 25 ? 'bar-yellow' : '';
            
            summaryRow.innerHTML = `
                <span class="summary-label">${category.food_category}</span>
                <span class="summary-desc">${category.spoiled_count || 0} of ${category.total_items || 0} items spoiled</span>
                <span class="summary-rate ${rateClass}">${spoilageRate}%</span>
            `;
            
            summaryList.appendChild(summaryRow);
        });

        // Update total overview
        const totals = this.spoilageData.summary.totals;
        const totalOverview = document.querySelector('.summary-total-right');
        if (totalOverview) {
            totalOverview.textContent = `${totals.spoiled_count || totals.unsafe_count || 0} spoiled out of ${totals.total_items || 0} items`;
        }
    }

    updateChart() {
        const canvas = document.getElementById('spoilageChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        // Get chart data
        const topSpoiledFoods = this.spoilageData.summary.topSpoiledFoods;
        
        // Check if we have data
        if (!topSpoiledFoods || topSpoiledFoods.length === 0) {
            drawNoDataChart(ctx, w, h);
            return;
        }
        
        // Draw chart with data
        const foods = topSpoiledFoods.map(item => item.food_name) || [];
        const rates = topSpoiledFoods.map(item => item.spoilage_rate) || [];
        drawSpoilageChart(ctx, foods, rates, w, h);
    }

    // Public method to refresh data
    async refresh() {
        await this.loadSpoilageData();
    }

    // Get current spoilage data
    getSpoilageData() {
        return this.spoilageData;
    }

    // Show login message when user is not authenticated
    showLoginMessage() {
        const barList = document.querySelector('.spoilage-bar-list');
        const summaryList = document.querySelector('.spoilage-summary-list');
        
        if (barList) {
            barList.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon">🔒</div>
                    <div class="no-data-title">Authentication Required</div>
                    <div class="no-data-description">Please log in to view your spoilage analytics and food data.</div>
                    <div class="no-data-action">Redirecting to login page...</div>
                </div>
            `;
        }
        
        if (summaryList) {
            summaryList.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon">🔒</div>
                    <div class="no-data-title">Authentication Required</div>
                    <div class="no-data-description">Please log in to view your spoilage summary and category data.</div>
                    <div class="no-data-action">Redirecting to login page...</div>
                </div>
            `;
        }
        
        // Reset stat cards to 0
        document.querySelectorAll('.spoilage-stat-card .stat-value').forEach(el => {
            el.textContent = '0';
        });
        
        // Reset total overview
        const totalOverview = document.querySelector('.summary-total-right');
        if (totalOverview) {
            totalOverview.textContent = '0 spoiled out of 0 items';
        }
    }
}

// ============================================================================
// CHART DRAWING FUNCTIONS
// ============================================================================

// Draw no-data state on chart
function drawNoDataChart(ctx, w, h) {
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    // Set background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, 0, w, h);
    
    // Draw no-data message
    ctx.font = 'bold 20px Open Sans, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Main message
    ctx.fillText('No Spoilage Data Available', w / 2, h / 2 - 20);
    
    // Subtitle
    ctx.font = '14px Open Sans, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Start scanning food items to see spoilage analytics', w / 2, h / 2 + 10);
    
    // Icon (simple chart representation)
    ctx.font = '48px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('📊', w / 2, h / 2 - 60);
}

// Draw spoilage chart with data
function drawSpoilageChart(ctx, foods, rates, w, h) {
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    const padding = 40;
    const chartW = w - padding * 2;
    const chartH = h - padding * 1.5;
    const maxVal = rates.length > 0 ? Math.max(...rates) + 5 : 100;
    
    // Draw Y axis grid/labels
    ctx.font = '14px Open Sans, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
        const val = (maxVal / 5) * i;
        const y = padding + (chartH / 5) * (5 - i);
        ctx.fillText(Math.round(val) + '%', padding - 10, y + 5);
        
        // Grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartW, y);
        ctx.stroke();
    }
    
    // Draw bars
    const barWidth = chartW / foods.length * 0.6;
    const barSpacing = chartW / foods.length;
    
    foods.forEach((food, index) => {
        const rate = rates[index] || 0;
        const barHeight = (rate / maxVal) * chartH;
        const x = padding + (barSpacing * index) + (barSpacing - barWidth) / 2;
        const y = padding + chartH - barHeight;
        
        // Bar color based on spoilage rate
        let barColor;
        if (rate >= 50) barColor = '#ff4757';
        else if (rate >= 25) barColor = '#ffa502';
        else barColor = '#2ed573';
        
        // Draw bar
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw food name
        ctx.font = '12px Open Sans, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.textAlign = 'center';
        ctx.fillText(food, x + barWidth / 2, padding + chartH + 20);
        
        // Draw percentage
        ctx.font = '11px Open Sans, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(rate + '%', x + barWidth / 2, y - 5);
    });
}

// ============================================================================
// GLOBAL SPOILAGE ANALYTICS INITIALIZATION
// ============================================================================

// Initialize spoilage analytics when DOM is ready
let spoilageAnalytics;
document.addEventListener('DOMContentLoaded', () => {
    // Load user info first
    loadUserInfo();
    
    // Initialize spoilage analytics (this will handle all data loading)
    spoilageAnalytics = new SpoilageAnalytics();
    // Export for global access
    window.spoilageAnalytics = spoilageAnalytics;
    
    // Manual refresh method - call when needed
    window.refreshSpoilageData = () => {
        spoilageAnalytics.refresh();
    };
    
    // Initialize chart if it exists (but don't load data - let SpoilageAnalytics handle it)
    const canvas = document.getElementById('spoilageChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = 320;
        // Just draw the no-data state initially
        drawNoDataChart(ctx, canvas.width, canvas.height);
    }
    
    // Also initialize the bar list and summary list with no-data states
    const barList = document.querySelector('.spoilage-bar-list');
    if (barList) {
        barList.innerHTML = `
            <div class="no-data-state">
                <div class="no-data-icon">📊</div>
                <div class="no-data-title">No Food Data Available</div>
                <div class="no-data-description">Start scanning food items to see spoilage rates by food type</div>
                <div class="no-data-action">Use the Smart Training feature to scan your first food item</div>
            </div>
        `;
    }
    
    const summaryList = document.querySelector('.spoilage-summary-list');
    if (summaryList) {
        summaryList.innerHTML = `
            <div class="no-data-state">
                <div class="no-data-icon">📈</div>
                <div class="no-data-title">No Category Data Available</div>
                <div class="no-data-description">Start scanning food items to see spoilage summary by category</div>
                <div class="no-data-action">Use the Smart Training feature to scan your first food item</div>
            </div>
        `;
  }
}); 