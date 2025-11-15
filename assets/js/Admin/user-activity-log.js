// js/user-activity-log.js

// Global variables for user activity log data
let userActivityLogData = [];
let currentActivityLogPage = 1;
let activityLogRecordsPerPage = 10; // Changed from 25 to 10 to match other sections
let totalActivityLogRecords = 0;
let currentActivityFilters = {
  actionType: 'all',
  dateRange: 'all',
  startDate: '',
  endDate: ''
};

// Function to format timestamp to relative time
function formatRelativeTime(timestamp) {
  const now = new Date();
  const logTime = new Date(timestamp);
  const diffInMs = now - logTime;
  
  // Convert to minutes and hours
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 1) {
    return 'just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hr ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else {
    // For older dates, show the actual date and time in "10:51:25 AM" format
    const dateStr = logTime.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: logTime.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    const timeStr = logTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return `${dateStr} ${timeStr}`;
  }
}

// Function to fetch user activity logs from API
async function fetchUserActivityLogs(page = 1, limit = 25) {
  try {
    // Get current filters
    const actionType = document.getElementById('activityTypeFilter')?.value || 'all';
    const dateRange = document.getElementById('activityDateRange')?.value || 'all';
    const startDate = document.getElementById('activityDateStart')?.value || '';
    const endDate = document.getElementById('activityDateEnd')?.value || '';
    
    // Calculate date range based on selection
    let calculatedStartDate = '';
    let calculatedEndDate = '';
    
    if (dateRange === 'custom') {
      calculatedStartDate = startDate;
      calculatedEndDate = endDate;
    } else if (dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateRange) {
        case 'daily':
          calculatedStartDate = today.toISOString().split('T')[0];
          calculatedEndDate = today.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekPicker = document.getElementById('activityWeekPicker');
          if (weekPicker && weekPicker.value) {
            const [year, week] = weekPicker.value.split('-W');
            const startDate = getWeekStartDate(parseInt(year), parseInt(week));
            const endDate = getWeekEndDate(parseInt(year), parseInt(week));
            calculatedStartDate = startDate.toISOString().split('T')[0];
            calculatedEndDate = endDate.toISOString().split('T')[0];
          } else {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            calculatedStartDate = weekStart.toISOString().split('T')[0];
            calculatedEndDate = today.toISOString().split('T')[0];
          }
          break;
        case 'monthly':
          const monthPicker = document.getElementById('activityMonthPicker');
          if (monthPicker && monthPicker.value) {
            const [year, month] = monthPicker.value.split('-');
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0);
            calculatedStartDate = startDate.toISOString().split('T')[0];
            calculatedEndDate = endDate.toISOString().split('T')[0];
          } else {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            calculatedStartDate = monthStart.toISOString().split('T')[0];
            calculatedEndDate = today.toISOString().split('T')[0];
          }
          break;
        case 'yearly':
          const yearPicker = document.getElementById('activityYearPicker');
          if (yearPicker && yearPicker.value) {
            const year = parseInt(yearPicker.value);
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31);
            calculatedStartDate = startDate.toISOString().split('T')[0];
            calculatedEndDate = endDate.toISOString().split('T')[0];
          } else {
            const yearStart = new Date(today.getFullYear(), 0, 1);
            calculatedStartDate = yearStart.toISOString().split('T')[0];
            calculatedEndDate = today.toISOString().split('T')[0];
          }
          break;
      }
    }
    
    // Build query parameters
    const params = new URLSearchParams({
      page: page,
      limit: limit,
      action_type: actionType,
      start_date: calculatedStartDate,
      end_date: calculatedEndDate
    });
    
    // Debug logging
    console.log('Activity Type Filter:', actionType);
    console.log('Date Range:', dateRange);
    console.log('Calculated Start Date:', calculatedStartDate);
    console.log('Calculated End Date:', calculatedEndDate);
    console.log('API URL:', `/api/admin/user-logs?${params}`);
    
    // Get JWT token from localStorage (fallbacks for compatibility)
    const jwtToken = localStorage.getItem('jwt_token') || 
                     localStorage.getItem('sessionToken') || 
                     localStorage.getItem('session_token');
    
    const response = await fetch(`/api/admin/user-logs?${params}`, {
      method: 'GET',
      headers: {
        ...(jwtToken ? { 'Authorization': `Bearer ${jwtToken}` } : {}),
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication required or access denied. Redirecting to admin login...');
        setTimeout(() => { window.location.href = '/pages/Admin-Login.html'; }, 300);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      userActivityLogData = result.logs;
      totalActivityLogRecords = result.pagination.total;
      currentActivityLogPage = result.pagination.page;
      activityLogRecordsPerPage = result.pagination.limit;
      
      renderUserActivityLogTable();
      renderUserActivityLogPagination(totalActivityLogRecords);
    } else {
      console.error('API Error:', result.error);
      userActivityLogData = [];
      totalActivityLogRecords = 0;
      renderUserActivityLogTable();
    }
  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    userActivityLogData = [];
    totalActivityLogRecords = 0;
    renderUserActivityLogTable();
  }
}

