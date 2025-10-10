

// Global variables for admin log data
let adminLogData = [];
let currentAdminLogPage = 1;
let adminLogRecordsPerPage = 25;
let totalAdminLogRecords = 0;
let currentFilters = {
  actionType: 'all',
  dateRange: 'all',
  startDate: '',
  endDate: ''
};

function getFilteredAdminLogData() {
  // Return the current data from API (already filtered on server side)
  return adminLogData;
}

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
    // For older dates, show the actual date
    return logTime.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: logTime.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

// Function to fetch admin logs from API
async function fetchAdminLogs(page = 1, limit = 25) {
  try {
    // Get current filters
    const actionType = document.getElementById('adminLogActivityType')?.value || 'all';
    const dateRange = document.getElementById('adminLogDateRange')?.value || 'all';
    const startDate = document.getElementById('adminLogStartDate')?.value || '';
    const endDate = document.getElementById('adminLogEndDate')?.value || '';
    
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
            const s = getWeekStartDate(parseInt(year), parseInt(week));
            const e = getWeekEndDate(parseInt(year), parseInt(week));
            calculatedStartDate = s.toISOString().split('T')[0];
            calculatedEndDate = e.toISOString().split('T')[0];
          } else {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() + 1);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
            calculatedStartDate = weekStart.toISOString().split('T')[0];
            calculatedEndDate = weekEnd.toISOString().split('T')[0];
          }
          break;
        case 'monthly':
          const monthPicker = document.getElementById('activityMonthPicker');
          if (monthPicker && monthPicker.value) {
            const [year, month] = monthPicker.value.split('-');
            const ms = new Date(parseInt(year), parseInt(month) - 1, 1);
            const me = new Date(parseInt(year), parseInt(month), 0);
            calculatedStartDate = ms.toISOString().split('T')[0];
            calculatedEndDate = me.toISOString().split('T')[0];
          } else {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth()+1, 0);
            calculatedStartDate = monthStart.toISOString().split('T')[0];
            calculatedEndDate = monthEnd.toISOString().split('T')[0];
          }
          break;
        case 'yearly':
          const yearPicker = document.getElementById('activityYearPicker');
          if (yearPicker && yearPicker.value) {
            const y = parseInt(yearPicker.value);
            const ys = new Date(y, 0, 1);
            const ye = new Date(y, 11, 31);
            calculatedStartDate = ys.toISOString().split('T')[0];
            calculatedEndDate = ye.toISOString().split('T')[0];
          } else {
            const ys = new Date(today.getFullYear(), 0, 1);
            const ye = new Date(today.getFullYear(), 11, 31);
            calculatedStartDate = ys.toISOString().split('T')[0];
            calculatedEndDate = ye.toISOString().split('T')[0];
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
    console.log('Admin Log Activity Type Filter:', actionType);
    console.log('Admin Log Date Range:', dateRange);
    console.log('Admin Log Calculated Start Date:', calculatedStartDate);
    console.log('Admin Log Calculated End Date:', calculatedEndDate);
    console.log('Admin Log API URL:', `/api/admin/logs?${params}`);
    
    // Get JWT token from localStorage (fallbacks for compatibility)
    const jwtToken = localStorage.getItem('jwt_token') || 
                     localStorage.getItem('sessionToken') || 
                     localStorage.getItem('session_token');
    
    const response = await fetch(`/api/admin/logs?${params}`, {
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
      adminLogData = result.logs;
      totalAdminLogRecords = result.pagination.total;
      currentAdminLogPage = result.pagination.page;
      adminLogRecordsPerPage = result.pagination.limit;
      
      renderAdminLogTable();
      renderAdminLogPagination(totalAdminLogRecords);
    } else {
      console.error('API Error:', result.error);
      adminLogData = [];
      totalAdminLogRecords = 0;
      renderAdminLogTable();
    }
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    adminLogData = [];
    totalAdminLogRecords = 0;
    renderAdminLogTable();
  }
}

