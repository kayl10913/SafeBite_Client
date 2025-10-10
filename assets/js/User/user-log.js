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
          
          // Use dynamic week calculation that matches the HTML5 week input behavior
          const weekStart = getWeekStartFromWeekNumber(parseInt(year), parseInt(week));
          const weekEnd = getWeekEndFromWeekNumber(parseInt(year), parseInt(week));
          
          console.log('🔍 Calculated week range:', {
            week: week,
            year: year,
            start: weekStart.toISOString().split('T')[0],
            end: weekEnd.toISOString().split('T')[0]
          });
          
          return {
            startDate: weekStart.toISOString().split('T')[0],
            endDate: weekEnd.toISOString().split('T')[0]
          };
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

  // Week calculation helper functions - matching HTML5 week input behavior
  function getWeekStartFromWeekNumber(year, weekNumber) {
    // HTML5 week input uses ISO 8601 week numbering
    // Week 1 is the first week with at least 4 days in the new year
    // Monday is the first day of the week
    
    // Create a date for January 4th of the year (always in week 1)
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to get to Monday (start of week)
    const daysToMonday = jan4Day === 0 ? 6 : jan4Day - 1;
    
    // Calculate the start of week 1 (Monday of the week containing Jan 4)
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
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
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
      // Calculate current ISO week number
      const week = getISOWeekNumber(today);
      weekPicker.value = `${year}-W${week.toString().padStart(2, '0')}`;
      console.log('📅 Set default week picker to:', weekPicker.value);
    }
  }

  // Get ISO week number for a date
  function getISOWeekNumber(date) {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    
    // Thursday in current week decides the year
    target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
    
    // January 4th is always in week 1
    const week1 = new Date(target.getFullYear(), 0, 4);
    
    // Calculate week number
    const weekNumber = 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return weekNumber;
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

  // Fetch user log data from backend with client-side filtering
  function fetchUserLogs(page = 1, filters = {}) {
    console.log('Fetching user logs for user ID:', currentUserId, 'Page:', page, 'Filters:', filters);
    
    // Always fetch a larger window from user logs, then filter + paginate client-side
    const apiParams = new URLSearchParams({ limit: '1000', offset: '0' });
    
    // Prefer central API config if available
    let apiUrl;
    if (typeof window !== 'undefined' && window.buildApiUrl) {
      const base = window.buildApiUrl('/api/users/logs');
      apiUrl = `${base}?${apiParams.toString()}`;
    } else {
      apiUrl = `http://localhost:3000/api/users/logs?${apiParams.toString()}`;
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
        
        // Get all data from response
        const allData = Array.isArray(data.data) ? data.data : [];
        console.log('All user log data:', allData);
        
        // Apply client-side filtering
        const filteredData = applyClientSideFilters(allData, filters);
        console.log('Filtered user log data:', filteredData);
        
        // Update pagination info based on filtered data
        totalRecords = filteredData.length;
        totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));
        currentPage = Math.min(page, totalPages);
        
        // Get page slice
        const startIdx = (currentPage - 1) * recordsPerPage;
        const endIdx = startIdx + recordsPerPage;
        userLogData = filteredData.slice(startIdx, endIdx);
        
        console.log('User log data set:', userLogData);
        
        // Render table and pagination
        renderTable(userLogData);
        renderPagination();
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

  // Apply client-side filtering to user log data using actual table timestamps
  function applyClientSideFilters(data, filters) {
    let filtered = [...data];
    
    // Filter by action type
    if (filters.action_type && filters.action_type !== 'all') {
      const actionType = filters.action_type.toLowerCase();
      filtered = filtered.filter(item => {
        const activity = (item.activity || '').toLowerCase();
        const details = (item.details || '').toLowerCase();
        
        switch (actionType) {
          case 'login':
            return activity === 'login' || activity === 'session' || details.includes('login');
          case 'logout':
            return activity === 'logout' || details.includes('logout');
          case 'update':
            return details.includes('update') || details.includes('edit') || details.includes('changed') || details.includes('updated');
          default:
            return true;
        }
      });
    }
    
    // Filter by date range using actual table timestamps
    const dateRange = getDateRange(filters.date_range || 'daily');
    if (dateRange.startDate && dateRange.endDate) {
      const start = new Date(dateRange.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      
      // Extract date from table timestamp format (e.g., "2025-09-23 07:23:25 +08:00")
      const extractDateFromTimestamp = (timestamp) => {
        if (!timestamp) return null;
        
        // Handle different timestamp formats
        let dateStr = timestamp.toString();
        
        // If it's in format "2025-09-23 07:23:25 +08:00", extract just the date part
        if (dateStr.includes(' ')) {
          dateStr = dateStr.split(' ')[0]; // Get "2025-09-23"
        }
        
        // If it's in format "2025-09-23T07:23:25+08:00", extract just the date part
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0]; // Get "2025-09-23"
        }
        
        return dateStr;
      };
      
      const isDaily = filters.date_range === 'daily';
      const targetDateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
      
      console.log('🔍 Filtering for date range:', filters.date_range);
      console.log('🔍 Target date string:', targetDateStr);
      console.log('🔍 Start date:', start.toISOString().split('T')[0]);
      console.log('🔍 End date:', end.toISOString().split('T')[0]);
      
      if (isDaily) {
        filtered = filtered.filter(item => {
          const ts = item.date_time || item.timestamp;
          if (!ts) return false;
          
          const itemDateStr = extractDateFromTimestamp(ts);
          console.log('🔍 Item timestamp:', ts, '-> Extracted date:', itemDateStr);
          
          return itemDateStr === targetDateStr;
        });
      } else if (filters.date_range === 'weekly') {
        // Build set of 7 date strings from start..end
        const targetDates = new Set();
        const cur = new Date(start);
        while (cur <= end) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const da = String(cur.getDate()).padStart(2, '0');
          targetDates.add(`${y}-${m}-${da}`);
          cur.setDate(cur.getDate() + 1);
        }
        
        filtered = filtered.filter(item => {
          const ts = item.date_time || item.timestamp;
          if (!ts) return false;
          
          const itemDateStr = extractDateFromTimestamp(ts);
          return targetDates.has(itemDateStr);
        });
      } else {
        // For monthly, yearly, and custom ranges - use date string comparison
        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = end.toISOString().split('T')[0];
        
        filtered = filtered.filter(item => {
          const ts = item.date_time || item.timestamp;
          if (!ts) return false;
          
          const itemDateStr = extractDateFromTimestamp(ts);
          return itemDateStr >= startDateStr && itemDateStr <= endDateStr;
        });
      }
    }
    
    console.log('🔍 Filtered data count:', filtered.length);
    return filtered;
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
    const allowed = ['login','logout','update'];
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
    
    // Hide pagination only if no data
    if (totalRecords === 0) {
      paginationContainer.innerHTML = '';
      paginationContainer.style.display = 'none';
      return;
    }
    
    const startRecord = (currentPage - 1) * recordsPerPage + 1;
    const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);
    
    let paginationHTML = `
      <div class="pagination-info">
        Showing ${startRecord} to ${endRecord} of ${totalRecords} records | Page ${currentPage} of ${totalPages}
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
    
    // Add real-time event listener for week picker changes
    if (weekPicker) {
      weekPicker.addEventListener('change', function() {
        console.log('🔍 Week picker changed to:', this.value);
        // Update the calendar highlighting in real-time
        updateCalendarHighlighting();
      });
    }
    
    // Add real-time event listener for month picker changes
    if (monthPicker) {
      monthPicker.addEventListener('change', function() {
        console.log('🔍 Month picker changed to:', this.value);
        // Update the calendar highlighting in real-time
        updateCalendarHighlighting();
      });
    }
    
    // Add real-time event listener for year picker changes
    if (yearPicker) {
      yearPicker.addEventListener('change', function() {
        console.log('🔍 Year picker changed to:', this.value);
        // Update the calendar highlighting in real-time
        updateCalendarHighlighting();
      });
    }
    
    // No auto-apply filters - user must click filter button to fetch data
    console.log('🔍 Filter controls ready. Click "Apply Filters" to load data.');
  }

  // Update calendar highlighting in real-time
  function updateCalendarHighlighting() {
    console.log('🔍 Updating calendar highlighting...');
    
    // Get current date range selection
    const dateRangeSelect = document.getElementById('userLogDateRange');
    const dateRange = dateRangeSelect ? dateRangeSelect.value : 'daily';
    
    // Calculate the date range based on current selection
    const dateRangeData = getDateRange(dateRange);
    
    console.log('🔍 Calendar highlighting for:', {
      dateRange: dateRange,
      startDate: dateRangeData.startDate,
      endDate: dateRangeData.endDate
    });
    
    // The HTML5 week/month/year inputs handle their own highlighting
    // This function is here for future enhancements if needed
    // For now, the browser's native highlighting should work correctly
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
    if (typeof showInfoToast === 'function') showInfoToast('Excel export coming soon');
  };
  
  document.getElementById('userLogDownloadPDF').onclick = function() {
    if (typeof showInfoToast === 'function') showInfoToast('PDF export coming soon');
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
  
  // Set up global refresh function for external components
  window.refreshUserLogs = function() {
    console.log('🔄 External refresh requested for User Logs');
    if (currentFilters && Object.keys(currentFilters).length > 0) {
      // Only refresh if filters are already applied
      fetchUserLogs(currentPage, currentFilters);
    }
  };
  
  // Listen for custom events that might indicate data changes
  document.addEventListener('alertResolved', function(event) {
    console.log('🔔 Alert resolved event received, refreshing User Logs');
    window.refreshUserLogs();
  });
  
  document.addEventListener('dataUpdated', function(event) {
    console.log('🔔 Data updated event received, refreshing User Logs');
    window.refreshUserLogs();
  });
  
  // Listen for storage changes (when data is updated in other tabs/components)
  window.addEventListener('storage', function(event) {
    if (event.key === 'userLogsUpdated' || event.key === 'alertsUpdated') {
      console.log('🔔 Storage change detected, refreshing User Logs');
      window.refreshUserLogs();
    }
  });
  
  // Listen for clicks on "Mark Resolved" buttons in device alerts
  document.addEventListener('click', function(event) {
    // Check if the clicked element is a "Mark Resolved" button
    if (event.target && event.target.textContent && event.target.textContent.includes('Mark Resolved')) {
      console.log('🔔 Mark Resolved button clicked, refreshing User Logs');
      // Add a small delay to allow the alert resolution to complete
      setTimeout(() => {
        window.refreshUserLogs();
      }, 1000);
    }
  });
  
  // No auto-fetch - user must click filter button to load data
  console.log('📋 User Log page initialized. Click "Apply Filters" to load data.');
}; 