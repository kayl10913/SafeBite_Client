// Global variables for report generation
let reportData = [];
let currentReportPage = 1;
let reportRecordsPerPage = 10; // Changed from 25 to 10 to match Admin Logs
let totalReportRecords = 0;
let currentReportType = '';
let currentDateRange = '';

// Removed mock data

// Function to fetch new users data from database
async function fetchNewUsersData(startDate, endDate, page = 1, limit = 25) {
    try {
        // Check if AdminAPI is available
        if (typeof AdminAPI === 'undefined') {
            console.error('AdminAPI is not defined. Make sure api-config.js is loaded.');
            throw new Error('API configuration not loaded');
        }
        
        // Only pass date parameters if they are provided
        const data = await AdminAPI.getNewUsersReport(startDate || null, endDate || null, page, limit);
        return data.success ? data : { users: [], total_count: 0, pagination: {} };
    } catch (error) {
        console.error('Error fetching new users data:', error);
        return { users: [], total_count: 0, pagination: {} };
    }
}

// Function to format timestamp to relative time (matching admin-log.js)
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

// Function to render table (matching admin-log.js style)
function renderTable(headers, rows) {
  let table = '<table class="admin-log-table">';
  table += '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
  table += '<tbody>';
  if (rows.length === 0) {
    table += `<tr><td colspan="${headers.length}" class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">No Data Available</div>
        <div class="empty-state-desc">No data found for the selected report type and date range.</div>
      </div>
    </td></tr>`;
  } else {
    table += rows.map(row => '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>').join('');
  }
  table += '</tbody></table>';
  return table;
}

// Function to get dates from range (matching admin-log.js style)
function getDatesFromRange(range) {
    const endDate = new Date(); // Current date
    let startDate = new Date(endDate);
    
    switch(range) {
        case 'All Time':
            startDate = new Date('2010-01-01');
            break;
        case 'Daily':
            startDate.setDate(endDate.getDate() - 1);
            break;
        case 'Weekly':
            const weekPicker = document.getElementById('reportWeekPicker');
            if (weekPicker && weekPicker.value) {
                const [year, week] = weekPicker.value.split('-W');
                startDate = getWeekStartDate(parseInt(year), parseInt(week));
                endDate.setTime(getWeekEndDate(parseInt(year), parseInt(week)).getTime());
            } else {
                startDate.setDate(endDate.getDate() - 7);
            }
            break;
        case 'Monthly':
            const monthPicker = document.getElementById('reportMonthPicker');
            if (monthPicker && monthPicker.value) {
                const [year, month] = monthPicker.value.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0);
                endDate.setTime(lastDayOfMonth.getTime());
            } else {
                const currentMonth = endDate.getMonth();
                const currentYear = endDate.getFullYear();
                startDate = new Date(currentYear, currentMonth - 1, 1);
                const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0);
                endDate.setTime(lastDayOfPrevMonth.getTime());
            }
            break;
        case 'Yearly':
            const yearPicker = document.getElementById('reportYearPicker');
            if (yearPicker && yearPicker.value) {
                const year = parseInt(yearPicker.value);
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
            } else {
                const currentYearForYearly = endDate.getFullYear();
                startDate = new Date(currentYearForYearly - 1, 0, 1);
                const lastDayOfPrevYear = new Date(currentYearForYearly, 0, 0);
                endDate.setTime(lastDayOfPrevYear.getTime());
            }
            break;
    }
    return { startDate, endDate };
}