function renderAdminLogTable() {
  const tbody = document.getElementById('adminLogTableBody');
  if (!tbody) {
    return;
  }
  
  if (adminLogData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No Admin Activity Found</div>
        <div class="empty-state-desc">Try adjusting your filters or check back later for new activity.</div>
      </div>
    </td></tr>`;
    return;
  }
  
  // Data is already paginated from the API
  tbody.innerHTML = adminLogData.map(row => {
    // Determine activity type from action text
    let activityType = 'update';
    const action = row.Activity.toLowerCase();
    if (action.includes('login') || action.includes('logged in')) activityType = 'login';
    else if (action.includes('logout') || action.includes('logged out')) activityType = 'logout';
    else if (action.includes('add') || action.includes('created')) activityType = 'add';
    else if (action.includes('edit') || action.includes('updated')) activityType = 'update';
    else if (action.includes('delete') || action.includes('deleted')) activityType = 'delete';
    
    // Format timestamp to relative time
    const relativeTime = formatRelativeTime(row['Date/Time']);
    
    return `
      <tr>
        <td><strong>${row.Admin}</strong></td>
        <td><span class="activity-badge activity-${activityType}">${activityType.charAt(0).toUpperCase() + activityType.slice(1)}</span></td>
        <td>${relativeTime}</td>
        <td>${row.Activity}</td>
      </tr>
    `;
  }).join('');
}

function renderAdminLogPagination(totalRecords) {
  const paginationDiv = document.getElementById('adminLogPagination');
  if (!paginationDiv) return;
  if (!totalRecords || totalRecords <= 0) {
    paginationDiv.style.display = 'none';
    paginationDiv.innerHTML = '';
    return;
  }
  paginationDiv.style.display = '';
  const totalPages = Math.ceil(totalRecords / adminLogRecordsPerPage);
  
  let paginationHTML = '<div class="pagination-info">';
  paginationHTML += `Showing ${((currentAdminLogPage - 1) * adminLogRecordsPerPage) + 1} to ${Math.min(currentAdminLogPage * adminLogRecordsPerPage, totalRecords)} of ${totalRecords} records`;
  paginationHTML += '</div>';
  
  paginationHTML += '<div class="pagination-controls">';
  
  // Previous button
  if (currentAdminLogPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="changeAdminLogPage(${currentAdminLogPage - 1})">‹ Previous</button>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentAdminLogPage) {
      paginationHTML += `<button class="pagination-btn active">${i}</button>`;
    } else if (i === 1 || i === totalPages || (i >= currentAdminLogPage - 2 && i <= currentAdminLogPage + 2)) {
      paginationHTML += `<button class="pagination-btn" onclick="changeAdminLogPage(${i})">${i}</button>`;
    } else if (i === currentAdminLogPage - 3 || i === currentAdminLogPage + 3) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  // Next button
  if (currentAdminLogPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="changeAdminLogPage(${currentAdminLogPage + 1})">Next ›</button>`;
  }
  
  paginationHTML += '</div>';
  paginationDiv.innerHTML = paginationHTML;
}

function changeAdminLogPage(page) {
  currentAdminLogPage = page;
  fetchAdminLogs(page, adminLogRecordsPerPage);
}

function changeAdminLogRecordsPerPage(recordsPerPage) {
  adminLogRecordsPerPage = parseInt(recordsPerPage);
  currentAdminLogPage = 1;
  fetchAdminLogs(1, recordsPerPage);
}

function handleAdminLogFilters() {
  renderAdminLogTable();
}

