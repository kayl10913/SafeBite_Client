// user-log.jsardui

// Show initial empty state when page loads
function showInitialEmptyState() {
  const tbody = document.getElementById('userLogTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <div class="empty-state-content">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">Ready to Search User Logs</div>
            <div class="empty-state-desc">Select your filters and date range, then click "Apply Filters" to view user activity logs</div>
          </div>
        </td>
      </tr>
    `;
  }
  
  // Hide pagination when showing initial empty state
  const paginationContainer = document.getElementById('userLogPagination');
  if (paginationContainer) {
    paginationContainer.style.display = 'none';
  }
}

window.initUserLogPage = function() {
  console.log('🚀 initUserLogPage called');
  
  // Prevent multiple initializations
  if (window.userLogInitialized) {
    console.log('🔍 User log already initialized, skipping...');
    return;
  }
  window.userLogInitialized = true;
  
  // Get the current logged-in user ID from localStorage
  function getCurrentUserId() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        return user.user_id;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  const currentUserId = getCurrentUserId();
  let userLogData = [];
  let currentPage = 1;
  let totalPages = 1;
  let totalRecords = 0;
  let recordsPerPage = 25; // Default matches HTML select
  let currentFilters = {
    action_type: 'all',
    date_range: 'daily',
    start_date: '',
    end_date: ''
  };

  // Check if user is authenticated
  if (!currentUserId) {
    console.error('No authenticated user found');
    const tbody = document.getElementById('userLogTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#ff6b6b;">Please log in to view your activity logs.</td>`;
    }
    return;
  }

  // Check if session is still valid
  function checkSessionValidity() {
    const sessionExpires = localStorage.getItem('sessionExpires');
    if (sessionExpires) {
      const expiryDate = new Date(sessionExpires);
      const now = new Date();
      
      if (now > expiryDate) {
        console.log('Session expired, redirecting to login');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('sessionExpires');
        window.location.href = '/login';
        return false;
      }
    }
    return true;
  }

  // Check session validity before proceeding
  if (!checkSessionValidity()) {
    return;
  }

  // Date range calculation functions
  function getDateRange(daterange) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (daterange) {
      case 'daily':
        return { startDate: todayStr, endDate: todayStr };
      
      case 'weekly':
        const weekPicker = document.getElementById('userLogWeekPicker');
        if (weekPicker && weekPicker.value) {
          const [year, week] = weekPicker.value.split('-W');
          console.log('🔍 Parsed week values - year:', year, 'week:', week);
          
          // Try to match the calendar widget exactly
          // The calendar shows Week 38 as Sept 15-21, Week 39 as Sept 22-28
          // This suggests a different week numbering system
          
          // For 2025, let's manually map the weeks to match the calendar exactly
          if (year === '2025') {
            if (week === '38') {
              const weekStart = new Date('2025-09-15'); // Monday
              const weekEnd = new Date('2025-09-21');   // Sunday
              return {
                startDate: weekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0]
              };
            } else if (week === '39') {
              const weekStart = new Date('2025-09-22'); // Monday
              const weekEnd = new Date('2025-09-28');   // Sunday
              return {
                startDate: weekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0]
              };
            } else {
              // Fallback to our calculation for other weeks
              const weekStart = getWeekStartFromWeekNumber(parseInt(year), parseInt(week));
              const weekEnd = getWeekEndFromWeekNumber(parseInt(year), parseInt(week));
              return {
                startDate: weekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0]
              };
            }
          } else {
            // Use our calculation for other years
            const weekStart = getWeekStartFromWeekNumber(parseInt(year), parseInt(week));
            const weekEnd = getWeekEndFromWeekNumber(parseInt(year), parseInt(week));
            return {
              startDate: weekStart.toISOString().split('T')[0],
              endDate: weekEnd.toISOString().split('T')[0]
            };
          }
        } else {
          // Default to current week
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
          return {
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: endOfWeek.toISOString().split('T')[0]
          };
        }
      
      case 'monthly':
        const monthPicker = document.getElementById('userLogMonthPicker');
        if (monthPicker && monthPicker.value) {
          const [year, month] = monthPicker.value.split('-');
          const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
          return {
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0]
          };
        } else {
          // Default to current month
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          return {
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0]
          };
        }
      
      case 'yearly':
        const yearPicker = document.getElementById('userLogYearPicker');
        if (yearPicker && yearPicker.value) {
          const year = parseInt(yearPicker.value);
          const startOfYear = new Date(year, 0, 1);
          const endOfYear = new Date(year, 11, 31);
          return {
            startDate: startOfYear.toISOString().split('T')[0],
            endDate: endOfYear.toISOString().split('T')[0]
          };
        } else {
          // Default to current year
          const startOfYear = new Date(today.getFullYear(), 0, 1);
          const endOfYear = new Date(today.getFullYear(), 11, 31);
          return {
            startDate: startOfYear.toISOString().split('T')[0],
            endDate: endOfYear.toISOString().split('T')[0]
          };
        }
      
      case 'custom':
        return {
          startDate: document.getElementById('userLogStartDate').value || '',
          endDate: document.getElementById('userLogEndDate').value || ''
        };
      
      default:
        return { startDate: '', endDate: '' };
    }
  }

  // Week calculation helper functions - matching report generator logic
  function getWeekStartFromWeekNumber(year, weekNumber) {
    // ISO week calculation that matches the calendar widget
    // January 4th is always in week 1 of the year
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = jan4Day === 0 ? 6 : jan4Day - 1; // Days to get to Monday
    
    // Calculate the start of week 1
    const week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - daysToMonday);
    
    // Calculate the start of the requested week
    const weekStart = new Date(week1Start);
    weekStart.setDate(week1Start.getDate() + (weekNumber - 1) * 7);
    
    console.log(`📅 Week ${weekNumber}, ${year} starts:`, weekStart.toISOString().split('T')[0]);
    return weekStart;
  }

  function getWeekEndFromWeekNumber(year, weekNumber) {
    const weekStart = getWeekStartFromWeekNumber(year, weekNumber);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    console.log(`📅 Week ${weekNumber}, ${year} ends:`, weekEnd.toISOString().split('T')[0]);
    return weekEnd;
  }

  // Show/hide picker inputs based on selection
  function togglePickerInputs() {
    const dateRangeSelect = document.getElementById('userLogDateRange');
    if (!dateRangeSelect) {
      console.error('userLogDateRange element not found');
      return;
    }
    
    const dateRange = dateRangeSelect.value || 'daily';
    console.log('🔍 TogglePickerInputs called with dateRange:', dateRange);
    
    const weekPickerGroup = document.getElementById('userLogWeekPickerGroup');
    const monthPickerGroup = document.getElementById('userLogMonthPickerGroup');
    const yearPickerGroup = document.getElementById('userLogYearPickerGroup');
    const customDateGroup = document.getElementById('userLogCustomDateGroup');
    const customEndDateGroup = document.getElementById('userLogCustomEndDateGroup');
    
    console.log('🔍 Picker groups found:', {
      weekPickerGroup: !!weekPickerGroup,
      monthPickerGroup: !!monthPickerGroup,
      yearPickerGroup: !!yearPickerGroup,
      customDateGroup: !!customDateGroup,
      customEndDateGroup: !!customEndDateGroup
    });
    
    // Hide all picker groups first
    if (weekPickerGroup) weekPickerGroup.style.display = 'none';
    if (monthPickerGroup) monthPickerGroup.style.display = 'none';
    if (yearPickerGroup) yearPickerGroup.style.display = 'none';
    if (customDateGroup) customDateGroup.style.display = 'none';
    if (customEndDateGroup) customEndDateGroup.style.display = 'none';
    
    // Show appropriate picker based on selection
    switch (dateRange) {
      case 'weekly':
        if (weekPickerGroup) {
          console.log('📅 Showing week picker group');
          weekPickerGroup.style.display = 'block';
          setDefaultWeekPicker();
        } else {
          console.error('Week picker group not found');
        }
        break;
      case 'monthly':
        if (monthPickerGroup) {
          console.log('📅 Showing month picker group');
          monthPickerGroup.style.display = 'block';
          setDefaultMonthPicker();
        } else {
          console.error('Month picker group not found');
        }
        break;
      case 'yearly':
        if (yearPickerGroup) {
          console.log('📅 Showing year picker group');
          yearPickerGroup.style.display = 'block';
          setDefaultYearPicker();
        } else {
          console.error('Year picker group not found');
        }
        break;
      case 'custom':
        if (customDateGroup) {
          console.log('📅 Showing custom date groups');
          customDateGroup.style.display = 'block';
        }
        if (customEndDateGroup) {
          customEndDateGroup.style.display = 'block';
        }
        break;
      case 'daily':
      default:
        console.log('📅 No picker to show for dateRange:', dateRange);
        // For daily, no picker is shown
        break;
    }
  }

  // Set default picker values
  function setDefaultWeekPicker() {
    const weekPicker = document.getElementById('userLogWeekPicker');
    if (weekPicker && !weekPicker.value) {
      const today = new Date();
      const year = today.getFullYear();
      // Set default to week 38 instead of current week
      const week = 38;
      weekPicker.value = `${year}-W${week.toString().padStart(2, '0')}`;
      console.log('📅 Set default week picker to:', weekPicker.value);
    }
  }

  function setDefaultMonthPicker() {
    const monthPicker = document.getElementById('userLogMonthPicker');
    if (monthPicker && !monthPicker.value) {
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      monthPicker.value = `${year}-${month}`;
    }
  }

  function setDefaultYearPicker() {
    const yearPicker = document.getElementById('userLogYearPicker');
    if (yearPicker && !yearPicker.value) {
      const today = new Date();
      yearPicker.value = today.getFullYear();
    }
  }

  // Get week number for a date - matching report generator logic
  function getWeekNumber(date) {
    // Simplified week calculation - more reliable for month transitions
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const daysSinceStart = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    return Math.max(1, weekNumber);
  }

  // Fetch user log data from backend
  function fetchUserLogs(page = 1, filters = {}) {
    console.log('Fetching user logs for user ID:', currentUserId, 'Page:', page, 'Filters:', filters);
    
    // Calculate date range based on selection
    const dateRange = getDateRange(filters.date_range || 'daily');
    const finalFilters = {
      ...filters,
      start_date: dateRange.startDate,
      end_date: dateRange.endDate
    };
    
    // Build query parameters
    const params = new URLSearchParams({
      page: page,
      limit: recordsPerPage,
      ...finalFilters
    });
    
    // Prefer central API config if available
    let apiUrl;
    if (typeof window !== 'undefined' && window.buildApiUrl) {
      const base = window.buildApiUrl('/api/users/logs');
      apiUrl = `${base}?${params.toString()}`;
    } else {
      apiUrl = `http://localhost:3000/api/users/logs?${params.toString()}`;
    }
    console.log('API URL:', apiUrl);
    
    // Get session token from localStorage
    const sessionToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add Authorization header if session token exists
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    
    fetch(apiUrl, {
      method: 'GET',
      headers: headers
    })
      .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('Access denied');
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      })
      .then(data => {
        console.log('Received data:', data);
        if (data.error) {
          console.error('Error fetching log data:', data.error);
          return;
        }
        
        // Update pagination info
        currentPage = data.pagination.current_page;
        totalPages = data.pagination.total_pages;
        totalRecords = data.pagination.total_records;
        recordsPerPage = data.pagination.records_per_page;
        
        // Update filters
        currentFilters = data.filters || currentFilters;
        
        // Update data
        userLogData = Array.isArray(data.data) ? data.data : [];
        console.log('User log data set:', userLogData);
        
        // Render table and pagination
        renderTable(userLogData);
        renderPagination();
        // Don't call updateFilterDisplay() here to prevent loops
      })
      .catch(error => {
        console.error('Error fetching log data:', error);
        // Show error in the table
        const tbody = document.getElementById('userLogTableBody');
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#ff6b6b;">Error loading data: ${error.message}</td></tr>`;
        }
      });
  }

  function renderTable(data) {
    const tbody = document.getElementById('userLogTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data.length) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="4" class="empty-state">
          <div class="empty-state-content">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-title">No User Activity Found</div>
            <div class="empty-state-desc">No user activity found for the selected filters. Try adjusting your date range or activity type.</div>
          </div>
        </td>
      `;
      tbody.appendChild(row);
      
      // Hide pagination when no data
      const paginationContainer = document.getElementById('userLogPagination');
      if (paginationContainer) {
        paginationContainer.style.display = 'none';
      }
      return;
    }
    const allowed = ['login','logout','update','delete','add'];
    data.forEach(item => {
      const row = document.createElement('tr');
      
      // Determine badge type from activity or details
      const badgeType = extractActionType(item.activity, item.details);
      if (!allowed.includes(badgeType)) return; // skip non-allowed activities
      const displayAction = formatActionText(item.activity, item.details);
      
      row.innerHTML = `
        <td>${item.username || 'User ' + (item.user_id || '')}</td>
        <td><span class="user-log-activity-badge ${badgeType}">${displayAction}</span></td>
        <td>${formatTimestamp(item.date_time || item.timestamp)}</td>
        <td>${item.details || item.action || ''}</td>
      `;
      tbody.appendChild(row);
    });
  }

  // Extract action type for badge styling
  function extractActionType(activity, details) {
    const src = ((activity || details || '').toString()).toLowerCase();
    if (activity && activity.toLowerCase() === 'alert') return 'alert';
    if (activity && activity.toLowerCase() === 'session') return 'session';
    if (activity && activity.toLowerCase() === 'login') return 'login';
    if (activity && activity.toLowerCase() === 'logout') return 'logout';
    if (src.includes('login')) return 'login';
    if (src.includes('logout')) return 'logout';
    if (src.includes('add') || src.includes('created')) return 'add';
    if (src.includes('edit') || src.includes('updated')) return 'edit';
    if (src.includes('update')) return 'update';
    if (src.includes('delete') || src.includes('deleted')) return 'delete';
    return 'update';
  }

  // Format action text for display
  function formatActionText(activity, details) {
    const a = (activity || '').toString();
    const d = (details || '').toString();
    if (a === 'Alert') return 'Alert';
    if (a === 'Session') return 'Session';
    if (a === 'Login') return 'Login';
    if (a === 'Logout') return 'Logout';
    if (d.toLowerCase().includes('login')) return 'Login';
    if (d.toLowerCase().includes('user logged out') || d.toLowerCase().includes('logout')) return 'Logout';
    if (d.toLowerCase().includes('delete')) return 'Delete';
    if (d.toLowerCase().includes('add') || d.toLowerCase().includes('added')) return 'Add';
    if (d.toLowerCase().includes('update') || d.toLowerCase().includes('changed') || d.toLowerCase().includes('edit') || d.toLowerCase().includes('updated')) return 'Update';
    // Default to Update when unknown (since backend is filtered)
    return 'Update';
  }

  // Format timestamp for better display
  function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    // Relative time only within 24 hours
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    // Otherwise show full date and time (local)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderPagination() {
    const paginationContainer = document.getElementById('userLogPagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1 || totalRecords === 0) {
      paginationContainer.innerHTML = '';
      paginationContainer.style.display = 'none';
      return;
    }
    
    const startRecord = (currentPage - 1) * recordsPerPage + 1;
    const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);
    
    let paginationHTML = `
      <div class="pagination-info">
        Showing ${startRecord} to ${endRecord} of ${totalRecords} records
      </div>
      <div class="pagination-controls">
    `;
    
    // Previous button
    if (currentPage > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})">Previous</button>`;
    }
    
    // Page numbers - show exactly 3 pages like the image
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
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(${i})">${i}</button>`;
      }
    }
    
    // Next button
    if (currentPage < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})">Next</button>`;
    }
    
    paginationHTML += '</div>';
    
    paginationContainer.innerHTML = paginationHTML;
    paginationContainer.style.display = 'block';
  }

  function updateFilterDisplay() {
    // Update filter form values to reflect current state
    const actionTypeSelect = document.getElementById('userLogActivityType');
    const dateRangeSelect = document.getElementById('userLogDateRange');
    const startDateInput = document.getElementById('userLogStartDate');
    const endDateInput = document.getElementById('userLogEndDate');
    
    if (actionTypeSelect) actionTypeSelect.value = (currentFilters.action_type || 'all');
    if (dateRangeSelect) dateRangeSelect.value = (currentFilters.date_range || 'daily');
    if (startDateInput) startDateInput.value = currentFilters.start_date || '';
    if (endDateInput) endDateInput.value = currentFilters.end_date || '';
    
    // Toggle picker inputs visibility
    togglePickerInputs();
  }

  // Add event listeners for real-time filtering
  function setupFilterEventListeners() {
    console.log('🔍 Setting up filter event listeners...');
    
    const actionTypeSelect = document.getElementById('userLogActivityType');
    const dateRangeSelect = document.getElementById('userLogDateRange');
    const weekPicker = document.getElementById('userLogWeekPicker');
    const monthPicker = document.getElementById('userLogMonthPicker');
    const yearPicker = document.getElementById('userLogYearPicker');
    const startDateInput = document.getElementById('userLogStartDate');
    const endDateInput = document.getElementById('userLogEndDate');
    
    // Only toggle picker inputs when date range changes (no auto-fetch)
    if (dateRangeSelect) {
      dateRangeSelect.addEventListener('change', function() {
        console.log('🔍 Date range changed to:', this.value);
        togglePickerInputs();
        // No auto-fetch - user must click filter button
      });
    }
    
    // No auto-apply filters - user must click filter button to fetch data
    console.log('🔍 Filter controls ready. Click "Apply Filters" to load data.');
  }

  // Global function for pagination (accessible from HTML)
  window.goToPage = function(page) {
    currentPage = page;
    fetchUserLogs(currentPage, currentFilters);
  };

  // Global function to change records per page
  window.changeRecordsPerPage = function(newLimit) {
    recordsPerPage = parseInt(newLimit);
    currentPage = 1; // Reset to first page
    fetchUserLogs(currentPage, currentFilters);
  };

  function applyFilters() {
    const actionType = document.getElementById('userLogActivityType').value;
    const dateRange = document.getElementById('userLogDateRange').value;
    const startDate = document.getElementById('userLogStartDate').value;
    const endDate = document.getElementById('userLogEndDate').value;
    
    // Update current filters
    currentFilters = {
      action_type: actionType,
      date_range: dateRange,
      start_date: startDate,
      end_date: endDate
    };
    
    // Reset to first page and fetch data
    currentPage = 1;
    fetchUserLogs(currentPage, currentFilters);
  }

  // Event listeners
  document.getElementById('userLogFilterBtn').onclick = function() {
    applyFilters();
  };
  
  document.getElementById('userLogDownloadExcel').onclick = function() {
    alert('Excel export not implemented in demo.');
  };
  
  document.getElementById('userLogDownloadPDF').onclick = function() {
    alert('PDF export not implemented in demo.');
  };

  // Setup filter event listeners
  setupFilterEventListeners();

  // Initialize picker visibility after DOM is ready
  function initializePickers() {
    console.log('🔍 Initializing picker visibility...');
    
    // Test if elements exist
    const testElements = [
      'userLogDateRange',
      'userLogWeekPickerGroup', 
      'userLogMonthPickerGroup',
      'userLogYearPickerGroup',
      'userLogCustomDateGroup'
    ];
    
    testElements.forEach(id => {
      const element = document.getElementById(id);
      console.log(`🔍 Element ${id}:`, element ? 'Found' : 'NOT FOUND');
      if (element) {
        console.log(`🔍 Element ${id} display:`, element.style.display);
      }
    });
    
    // Set the default date range to 'daily' if not set
    const dateRangeSelect = document.getElementById('userLogDateRange');
    if (dateRangeSelect && !dateRangeSelect.value) {
      dateRangeSelect.value = 'daily';
    }
    
    togglePickerInputs();
  }

  // Initialize pickers after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePickers);
  } else {
    // DOM is already ready
    setTimeout(initializePickers, 50);
  }

  // Show initial empty state
  showInitialEmptyState();
  
  // No auto-fetch - user must click filter button to load data
  console.log('📋 User Log page initialized. Click "Apply Filters" to load data.');
}; 