function renderUserActivityLogTable() {
  const tbody = document.getElementById('activityLogTableBody');
  if (!tbody) {
    return;
  }
  
  if (userActivityLogData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No User Activity Found</div>
        <div class="empty-state-desc">Try adjusting your filters or check back later for new activity.</div>
      </div>
    </td></tr>`;
    return;
  }
  
  // Data is already paginated from the API
  tbody.innerHTML = userActivityLogData.map(row => {
    // Determine activity type from action text
    let activityType = 'update';
    const action = row.Activity.toLowerCase();
    if (action.includes('login') || action.includes('logged in')) activityType = 'login';
    else if (action.includes('logout') || action.includes('logged out')) activityType = 'logout';
    else if (action.includes('add') || action.includes('created')) activityType = 'add';
    else if (action.includes('edit') || action.includes('updated')) activityType = 'edit';
    else if (action.includes('delete') || action.includes('deleted')) activityType = 'delete';
    
    // Format timestamp to relative time
    const relativeTime = formatRelativeTime(row['Date/Time']);
    
    return `
      <tr>
        <td><strong>${row.User}</strong></td>
        <td><span class="activity-badge activity-${activityType}">${activityType.charAt(0).toUpperCase() + activityType.slice(1)}</span></td>
        <td>${relativeTime}</td>
        <td>${row.Activity}</td>
      </tr>
    `;
  }).join('');
}

function renderUserActivityLogPagination(totalRecords) {
  const paginationDiv = document.getElementById('activityLogPagination');
  if (!paginationDiv) return;
  // Show/hide like other sections
  if (!totalRecords || totalRecords <= 0) {
    paginationDiv.style.display = 'none';
    paginationDiv.innerHTML = '';
    return;
  }

  paginationDiv.style.display = '';
  const totalPages = Math.ceil(totalRecords / activityLogRecordsPerPage);
  
  let paginationHTML = '<div class="pagination-info">';
  paginationHTML += `Showing ${((currentActivityLogPage - 1) * activityLogRecordsPerPage) + 1} to ${Math.min(currentActivityLogPage * activityLogRecordsPerPage, totalRecords)} of ${totalRecords} records`;
  paginationHTML += '</div>';
  
  paginationHTML += '<div class="pagination-controls">';
  
  // Previous button
  if (currentActivityLogPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="changeActivityLogPage(${currentActivityLogPage - 1})">‹ Previous</button>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentActivityLogPage) {
      paginationHTML += `<button class="pagination-btn active">${i}</button>`;
    } else if (i === 1 || i === totalPages || (i >= currentActivityLogPage - 2 && i <= currentActivityLogPage + 2)) {
      paginationHTML += `<button class="pagination-btn" onclick="changeActivityLogPage(${i})">${i}</button>`;
    } else if (i === currentActivityLogPage - 3 || i === currentActivityLogPage + 3) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  // Next button
  if (currentActivityLogPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="changeActivityLogPage(${currentActivityLogPage + 1})">Next ›</button>`;
  }
  
  paginationHTML += '</div>';
  paginationDiv.innerHTML = paginationHTML;
}

function changeActivityLogPage(page) {
  currentActivityLogPage = page;
  fetchUserActivityLogs(page, activityLogRecordsPerPage);
}

function changeActivityLogRecordsPerPage(recordsPerPage) {
  activityLogRecordsPerPage = parseInt(recordsPerPage);
  currentActivityLogPage = 1;
  fetchUserActivityLogs(1, recordsPerPage);
}

function handleUserActivityLogFilters() {
  currentActivityLogPage = 1;
  fetchUserActivityLogs(1, activityLogRecordsPerPage);
}

function handleDateRangeChange() {
  const dateRange = document.getElementById('activityDateRange')?.value || 'all';
  
  // Show/hide week picker
  const weekGroup = document.getElementById('activityWeekGroup');
  if (weekGroup) {
    weekGroup.style.display = dateRange === 'weekly' ? 'flex' : 'none';
  }

  // Show/hide month picker
  const monthGroup = document.getElementById('activityMonthGroup');
  if (monthGroup) {
    monthGroup.style.display = dateRange === 'monthly' ? 'flex' : 'none';
  }

  // Show/hide year picker
  const yearGroup = document.getElementById('activityYearGroup');
  if (yearGroup) {
    yearGroup.style.display = dateRange === 'yearly' ? 'flex' : 'none';
  }

  // Show/hide custom date inputs
  const customDateGroup = document.getElementById('activityCustomDateGroup');
  if (customDateGroup) {
    customDateGroup.style.display = dateRange === 'custom' ? 'flex' : 'none';
  }
  
  // Auto-apply filters for All Time, require Filter button for others
  if (dateRange === 'all') {
    handleUserActivityLogFilters();
  }
}