// Function to render report table (matching admin-log.js style)
function renderReportTable() {
  const tbody = document.getElementById('report-preview-content');
  if (!tbody) {
    return;
  }
  
  if (reportData.length === 0) {
    tbody.innerHTML = `<div class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">No Report Generated</div>
        <div class="empty-state-desc">Select your report type and date range, then click "Generate Report" to view data.</div>
      </div>
    </div>`;
    return;
  }
  
  // Render the appropriate table based on report type
  let headers = [];
  let rows = [];
  
  switch(currentReportType) {
    case 'new_users':
      headers = ['User ID', 'Full Name', 'Username', 'Email', 'Contact', 'Status', 'Registration Date'];
      rows = reportData.map(user => [
        user.user_id,
        user.full_name,
        user.username,
        user.email,
        user.contact || 'N/A',
        `<span class="status-badge status-${user.status.toLowerCase()}">${user.status}</span>`,
        formatRelativeTime(user.created_at)
      ]);
      break;
      
    case 'top_spoiling_food':
      headers = ['Food Item', 'Spoilage Reports', 'Risk Level'];
      rows = reportData.map(item => [
        item['Food Item'],
        item['Spoilage Reports'],
        `<span class="status-badge status-${item['Risk Level'].toLowerCase()}">${item['Risk Level']}</span>`
      ]);
      break;
      
    case 'most_used_sensor':
      headers = ['Sensor Type', 'Used', 'Spoiled'];
      rows = reportData.map(sensor => [
        sensor['Sensor Type'],
        sensor['Used'],
        sensor['Spoiled']
      ]);
      break;
  }
  
  tbody.innerHTML = renderTable(headers, rows);
}

