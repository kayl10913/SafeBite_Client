// user-log.js

window.initUserLogPage = function() {
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

  // Fetch user log data from backend
  function fetchUserLogs(page = 1, filters = {}) {
    console.log('Fetching user logs for user ID:', currentUserId, 'Page:', page, 'Filters:', filters);
    
    // Build query parameters
    const params = new URLSearchParams({
      page: page,
      limit: recordsPerPage,
      ...filters
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
        updateFilterDisplay();
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
      row.innerHTML = `<td colspan="4" style="text-align:center;color:#b0b0b0;">No user activity found for the selected filters.</td>`;
      tbody.appendChild(row);
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
    const startDateInput = document.getElementById('userLogStartDate');
    const endDateInput = document.getElementById('userLogEndDate');
    
    if (actionTypeSelect) actionTypeSelect.value = (currentFilters.action_type || 'all');
    if (startDateInput) startDateInput.value = currentFilters.start_date || '';
    if (endDateInput) endDateInput.value = currentFilters.end_date || '';
  }

  // Add event listeners for real-time filtering
  function setupFilterEventListeners() {
    const actionTypeSelect = document.getElementById('userLogActivityType');
    const startDateInput = document.getElementById('userLogStartDate');
    const endDateInput = document.getElementById('userLogEndDate');
    
    // Auto-apply filters when selection changes
    if (actionTypeSelect) {
      actionTypeSelect.addEventListener('change', function() {
        applyFilters();
      });
    }
    
    // Auto-apply filters when dates change
    if (startDateInput) {
      startDateInput.addEventListener('change', function() {
        applyFilters();
      });
    }
    
    if (endDateInput) {
      endDateInput.addEventListener('change', function() {
        applyFilters();
      });
    }
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
    const startDate = document.getElementById('userLogStartDate').value;
    const endDate = document.getElementById('userLogEndDate').value;
    
    // Update current filters
    currentFilters = {
      action_type: actionType,
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

  // Initial fetch and render
  fetchUserLogs(1, currentFilters);
}; 