function exportUserActivityLogExcel() {
  let csv = 'User,Activity,Date/Time,Details\n';
  csv += userActivityLogData.map(row => {
    // Determine activity type from action text
    let activityType = 'Update';
    const action = row.Activity.toLowerCase();
    if (action.includes('login') || action.includes('logged in')) activityType = 'Login';
    else if (action.includes('logout') || action.includes('logged out')) activityType = 'Logout';
    else if (action.includes('add') || action.includes('created')) activityType = 'Add';
    else if (action.includes('edit') || action.includes('updated')) activityType = 'Edit';
    else if (action.includes('delete') || action.includes('deleted')) activityType = 'Delete';
    
    // Format timestamp to relative time for export
    const relativeTime = formatRelativeTime(row['Date/Time']);
    
    return [row.User, activityType, relativeTime, row.Activity].map(v => '"' + v.replace(/"/g, '""') + '"').join(',');
  }).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'user-activity-log.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportUserActivityLogPDF() {
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('Generated Report', doc.internal.pageSize.getWidth() / 2, 60, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.text('Report: User Activity Log', doc.internal.pageSize.getWidth() / 2, 90, { align: 'center' });
  doc.setFontSize(12);
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  doc.text(`Generated on: ${dateStr}`, doc.internal.pageSize.getWidth() / 2, 110, { align: 'center' });

  // Prepare table data
  const tableData = userActivityLogData.map(row => {
    // Determine activity type from action text
    let activityType = 'Update';
    const action = row.Activity.toLowerCase();
    if (action.includes('login') || action.includes('logged in')) activityType = 'Login';
    else if (action.includes('logout') || action.includes('logged out')) activityType = 'Logout';
    else if (action.includes('add') || action.includes('created')) activityType = 'Add';
    else if (action.includes('edit') || action.includes('updated')) activityType = 'Edit';
    else if (action.includes('delete') || action.includes('deleted')) activityType = 'Delete';
    
    // Format timestamp to relative time for export
    const relativeTime = formatRelativeTime(row['Date/Time']);
    
    return [row.User, activityType, relativeTime, row.Activity];
  });
  
  doc.autoTable({
    startY: 130,
    head: [['User', 'Activity', 'Date/Time', 'Details']],
    body: tableData,
    styles: { fontSize: 12, cellPadding: 8 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 }
  });
  doc.save('user-activity-log.pdf');
}

// Initialize user activity log functionality
function initializeUserActivityLog() {
  // Set up event listeners
  const filterBtn = document.getElementById('filterActivityLogBtn');
  const excelBtn = document.getElementById('exportActivityLogExcel');
  const pdfBtn = document.getElementById('exportActivityLogPDF');
  const activityTypeFilter = document.getElementById('activityTypeFilter');
  const dateRangeFilter = document.getElementById('activityDateRange');
  const startDateFilter = document.getElementById('activityDateStart');
  const endDateFilter = document.getElementById('activityDateEnd');
  
  if (filterBtn) {
    filterBtn.addEventListener('click', handleUserActivityLogFilters);
  }
  
  if (excelBtn) {
    excelBtn.addEventListener('click', exportUserActivityLogExcel);
  }
  
  if (pdfBtn) {
    pdfBtn.addEventListener('click', exportUserActivityLogPDF);
  }
  
  // Filters apply only when clicking Filter button; no auto-fetch on change
  if (activityTypeFilter) {
    activityTypeFilter.addEventListener('change', () => {});
  }
  
  if (dateRangeFilter) {
    dateRangeFilter.addEventListener('change', handleDateRangeChange);
  }
  
  if (startDateFilter) {
    startDateFilter.addEventListener('change', () => {});
  }
  
  if (endDateFilter) {
    endDateFilter.addEventListener('change', () => {});
  }
  
  // Add event listeners for new date pickers
  const weekPicker = document.getElementById('activityWeekPicker');
  if (weekPicker) {
    weekPicker.addEventListener('change', () => {});
  }

  const monthPicker = document.getElementById('activityMonthPicker');
  if (monthPicker) {
    monthPicker.addEventListener('change', () => {});
  }

  const yearPicker = document.getElementById('activityYearPicker');
  if (yearPicker) {
    yearPicker.addEventListener('change', () => {});
  }
  
  // Initial fetch from API (all time default)
  fetchUserActivityLogs(1, activityLogRecordsPerPage);
}

// Helper functions for date calculations
function getWeekStartDate(year, week) {
    const firstDayOfYear = new Date(year, 0, 1);
    const daysToAdd = (week - 1) * 7;
    const weekStart = new Date(firstDayOfYear);
    weekStart.setDate(firstDayOfYear.getDate() + daysToAdd);
    
    // Adjust to Monday (ISO week starts on Monday)
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToMonday);
    
    return weekStart;
}

function getWeekEndDate(year, week) {
    const weekStart = getWeekStartDate(year, week);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
}

// Export functions for global access
window.changeActivityLogPage = changeActivityLogPage;
window.changeActivityLogRecordsPerPage = changeActivityLogRecordsPerPage;
window.initializeUserActivityLog = initializeUserActivityLog;

// Legacy function for backward compatibility
function showUserActivityLog() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('user-activity-log-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    if (window.initializeUserActivityLog) {
      window.initializeUserActivityLog();
    }
  }
}

window.showUserActivityLog = showUserActivityLog;