// Function to render pagination (matching admin-log.js exactly)
function renderReportPagination(totalRecords) {
  const paginationDiv = document.getElementById('reportPagination');
  if (!paginationDiv) return;
  
  const totalPages = Math.ceil(totalRecords / reportRecordsPerPage);
  
  // Always show pagination when there's data, even if only 1 page
  if (totalRecords === 0) {
    paginationDiv.style.display = 'none';
    return;
  }
  
  paginationDiv.style.display = 'block';
  
  let paginationHTML = '<div class="pagination-info">';
  paginationHTML += `Showing ${((currentReportPage - 1) * reportRecordsPerPage) + 1} to ${Math.min(currentReportPage * reportRecordsPerPage, totalRecords)} of ${totalRecords} records`;
  paginationHTML += '</div>';
  
  paginationHTML += '<div class="pagination-controls">';
  
  // Previous button
  if (currentReportPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="changeReportPage(${currentReportPage - 1})">‹ Previous</button>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentReportPage) {
      paginationHTML += `<button class="pagination-btn active">${i}</button>`;
    } else if (i === 1 || i === totalPages || (i >= currentReportPage - 2 && i <= currentReportPage + 2)) {
      paginationHTML += `<button class="pagination-btn" onclick="changeReportPage(${i})">${i}</button>`;
    } else if (i === currentReportPage - 3 || i === currentReportPage + 3) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  // Next button
  if (currentReportPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="changeReportPage(${currentReportPage + 1})">Next ›</button>`;
  }
  
  paginationHTML += '</div>';
  paginationDiv.innerHTML = paginationHTML;
}

// Function to change report page (matching admin-log.js style)
function changeReportPage(page) {
  currentReportPage = page;
  generateReport(currentReportType, currentDateRange);
}

// Function to change records per page (matching admin-log.js style)
function changeReportRecordsPerPage(recordsPerPage) {
  reportRecordsPerPage = parseInt(recordsPerPage);
  currentReportPage = 1;
  generateReport(currentReportType, currentDateRange);
}

// Function to generate report (matching admin-log.js structure)
async function generateReport(reportType, dateRange) {
  const reportContent = document.getElementById('report-preview-content');
  const reportTypeSelect = document.getElementById('reportType');
  const dateRangeSelect = document.getElementById('reportDateRange');
      const reportTitle = reportTypeSelect.options[reportTypeSelect.selectedIndex].text;

  // Store current report type and date range for pagination
  currentReportType = reportType;
  currentDateRange = dateRange;
  currentReportPage = 1; // Reset to first page when generating new report

      let dates;
      if (dateRange === 'Custom') {
          const start = document.getElementById('reportStartDate').value;
          const end = document.getElementById('reportEndDate').value;
          if (!start || !end) {
              reportContent.innerHTML = `<div class="empty-state">
                <div class="empty-state-content">
                  <div class="empty-state-icon">📅</div>
                  <div class="empty-state-title">Date Range Required</div>
                  <div class="empty-state-desc">Please select both a start and end date for the custom range.</div>
                </div>
              </div>`;
              return;
          }
          dates = { startDate: new Date(start), endDate: new Date(end) };
      } else {
          dates = getDatesFromRange(dateRange);
      }
      
  console.log(`Date range "${dateRange}" calculated:`, {
    startDate: dates.startDate.toISOString(),
    endDate: dates.endDate.toISOString()
      });

      let headers = [];
      let rows = [];

      switch(reportType) {
        case 'new_users':
      headers = ['User ID', 'Full Name', 'Username', 'Email', 'Contact', 'Status', 'Registration Date'];
      
      // Show loading message
      reportContent.innerHTML = `<div class="empty-state">
        <div class="empty-state-content">
          <div class="empty-state-icon">⏳</div>
          <div class="empty-state-title">Loading New Users Data</div>
          <div class="empty-state-desc">Please wait while we fetch the latest user information...</div>
        </div>
      </div>`;
      
      try {
        let startDate = null;
        let endDate = null;
        
        if (dateRange !== 'All Time') {
          startDate = dates.startDate.toISOString().split('T')[0];
          endDate = dates.endDate.toISOString().split('T')[0];
        }
        
        const data = await fetchNewUsersData(startDate, endDate, currentReportPage, reportRecordsPerPage);
        
        if (data.users.length === 0) {
          reportData = [];
          reportContent.innerHTML = `<div class="empty-state">
            <div class="empty-state-content">
              <div class="empty-state-icon">🚫</div>
              <div class="empty-state-title">No New Users Found</div>
              <div class="empty-state-desc">No new users found for the selected date range. Try adjusting your filters or check a different time period.</div>
            </div>`;
          document.getElementById('reportPagination').style.display = 'none';
        } else {
          reportData = data.users;
          totalReportRecords = data.total_count;
          renderReportTable();
          // Always show pagination when there's data
          renderReportPagination(data.total_count);
        }
      } catch (error) {
        console.error('Error generating new users report:', error);
        reportData = [];
        let errorMessage = 'Error loading data. Please try again.';
        if (error.message === 'API configuration not loaded') {
          errorMessage = 'API configuration not loaded. Please refresh the page.';
        }
        reportContent.innerHTML = `<div class="empty-state">
          <div class="empty-state-content">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-title">Error Loading Data</div>
            <div class="empty-state-desc">${errorMessage}</div>
          </div>
        </div>`;
        document.getElementById('reportPagination').style.display = 'none';
      }
            break;

        case 'top_spoiling_food':
      headers = ['Food Item', 'Spoilage Reports', 'Risk Level'];
      
      // Show loading message
      reportContent.innerHTML = `<div class="empty-state">
        <div class="empty-state-content">
          <div class="empty-state-icon">⏳</div>
          <div class="empty-state-title">Loading Top Spoiling Foods Data</div>
          <div class="empty-state-desc">Please wait while we analyze the spoilage patterns...</div>
        </div>
      </div>`;
      
      try {
        // Check if AdminAPI is available
        if (typeof AdminAPI === 'undefined') {
          throw new Error('API configuration not loaded');
        }
        
        // Check if backend is accessible
        try {
          const healthCheck = await fetch('/api/auth/login', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          console.log('Backend health check status:', healthCheck.status);
        } catch (healthError) {
          console.warn('Backend health check failed:', healthError);
        }
        
        let startDate = null;
        let endDate = null;
        
        if (dateRange !== 'All Time') {
          startDate = dates.startDate.toISOString().split('T')[0];
          endDate = dates.endDate.toISOString().split('T')[0];
        }
        
        console.log('Fetching top spoiling foods with params:', {
          startDate,
          endDate,
          page: currentReportPage,
          limit: reportRecordsPerPage
        });
        
        const data = await AdminAPI.getTopSpoilingFoodsReport(startDate, endDate, currentReportPage, reportRecordsPerPage);
        
        console.log('Top spoiling foods API response:', data);
        
        if (!data || !data.success) {
          throw new Error(data?.message || 'Failed to fetch top spoiling foods data');
        }
        
        if (!data.foods || data.foods.length === 0) {
          reportData = [];
          reportContent.innerHTML = `<div class="empty-state">
            <div class="empty-state-content">
              <div class="empty-state-icon">🍽️</div>
              <div class="empty-state-title">No Spoilage Data Found</div>
              <div class="empty-state-desc">No spoilage data found for the selected date range. Try adjusting your filters or check a different time period.</div>
            </div>
          </div>`;
          document.getElementById('reportPagination').style.display = 'none';
        } else {
          reportData = data.foods;
          totalReportRecords = data.total_count || data.foods.length;
          renderReportTable();
          renderReportPagination(data.total_count || data.foods.length);
        }
      } catch (error) {
        console.error('Error generating top spoiling foods report:', error);
        reportData = [];
        
        let errorMessage = 'Error loading data. Please try again.';
        
        if (error.message === 'API configuration not loaded') {
          errorMessage = 'API configuration not loaded. Please refresh the page.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication error. Please log in again.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Access denied. You do not have permission to view this data.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.message.includes('Failed to fetch top spoiling foods data')) {
          errorMessage = 'Unable to fetch spoilage data. Please check if the backend server is running.';
        }
        
        reportContent.innerHTML = `<div class="empty-state">
          <div class="empty-state-content">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-title">Error Loading Data</div>
            <div class="empty-state-desc">${errorMessage}</div>
          </div>
        </div>`;
        document.getElementById('reportPagination').style.display = 'none';
      }
            break;

        case 'most_used_sensor':
      headers = ['Sensor Type', 'Usage Count', 'Last Used'];
      
      // Show loading message
      reportContent.innerHTML = `<div class="empty-state">
        <div class="empty-state-content">
          <div class="empty-state-icon">⏳</div>
          <div class="empty-state-title">Loading Most Used Sensor Data</div>
          <div class="empty-state-desc">Please wait while we analyze sensor usage patterns...</div>
        </div>
      </div>`;
      
      try {
        // Check if AdminAPI is available
        if (typeof AdminAPI === 'undefined') {
          throw new Error('API configuration not loaded');
        }
        
        // Get date parameters for filtering
        let startDate = null;
        let endDate = null;
        
        if (dateRange === 'Custom') {
          startDate = document.getElementById('reportStartDate').value;
          endDate = document.getElementById('reportEndDate').value;
        }
        // For predefined ranges (Daily, Weekly, Monthly, Yearly), we don't need start/end dates
        // The backend will use CURDATE() and other functions
        
        console.log('Fetching most used sensor data with params:', {
          page: currentReportPage,
          limit: reportRecordsPerPage,
          startDate,
          endDate,
          dateRange
        });
        
        const data = await AdminAPI.getMostUsedSensorReport(startDate, endDate, dateRange, currentReportPage, reportRecordsPerPage);
        
        console.log('Most used sensor API response:', data);
        
        if (!data || !data.success) {
          throw new Error(data?.message || 'Failed to fetch most used sensor data');
        }
        
        if (!data.sensors || data.sensors.length === 0) {
          reportData = [];
          reportContent.innerHTML = `<div class="empty-state">
            <div class="empty-state-content">
              <div class="empty-state-icon">📡</div>
              <div class="empty-state-title">No Sensor Data Found</div>
              <div class="empty-state-desc">No sensor usage data found. Try checking if sensors are properly connected and have readings.</div>
            </div>
          </div>`;
          document.getElementById('reportPagination').style.display = 'none';
        } else {
          reportData = data.sensors;
          totalReportRecords = data.total_count || data.sensors.length;
          renderReportTable();
          renderReportPagination(data.total_count || data.sensors.length);
        }
      } catch (error) {
        console.error('Error generating most used sensor report:', error);
        reportData = [];
        
        let errorMessage = 'Error loading data. Please try again.';
        
        if (error.message === 'API configuration not loaded') {
          errorMessage = 'API configuration not loaded. Please refresh the page.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication error. Please log in again.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Access denied. You do not have permission to view this data.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.message.includes('Failed to fetch most used sensor data')) {
          errorMessage = 'Unable to fetch sensor data. Please check if the backend server is running.';
        }
        
        reportContent.innerHTML = `<div class="empty-state">
          <div class="empty-state-content">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-title">Error Loading Data</div>
            <div class="empty-state-desc">${errorMessage}</div>
          </div>
        </div>`;
        document.getElementById('reportPagination').style.display = 'none';
      }
            break;
      }
      
  // Add date range info to the report
  let reportInfo = '';
  if (dateRange === 'All Time') {
    if (currentReportType === 'new_users') {
      reportInfo = '<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing all users from all time</p>';
    } else if (currentReportType === 'top_spoiling_food') {
      reportInfo = '<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing all spoilage data from all time</p>';
    } else if (currentReportType === 'most_used_sensor') {
      reportInfo = '<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing all sensor usage data from all time</p>';
    } else {
      reportInfo = '<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing all data from all time</p>';
    }
  } else if (dateRange === 'Custom') {
    const start = document.getElementById('reportStartDate').value;
    const end = document.getElementById('reportEndDate').value;
    const formatCustomDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };
    const startFormatted = formatCustomDate(start);
    const endFormatted = formatCustomDate(end);
    if (currentReportType === 'new_users') {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing users from ${startFormatted} to ${endFormatted}</p>`;
    } else if (currentReportType === 'top_spoiling_food') {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing spoilage data from ${startFormatted} to ${endFormatted}</p>`;
    } else if (currentReportType === 'most_used_sensor') {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing sensor usage data from ${startFormatted} to ${endFormatted}</p>`;
    } else {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing data from ${startFormatted} to ${endFormatted}</p>`;
    }
  } else {
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };
    const startDate = formatDate(dates.startDate);
    const endDate = formatDate(dates.endDate);
    if (currentReportType === 'new_users') {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing users from ${startDate} to ${endDate}</p>`;
    } else if (currentReportType === 'top_spoiling_food') {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing spoilage data from ${startDate} to ${endDate}</p>`;
    } else if (currentReportType === 'most_used_sensor') {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing sensor usage data from ${startDate} to ${endDate}</p>`;
    } else {
      reportInfo = `<p style="margin-bottom: 16px; color: #bfc9da; font-size: 0.9em;">📊 Showing data from ${startDate} to ${endDate}</p>`;
    }
  }

  // Update the report content with info
  if (reportData.length > 0) {
    const currentContent = reportContent.innerHTML;
    reportContent.innerHTML = reportInfo + currentContent;
  }
  
  console.log(`Generated report for: ${reportType} (${dateRange})`);
}