function exportAdminLogExcel() {
  let csv = 'Admin,Activity,Date/Time,Details\n';
  csv += adminLogData.map(row => {
    // Determine activity type from action text
    let activityType = 'Update';
    const action = row.Activity.toLowerCase();
    if (action.includes('login') || action.includes('logged in')) activityType = 'Login';
    else if (action.includes('logout') || action.includes('logged out')) activityType = 'Logout';
    else if (action.includes('add') || action.includes('created')) activityType = 'Add';
    else if (action.includes('edit') || action.includes('updated')) activityType = 'Update';
    else if (action.includes('delete') || action.includes('deleted')) activityType = 'Delete';
    
    // Format timestamp to relative time for export
    const relativeTime = formatRelativeTime(row['Date/Time']);
    
    return [row.Admin, activityType, relativeTime, row.Activity].map(v => '"' + v.replace(/"/g, '""') + '"').join(',');
  }).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'admin-log.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAdminLogPDF() {
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4', compress: true });
  // Header bar
  doc.setFillColor(74, 158, 255);
  doc.rect(0, 0, doc.internal.pageSize.width, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('SafeBite', 40, 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.text('Generated Report', 40, 55);

  // Meta box
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(248, 249, 250);
  doc.rect(40, 100, doc.internal.pageSize.width - 80, 60, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(40, 100, doc.internal.pageSize.width - 80, 60, 'S');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  doc.text(`Report: ADMIN LOGS`, 50, 120);
  doc.text(`Generated on: ${dateStr}`, 50, 135);
  doc.text(`Total Records: ${adminLogData.length}`, 300, 135);

  // Table data
  const body = adminLogData.map(row => {
    let activityType = 'Update';
    const action = row.Activity.toLowerCase();
    if (action.includes('login') || action.includes('logged in')) activityType = 'Login';
    else if (action.includes('logout') || action.includes('logged out')) activityType = 'Logout';
    else if (action.includes('add') || action.includes('created')) activityType = 'Add';
    else if (action.includes('edit') || action.includes('updated')) activityType = 'Update';
    else if (action.includes('delete') || action.includes('deleted')) activityType = 'Delete';
    const relativeTime = formatRelativeTime(row['Date/Time']);
    return [row.Admin, activityType, relativeTime, row.Activity];
  });

  const pageWidth = doc.internal.pageSize.width;
  const marginLeft = 40;
  const marginRight = 40;
  const availableWidth = pageWidth - marginLeft - marginRight;
  const colWidths = {
    0: Math.floor(availableWidth * 0.25),
    1: Math.floor(availableWidth * 0.15),
    2: Math.floor(availableWidth * 0.20),
    3: Math.floor(availableWidth * 0.40)
  };

  doc.autoTable({
    startY: 180,
    head: [['Admin', 'Activity', 'Date/Time', 'Details']],
    body,
    margin: { left: marginLeft, right: marginRight },
    styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak', valign: 'middle', lineColor: [200,200,200], lineWidth: 0.5 },
    headStyles: { fillColor: [74,158,255], textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: colWidths[0] },
      1: { cellWidth: colWidths[1], halign: 'center' },
      2: { cellWidth: colWidths[2], halign: 'center' },
      3: { cellWidth: colWidths[3] }
    },
    didDrawPage: function (dataHook) {
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(`Page ${dataHook.pageNumber}`, pageWidth - 80, doc.internal.pageSize.height - 20);
    }
  });
  doc.save('admin-log.pdf');
}

// Initialize admin log functionality
function initializeAdminLog() {
  // Set up event listeners
  const filterBtn = document.getElementById('adminLogFilterBtn');
  const excelBtn = document.getElementById('adminLogDownloadExcel');
  const pdfBtn = document.getElementById('adminLogDownloadPDF');
  const activityTypeFilter = document.getElementById('adminLogActivityType');
  const dateRangeFilter = document.getElementById('adminLogDateRange');
  const startDateFilter = document.getElementById('adminLogStartDate');
  const endDateFilter = document.getElementById('adminLogEndDate');
  
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      currentAdminLogPage = 1;
      fetchAdminLogs(1, adminLogRecordsPerPage);
    });
  }
  
  if (excelBtn) {
    excelBtn.addEventListener('click', exportAdminLogExcel);
  }
  
  if (pdfBtn) {
    pdfBtn.addEventListener('click', exportAdminLogPDF);
  }
  
  // Add event listeners for filter inputs to make them work automatically
  if (activityTypeFilter) {
    // Apply only on Filter button
    activityTypeFilter.addEventListener('change', () => {});
  }
  
  if (dateRangeFilter) {
    dateRangeFilter.addEventListener('change', handleAdminLogDateRangeChange);
  }
  
  if (startDateFilter) {
    startDateFilter.addEventListener('change', () => {});
  }
  
  if (endDateFilter) {
    endDateFilter.addEventListener('change', () => {});
  }
  
  // Initial fetch from API
  fetchAdminLogs(1, adminLogRecordsPerPage);
}

function handleAdminLogDateRangeChange() {
  const dateRange = document.getElementById('adminLogDateRange')?.value || 'all';
  const customDateInputs = document.querySelectorAll('.custom-date-inputs');
  const weekGroup = document.getElementById('activityWeekGroup');
  const monthGroup = document.getElementById('activityMonthGroup');
  const yearGroup = document.getElementById('activityYearGroup');
  
  // Show/hide pickers like other pages
  if (weekGroup) weekGroup.style.display = (dateRange === 'weekly') ? 'flex' : 'none';
  if (monthGroup) monthGroup.style.display = (dateRange === 'monthly') ? 'flex' : 'none';
  if (yearGroup) yearGroup.style.display = (dateRange === 'yearly') ? 'flex' : 'none';

  // Custom date inputs visibility
  customDateInputs.forEach(input => { input.style.display = (dateRange === 'custom') ? 'block' : 'none'; });

  // Do not auto-apply; wait for Filter button
}

// Debounce function to limit API calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export functions for global access
window.changeAdminLogPage = changeAdminLogPage;
window.changeAdminLogRecordsPerPage = changeAdminLogRecordsPerPage;
window.initializeAdminLog = initializeAdminLog;