// Export functions (matching admin-log.js style)
function exportReportCSV() {
  if (reportData.length === 0) {
        alert('Please generate a report first.');
        return;
      }

  let csv = '';
  // Add headers based on report type
  switch(currentReportType) {
    case 'new_users':
      csv = 'User ID,Full Name,Username,Email,Contact,Status,Registration Date\n';
      csv += reportData.map(user => [
        user.user_id,
        user.full_name,
        user.username,
        user.email,
        user.contact || 'N/A',
        user.status,
        new Date(user.created_at).toLocaleDateString()
      ].map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
      break;
    case 'top_spoiling_food':
      csv = 'Food Item,Spoilage Reports,Risk Level\n';
      csv += reportData.map(item => [
        item['Food Item'],
        item['Spoilage Reports'],
        item['Risk Level']
      ].map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
      break;
    case 'most_used_sensor':
      csv = 'Sensor Type,Used,Spoiled\n';
      csv += reportData.map(sensor => [
        sensor['Sensor Type'],
        sensor['Used'],
        sensor['Spoiled']
      ].map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
      break;
  }
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentReportType}-report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportReportPDF() {
  if (reportData.length === 0) {
        alert('Please generate a report first.');
        return;
      }
  
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('Generated Report', doc.internal.pageSize.getWidth() / 2, 60, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.text(`Report: ${currentReportType.replace(/_/g, ' ').toUpperCase()}`, doc.internal.pageSize.getWidth() / 2, 90, { align: 'center' });
  doc.setFontSize(12);
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  doc.text(`Generated on: ${dateStr}`, doc.internal.pageSize.getWidth() / 2, 110, { align: 'center' });
  
  // Prepare table data based on report type
  let tableData = [];
  let headers = [];
  
  switch(currentReportType) {
    case 'new_users':
      headers = ['User ID', 'Full Name', 'Username', 'Email', 'Contact', 'Status', 'Registration Date'];
      tableData = reportData.map(user => [
        user.user_id,
        user.full_name,
        user.username,
        user.email,
        user.contact || 'N/A',
        user.status,
        new Date(user.created_at).toLocaleDateString()
      ]);
      break;
    case 'top_spoiling_food':
      headers = ['Food Item', 'Spoilage Reports', 'Risk Level'];
      tableData = reportData.map(item => [item['Food Item'], item['Spoilage Reports'], item['Risk Level']]);
      break;
    case 'most_used_sensor':
      headers = ['Sensor Type', 'Used', 'Spoiled'];
      tableData = reportData.map(sensor => [
        sensor['Sensor Type'],
        sensor['Used'],
        sensor['Spoiled']
      ]);
      break;
  }
  
  doc.autoTable({
    startY: 130,
    head: [headers],
    body: tableData,
    styles: { fontSize: 12, cellPadding: 8 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 }
  });
  
  doc.save(`${currentReportType}-report.pdf`);
}

// Initialize report generator (matching admin-log.js style)
function initReportGenerator() {
  console.log('Report Generator Initialized');
  
  // Check if API configuration is loaded
  if (typeof API_CONFIG === 'undefined' || typeof AdminAPI === 'undefined') {
    console.warn('API configuration not loaded. Some features may not work properly.');
  }

  // Set default records per page to 10
  const recordsPerPageSelect = document.getElementById('reportRecordsPerPage');
  if (recordsPerPageSelect) {
    recordsPerPageSelect.value = '10';
  }

  const dateRangeSelect = document.getElementById('reportDateRange');
  const generateBtn = document.getElementById('generateReport');
  const exportCsvBtn = document.getElementById('exportReportCSV');
  const exportPdfBtn = document.getElementById('exportReportPDF');

  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', () => {
      // Show/hide week picker
      const weekGroup = document.getElementById('reportWeekGroup');
      if (weekGroup) {
        weekGroup.style.display = dateRangeSelect.value === 'Weekly' ? 'flex' : 'none';
      }

      // Show/hide month picker
      const monthGroup = document.getElementById('reportMonthGroup');
      if (monthGroup) {
        monthGroup.style.display = dateRangeSelect.value === 'Monthly' ? 'flex' : 'none';
      }

      // Show/hide year picker
      const yearGroup = document.getElementById('reportYearGroup');
      if (yearGroup) {
        yearGroup.style.display = dateRangeSelect.value === 'Yearly' ? 'flex' : 'none';
      }

      // Show/hide custom date inputs
      const customDateGroup = document.getElementById('reportCustomDateGroup');
      if (customDateGroup) {
        customDateGroup.style.display = dateRangeSelect.value === 'Custom' ? 'flex' : 'none';
      }
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const reportType = document.getElementById('reportType').value;
      const dateRange = dateRangeSelect.value;
      await generateReport(reportType, dateRange);
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportReportCSV);
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportReportPDF);
  }

  // Show default message instead of auto-generating
  const reportContent = document.getElementById('report-preview-content');
  if (reportContent) {
    reportContent.innerHTML = `<div class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">Ready to Generate Report</div>
        <div class="empty-state-desc">Select your report type and date range, then click "Generate Report" to view your data.</div>
      </div>
    </div>`;
  }
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

// Export functions for global access (matching admin-log.js style)
window.initReportGenerator = initReportGenerator; 
window.changeReportPage = changeReportPage;
window.changeReportRecordsPerPage = changeReportRecordsPerPage; 