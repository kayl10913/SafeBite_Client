// Report Generator JavaScript
class ReportGenerator {
    constructor() {
        this.reportData = [];
        this.currentReportType = 'user-activity';
        this.currentDateRange = 'weekly';
        this.customStartDate = null;
        this.customEndDate = null;
        
        // Pagination variables for activity log
        this.currentPage = 1;
        this.recordsPerPage = 25;
        this.totalRecords = 0;
        this.totalPages = 1;
        
        this.init();
    }

    init() {
        this.loadReportData();
        this.setupEventListeners();
        this.showEmptyState();
        this.togglePaginationControls(); // Show/hide pagination controls
    }

    setupEventListeners() {
        // Report type change
        const reportTypeSelect = document.getElementById('reportType');
        if (reportTypeSelect) {
            reportTypeSelect.addEventListener('change', (e) => {
                this.currentReportType = e.target.value;
                this.showEmptyState();
                this.togglePaginationControls();
            });
        }

        // Records per page change
        const recordsPerPageSelect = document.getElementById('recordsPerPage');
        if (recordsPerPageSelect) {
            recordsPerPageSelect.addEventListener('change', (e) => {
                console.log('Records per page changed to:', e.target.value);
                this.changeRecordsPerPage(e.target.value);
            });
        } else {
            console.error('Records per page select not found!');
        }

        // Date range change
        const dateRangeSelect = document.getElementById('dateRange');
        const customDateGroup = document.getElementById('customDateRangeGroup');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (dateRangeSelect) {
            dateRangeSelect.addEventListener('change', (e) => {
                this.currentDateRange = e.target.value;
                if (this.currentDateRange === 'custom') {
                    if (customDateGroup) customDateGroup.style.display = '';
                    // Set default dates (last 7 days) if not already set
                    if (!this.customStartDate && !this.customEndDate) {
                        const today = new Date();
                        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        const startDateStr = weekAgo.toISOString().split('T')[0];
                        const endDateStr = today.toISOString().split('T')[0];
                        
                        if (startDateInput) {
                            startDateInput.value = startDateStr;
                            this.customStartDate = startDateStr;
                        }
                        if (endDateInput) {
                            endDateInput.value = endDateStr;
                            this.customEndDate = endDateStr;
                        }
                    }
                } else {
                    if (customDateGroup) customDateGroup.style.display = 'none';
                    this.customStartDate = null;
                    this.customEndDate = null;
                    if (startDateInput) startDateInput.value = '';
                    if (endDateInput) endDateInput.value = '';
                }
                // Reset to first page when date range changes
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'sensor-data' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
                this.showEmptyState();
            });
        }
        if (startDateInput) {
            startDateInput.addEventListener('change', (e) => {
                this.customStartDate = e.target.value;
                // Auto-set end date if it's before start date
                if (this.customEndDate && e.target.value > this.customEndDate) {
                    endDateInput.value = e.target.value;
                    this.customEndDate = e.target.value;
                }
                // Reset to first page when date changes
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'sensor-data' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
            });
        }
        if (endDateInput) {
            endDateInput.addEventListener('change', (e) => {
                this.customEndDate = e.target.value;
                // Validate that end date is not before start date
                if (this.customStartDate && e.target.value < this.customStartDate) {
                    this.showNotification('End date cannot be before start date', 'warning');
                    e.target.value = this.customStartDate;
                    this.customEndDate = this.customStartDate;
                }
                // Reset to first page when date changes
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'sensor-data' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
            });
        }

        // Generate report button
        const generateBtn = document.getElementById('generateReport');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateReport();
            });
        }

        // Download Excel button
        const downloadExcelBtn = document.getElementById('downloadExcel');
        if (downloadExcelBtn) {
            downloadExcelBtn.addEventListener('click', () => {
                this.downloadExcel();
            });
        }

        // Download PDF button
        const downloadPdfBtn = document.getElementById('downloadPDF');
        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener('click', () => {
                this.downloadPDF();
            });
        }
    }

    async loadActivityLogData(page = 1, limit = 25, autoRender = false) {
        try {
            // Get session token for authentication
            const sessionToken = localStorage.getItem('jwt_token') || 
                                 localStorage.getItem('sessionToken') || 
                                 localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('No session token found');
                return;
            }

            const response = await fetch(`/api/users/activity-report?page=${page}&limit=${limit}`, {
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
                // Transform the data to match the expected format
                this.reportData['user-activity'] = result.data.map(log => ({
                    logId: log['LOG ID'],
                    action: log['ACTION'],
                    timestamp: log['TIMESTAMP']
                }));
                
                // Update pagination info
                if (result.pagination) {
                    this.currentPage = result.pagination.current_page;
                    this.totalPages = result.pagination.total_pages;
                    this.totalRecords = result.pagination.total_records;
                    this.recordsPerPage = result.pagination.records_per_page;
                }
                
                console.log('Activity log data loaded:', this.reportData['user-activity']);
                console.log('Pagination info:', result.pagination);
                
                // Only render if autoRender is true (for pagination navigation)
                if (autoRender && this.currentReportType === 'user-activity') {
                    this.renderActivityLogReport();
                }
            } else {
                console.error('Failed to load activity log data:', result.error);
            }
        } catch (error) {
            console.error('Error loading activity log data:', error);
        }
    }

    async loadActivityLogDataWithFilter(page = 1, limit = 25, autoRender = false) {
        try {
            // Get session token for authentication
            const sessionToken = localStorage.getItem('jwt_token') || 
                                 localStorage.getItem('sessionToken') || 
                                 localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('No session token found');
                return;
            }

            // Build query parameters for filtering
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });

            // Add date range filtering
            if (this.currentDateRange === 'custom' && this.customStartDate && this.customEndDate) {
                params.append('start_date', this.customStartDate);
                params.append('end_date', this.customEndDate);
            } else {
                // Add predefined date ranges
                const today = new Date();
                let startDate, endDate;
                
                switch (this.currentDateRange) {
                    case 'daily':
                        startDate = new Date(today);
                        endDate = new Date(today);
                        break;
                    case 'weekly':
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                        break;
                    case 'monthly':
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = new Date(today);
                        break;
                    case 'yearly':
                        startDate = new Date(today.getFullYear(), 0, 1);
                        endDate = new Date(today);
                        break;
                    default:
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                }
                
                params.append('start_date', startDate.toISOString().split('T')[0]);
                params.append('end_date', endDate.toISOString().split('T')[0]);
            }

            const response = await fetch(`/api/users/activity-report?${params.toString()}`, {
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
                // Transform the data to match the expected format
                this.reportData['user-activity'] = result.data.map(log => ({
                    logId: log['LOG ID'],
                    action: log['ACTION'],
                    timestamp: log['TIMESTAMP']
                }));
                
                // Update pagination info
                if (result.pagination) {
                    this.currentPage = result.pagination.current_page;
                    this.totalPages = result.pagination.total_pages;
                    this.totalRecords = result.pagination.total_records;
                    this.recordsPerPage = result.pagination.records_per_page;
                }
                
                console.log('Activity log data loaded with filter:', this.reportData['user-activity']);
                console.log('Pagination info:', result.pagination);
                console.log('Date range:', this.currentDateRange);
                
                // Only render if autoRender is true (for pagination navigation)
                if (autoRender && this.currentReportType === 'user-activity') {
                    this.renderActivityLogReport();
                }
            } else {
                console.error('Failed to load activity log data:', result.error);
            }
        } catch (error) {
            console.error('Error loading activity log data with filter:', error);
        }
    }

    async loadFoodSpoilageDataWithFilter(page = 1, limit = 25, autoRender = false) {
        try {
            // Get session token for authentication
            const sessionToken = localStorage.getItem('jwt_token') || 
                                 localStorage.getItem('sessionToken') || 
                                 localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('No session token found');
                return;
            }

            // Build query parameters for filtering
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });

            // Add date range filtering
            if (this.currentDateRange === 'custom' && this.customStartDate && this.customEndDate) {
                params.append('start_date', this.customStartDate);
                params.append('end_date', this.customEndDate);
            } else {
                // Add predefined date ranges
                const today = new Date();
                let startDate, endDate;
                
                switch (this.currentDateRange) {
                    case 'daily':
                        startDate = new Date(today);
                        endDate = new Date(today);
                        break;
                    case 'weekly':
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                        break;
                    case 'monthly':
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = new Date(today);
                        break;
                    case 'yearly':
                        startDate = new Date(today.getFullYear(), 0, 1);
                        endDate = new Date(today);
                        break;
                    default:
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                }
                
                params.append('start_date', startDate.toISOString().split('T')[0]);
                params.append('end_date', endDate.toISOString().split('T')[0]);
            }

            const response = await fetch(`/api/users/food-spoilage-report?${params.toString()}`, {
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
                // Transform the data to match the expected format
                this.reportData['food-spoilage'] = result.data.map(item => ({
                    foodItem: item['FOOD ITEM'],
                    category: item['CATEGORY'],
                    status: item['STATUS'],
                    riskScore: item['RISK SCORE'],
                    expiryDate: item['EXPIRY DATE'],
                    sensorReadings: item['SENSOR READINGS']
                }));
                
                // Update pagination info
                if (result.pagination) {
                    this.currentPage = result.pagination.current_page;
                    this.totalPages = result.pagination.total_pages;
                    this.totalRecords = result.pagination.total_records;
                    this.recordsPerPage = result.pagination.records_per_page;
                }
                
                console.log('Food spoilage data loaded with filter:', this.reportData['food-spoilage']);
                console.log('Pagination info:', result.pagination);
                console.log('Date range:', this.currentDateRange);
                
                // Only render if autoRender is true (for pagination navigation)
                if (autoRender && this.currentReportType === 'food-spoilage') {
                    this.renderFoodSpoilageReport();
                }
            } else {
                console.error('Failed to load food spoilage data:', result.error);
            }
        } catch (error) {
            console.error('Error loading food spoilage data with filter:', error);
        }
    }

    async loadSensorDataWithFilter(page = 1, limit = 25, autoRender = false) {
        try {
            // Get session token for authentication
            const sessionToken = localStorage.getItem('jwt_token') || 
                                 localStorage.getItem('sessionToken') || 
                                 localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('No session token found');
                return;
            }

            // Build query parameters for filtering
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });

            // Add date range filtering
            if (this.currentDateRange === 'custom' && this.customStartDate && this.customEndDate) {
                params.append('start_date', this.customStartDate);
                params.append('end_date', this.customEndDate);
            } else {
                // Add predefined date ranges
                const today = new Date();
                let startDate, endDate;
                
                switch (this.currentDateRange) {
                    case 'daily':
                        startDate = new Date(today);
                        endDate = new Date(today);
                        break;
                    case 'weekly':
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                        break;
                    case 'monthly':
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = new Date(today);
                        break;
                    case 'yearly':
                        startDate = new Date(today.getFullYear(), 0, 1);
                        endDate = new Date(today);
                        break;
                    default:
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                }
                
                params.append('start_date', startDate.toISOString().split('T')[0]);
                params.append('end_date', endDate.toISOString().split('T')[0]);
            }

            const response = await fetch(`/api/users/sensor-data-report?${params.toString()}`, {
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
                // Transform the data to match the expected format
                this.reportData['sensor-data'] = result.data.map(item => ({
                    sensorId: item['SENSOR ID'],
                    location: item['LOCATION'],
                    sensorType: item['SENSOR TYPE'],
                    currentValue: item['CURRENT VALUE'],
                    status: item['STATUS'],
                    lastUpdate: item['LAST UPDATE']
                }));
                
                // Update pagination info
                if (result.pagination) {
                    this.currentPage = result.pagination.current_page;
                    this.totalPages = result.pagination.total_pages;
                    this.totalRecords = result.pagination.total_records;
                    this.recordsPerPage = result.pagination.records_per_page;
                }
                
                console.log('Sensor data loaded with filter:', this.reportData['sensor-data']);
                console.log('Pagination info:', result.pagination);
                console.log('Date range:', this.currentDateRange);
                
                // Only render if autoRender is true (for pagination navigation)
                if (autoRender && this.currentReportType === 'sensor-data') {
                    this.renderSensorDataReport();
                }
            } else {
                console.error('Failed to load sensor data:', result.error);
            }
        } catch (error) {
            console.error('Error loading sensor data with filter:', error);
        }
    }

    async loadAlertSummaryDataWithFilter(page = 1, limit = 25, autoRender = false) {
        try {
            // Get session token for authentication
            const sessionToken = localStorage.getItem('jwt_token') || 
                                 localStorage.getItem('sessionToken') || 
                                 localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('No session token found');
                return;
            }

            // Build query parameters for filtering
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });

            // Add date range filtering
            if (this.currentDateRange === 'custom' && this.customStartDate && this.customEndDate) {
                params.append('start_date', this.customStartDate);
                params.append('end_date', this.customEndDate);
            } else {
                // Add predefined date ranges
                const today = new Date();
                let startDate, endDate;
                
                switch (this.currentDateRange) {
                    case 'daily':
                        startDate = new Date(today);
                        endDate = new Date(today);
                        break;
                    case 'weekly':
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                        break;
                    case 'monthly':
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = new Date(today);
                        break;
                    case 'yearly':
                        startDate = new Date(today.getFullYear(), 0, 1);
                        endDate = new Date(today);
                        break;
                    default:
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = new Date(today);
                }
                
                params.append('start_date', startDate.toISOString().split('T')[0]);
                params.append('end_date', endDate.toISOString().split('T')[0]);
            }

            const response = await fetch(`/api/users/alert-summary-report?${params.toString()}`, {
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
                // Transform the data to match the expected format
                this.reportData['alert-summary'] = result.data.map(item => ({
                    alertId: item['ALERT ID'],
                    alertType: item['ALERT TYPE'],
                    severity: item['SEVERITY'],
                    location: item['LOCATION'],
                    message: item['MESSAGE'],
                    timestamp: item['TIMESTAMP'],
                    status: item['STATUS']
                }));
                
                // Update pagination info
                if (result.pagination) {
                    this.currentPage = result.pagination.current_page;
                    this.totalPages = result.pagination.total_pages;
                    this.totalRecords = result.pagination.total_records;
                    this.recordsPerPage = result.pagination.records_per_page;
                }
                
                console.log('Alert summary data loaded with filter:', this.reportData['alert-summary']);
                console.log('Pagination info:', result.pagination);
                console.log('Date range:', this.currentDateRange);
                
                // Only render if autoRender is true (for pagination navigation)
                if (autoRender && this.currentReportType === 'alert-summary') {
                    this.renderAlertSummaryReport();
                }
            } else {
                console.error('Failed to load alert summary data:', result.error);
            }
        } catch (error) {
            console.error('Error loading alert summary data with filter:', error);
        }
    }

    renderPagination() {
        const paginationContainer = document.getElementById('reportPagination');
        if (!paginationContainer || (this.currentReportType !== 'user-activity' && this.currentReportType !== 'food-spoilage' && this.currentReportType !== 'sensor-data' && this.currentReportType !== 'alert-summary')) return;
        
        if (this.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        console.log('Rendering pagination - currentPage:', this.currentPage, 'totalPages:', this.totalPages);
        
        let paginationHTML = `
            <div class="pagination-info">
                Showing ${((this.currentPage - 1) * this.recordsPerPage) + 1} to ${Math.min(this.currentPage * this.recordsPerPage, this.totalRecords)} of ${this.totalRecords} records
            </div>
            <div class="pagination-controls">
        `;
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage - 1}">Previous</button>`;
        }
        
        // Page numbers - simple range like user log
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);
        
        console.log('Page range:', startPage, 'to', endPage);
        
        for (let i = startPage; i <= endPage; i++) {
            if (i === this.currentPage) {
                paginationHTML += `<span class="pagination-current">${i}</span>`;
            } else {
                paginationHTML += `<button class="pagination-btn" data-page="${i}">${i}</button>`;
            }
        }
        
        // Next button
        if (this.currentPage < this.totalPages) {
            paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage + 1}">Next</button>`;
        }
        
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
        
        console.log('Pagination HTML rendered');
        
        // Add event listeners to pagination buttons
        this.addPaginationEventListeners();
    }

    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            if (this.currentReportType === 'user-activity') {
                this.loadActivityLogDataWithFilter(page, this.recordsPerPage, true);
            } else if (this.currentReportType === 'food-spoilage') {
                this.loadFoodSpoilageDataWithFilter(page, this.recordsPerPage, true);
            } else if (this.currentReportType === 'sensor-data') {
                this.loadSensorDataWithFilter(page, this.recordsPerPage, true);
            } else if (this.currentReportType === 'alert-summary') {
                this.loadAlertSummaryDataWithFilter(page, this.recordsPerPage, true);
            }
        }
    }

    changeRecordsPerPage(newLimit) {
        console.log('changeRecordsPerPage called with:', newLimit);
        this.recordsPerPage = parseInt(newLimit);
        this.currentPage = 1; // Reset to first page
        console.log('Updated recordsPerPage:', this.recordsPerPage, 'currentPage:', this.currentPage);
        
        // Only reload if we're on activity log, food spoilage, sensor data, or alert summary and have data
        if (this.currentReportType === 'user-activity' && this.reportData['user-activity'] && this.reportData['user-activity'].length > 0) {
            this.loadActivityLogDataWithFilter(1, this.recordsPerPage, true);
        } else if (this.currentReportType === 'food-spoilage' && this.reportData['food-spoilage'] && this.reportData['food-spoilage'].length > 0) {
            this.loadFoodSpoilageDataWithFilter(1, this.recordsPerPage, true);
        } else if (this.currentReportType === 'sensor-data' && this.reportData['sensor-data'] && this.reportData['sensor-data'].length > 0) {
            this.loadSensorDataWithFilter(1, this.recordsPerPage, true);
        } else if (this.currentReportType === 'alert-summary' && this.reportData['alert-summary'] && this.reportData['alert-summary'].length > 0) {
            this.loadAlertSummaryDataWithFilter(1, this.recordsPerPage, true);
        } else {
            console.log('Not reloading - either not activity log/food spoilage/sensor data/alert summary or no data loaded yet');
        }
    }

    renderActivityLogReport() {
        const tableBody = document.getElementById('reportTableBody');
        const tableHead = document.querySelector('.report-table thead tr');
        if (!tableBody || !tableHead) return;

        // Clear existing table data
        tableBody.innerHTML = '';

        // Update table headers
        this.updateTableHeaders(tableHead);

        // Get activity log data
        const data = this.reportData['user-activity'] || [];

        // Populate table
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = this.generateTableRow(item);
            tableBody.appendChild(row);
        });

        // Update report title
        this.updateReportTitle(data.length);

        // Render pagination
        this.renderPagination();

        // Show success notification
        this.showNotification('Activity log report generated successfully!', 'success');
    }

    renderFoodSpoilageReport() {
        const tableBody = document.getElementById('reportTableBody');
        const tableHead = document.querySelector('.report-table thead tr');
        if (!tableBody || !tableHead) return;

        // Clear existing table data
        tableBody.innerHTML = '';

        // Update table headers
        this.updateTableHeaders(tableHead);

        // Get food spoilage data
        const data = this.reportData['food-spoilage'] || [];

        // Populate table
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = this.generateTableRow(item);
            tableBody.appendChild(row);
        });

        // Update report title
        this.updateReportTitle(data.length);

        // Render pagination
        this.renderPagination();

        // Show success notification
        this.showNotification('Food spoilage report generated successfully!', 'success');
    }

    renderSensorDataReport() {
        const tableBody = document.getElementById('reportTableBody');
        const tableHead = document.querySelector('.report-table thead tr');
        if (!tableBody || !tableHead) return;

        // Clear existing table data
        tableBody.innerHTML = '';

        // Update table headers
        this.updateTableHeaders(tableHead);

        // Get sensor data
        const data = this.reportData['sensor-data'] || [];

        // Populate table
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = this.generateTableRow(item);
            tableBody.appendChild(row);
        });

        // Update report title
        this.updateReportTitle(data.length);

        // Render pagination
        this.renderPagination();

        // Show success notification
        this.showNotification('Sensor data report generated successfully!', 'success');
    }

    renderAlertSummaryReport() {
        const tableBody = document.getElementById('reportTableBody');
        const tableHead = document.querySelector('.report-table thead tr');
        if (!tableBody || !tableHead) return;

        // Clear existing table data
        tableBody.innerHTML = '';

        // Update table headers
        this.updateTableHeaders(tableHead);

        // Get alert summary data
        const data = this.reportData['alert-summary'] || [];

        // Populate table
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = this.generateTableRow(item);
            tableBody.appendChild(row);
        });

        // Update report title
        this.updateReportTitle(data.length);

        // Render pagination
        this.renderPagination();

        // Show success notification
        this.showNotification('Alert summary report generated successfully!', 'success');
    }

    togglePaginationControls() {
        const recordsPerPageGroup = document.getElementById('recordsPerPageGroup');
        const paginationContainer = document.getElementById('reportPagination');
        
        console.log('togglePaginationControls - currentReportType:', this.currentReportType);
        
        if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'sensor-data' || this.currentReportType === 'alert-summary') {
            if (recordsPerPageGroup) {
                recordsPerPageGroup.style.display = 'block';
                console.log('Showing records per page group');
            }
            if (paginationContainer) {
                paginationContainer.style.display = 'block';
                console.log('Showing pagination container');
            }
        } else {
            if (recordsPerPageGroup) {
                recordsPerPageGroup.style.display = 'none';
                console.log('Hiding records per page group');
            }
            if (paginationContainer) {
                paginationContainer.style.display = 'none';
                console.log('Hiding pagination container');
            }
        }
    }

    // Test method for debugging records per page
    testRecordsPerPage() {
        console.log('Testing records per page functionality...');
        console.log('Current report type:', this.currentReportType);
        console.log('Current records per page:', this.recordsPerPage);
        console.log('Current page:', this.currentPage);
        
        const recordsPerPageSelect = document.getElementById('recordsPerPage');
        if (recordsPerPageSelect) {
            console.log('Records per page select found, current value:', recordsPerPageSelect.value);
            console.log('Records per page select visible:', recordsPerPageSelect.offsetParent !== null);
        } else {
            console.error('Records per page select not found!');
        }
        
        const recordsPerPageGroup = document.getElementById('recordsPerPageGroup');
        if (recordsPerPageGroup) {
            console.log('Records per page group found, display:', recordsPerPageGroup.style.display);
        } else {
            console.error('Records per page group not found!');
        }
    }

    // Test method for debugging pagination
    testPagination() {
        console.log('Testing pagination functionality...');
        console.log('Current page:', this.currentPage);
        console.log('Total pages:', this.totalPages);
        console.log('Total records:', this.totalRecords);
        console.log('Records per page:', this.recordsPerPage);
        
        const paginationContainer = document.getElementById('reportPagination');
        if (paginationContainer) {
            console.log('Pagination container found, display:', paginationContainer.style.display);
            console.log('Pagination container HTML:', paginationContainer.innerHTML);
            
            const buttons = paginationContainer.querySelectorAll('.pagination-btn');
            console.log('Found pagination buttons:', buttons.length);
            buttons.forEach((btn, index) => {
                console.log(`Button ${index}:`, btn.textContent.trim(), 'data-page:', btn.dataset.page);
            });
        } else {
            console.error('Pagination container not found!');
        }
        
        // Test global function
        console.log('Global goToReportPage function:', typeof window.goToReportPage);
        if (typeof window.goToReportPage === 'function') {
            console.log('goToReportPage function is available');
        } else {
            console.error('goToReportPage function is NOT available');
        }
    }

    addPaginationEventListeners() {
        const paginationContainer = document.getElementById('reportPagination');
        if (!paginationContainer) return;
        
        const buttons = paginationContainer.querySelectorAll('.pagination-btn');
        console.log('Adding event listeners to', buttons.length, 'pagination buttons');
        
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                console.log('Pagination button clicked, page:', page);
                if (page && page >= 1 && page <= this.totalPages) {
                    this.goToPage(page);
                }
            });
        });
    }

    loadReportData() {
        // Initialize empty data structure - will be populated from API
        this.reportData = {
            'user-activity': [], // Will be populated from API
            'food-spoilage': [], // Will be populated from API
            'sensor-data': [], // Will be populated from API when implemented
            'alert-summary': [] // Will be populated from API when implemented
        };
    }

    showEmptyState() {
        const tableBody = document.getElementById('reportTableBody');
        const tableHead = document.querySelector('.report-table thead tr');
        const reportTitle = document.getElementById('reportTitle');
        
        if (!tableBody || !tableHead || !reportTitle) return;

        // Update headers based on current report type
        this.updateTableHeaders(tableHead);

        // Get the number of columns for the current report type
        const columnCounts = {
            'user-activity': 5,
            'food-spoilage': 6,
            'sensor-data': 6,
            'alert-summary': 7
        };
        const columnCount = columnCounts[this.currentReportType] || 5;

        // Clear table and show empty state
        tableBody.innerHTML = `
            <tr>
                <td colspan="${columnCount}" class="empty-state">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">📊</div>
                        <div class="empty-state-title">No Report Generated</div>
                        <div class="empty-state-desc">Select your report type and date range, then click "Generate Report" to view data.</div>
                    </div>
                </td>
            </tr>
        `;

        // Update title
        reportTitle.textContent = 'Report Generator';
    }

    generateReport() {
        if (this.currentReportType === 'user-activity') {
            // For activity logs, load data with current pagination and date filtering when generate is clicked
            this.loadActivityLogDataWithFilter(this.currentPage, this.recordsPerPage, false).then(() => {
                // After loading data, render the report
                this.renderActivityLogReport();
            });
        } else if (this.currentReportType === 'food-spoilage') {
            // For food spoilage, load data with current pagination and date filtering when generate is clicked
            this.loadFoodSpoilageDataWithFilter(this.currentPage, this.recordsPerPage, false).then(() => {
                // After loading data, render the report
                this.renderFoodSpoilageReport();
            });
        } else if (this.currentReportType === 'sensor-data') {
            // For sensor data, load data with current pagination and date filtering when generate is clicked
            this.loadSensorDataWithFilter(this.currentPage, this.recordsPerPage, false).then(() => {
                // After loading data, render the report
                this.renderSensorDataReport();
            });
        } else if (this.currentReportType === 'alert-summary') {
            // For alert summary, load data with current pagination and date filtering when generate is clicked
            this.loadAlertSummaryDataWithFilter(this.currentPage, this.recordsPerPage, false).then(() => {
                // After loading data, render the report
                this.renderAlertSummaryReport();
            });
        } else {
            // For reports that don't have API endpoints yet, show a message
            const tableBody = document.getElementById('reportTableBody');
            const tableHead = document.querySelector('.report-table thead tr');
            if (!tableBody || !tableHead) return;

            // Clear existing table data
            tableBody.innerHTML = '';

            // Update table headers based on report type
            this.updateTableHeaders(tableHead);

            // Show message that this report type is not yet implemented
            const columnCounts = {
                'sensor-data': 6,
                'alert-summary': 7
            };
            const columnCount = columnCounts[this.currentReportType] || 5;

            tableBody.innerHTML = `
                <tr>
                    <td colspan="${columnCount}" class="empty-state">
                        <div class="empty-state-content">
                            <div class="empty-state-icon">🚧</div>
                            <div class="empty-state-title">Report Type Not Yet Implemented</div>
                            <div class="empty-state-desc">This report type is currently under development. Please use User Activity or Food Spoilage reports for now.</div>
                        </div>
                    </td>
                </tr>
            `;

            // Update title
            const reportTitle = document.getElementById('reportTitle');
            if (reportTitle) {
                reportTitle.textContent = `${this.getReportTypeText()} - Coming Soon`;
            }

            // Show notification
            this.showNotification('This report type is not yet implemented. Use User Activity or Food Spoilage reports.', 'info');
        }
    }

    updateTableHeaders(tableHead) {
        const headers = {
            'user-activity': ['LOG ID', 'ACTION', 'TIMESTAMP'],
            'food-spoilage': ['FOOD ITEM', 'CATEGORY', 'STATUS', 'RISK SCORE', 'EXPIRY DATE', 'SENSOR READINGS'],
            'sensor-data': ['SENSOR ID', 'LOCATION', 'SENSOR TYPE', 'CURRENT VALUE', 'STATUS', 'LAST UPDATE'],
            'alert-summary': ['ALERT ID', 'ALERT TYPE', 'SEVERITY', 'LOCATION', 'MESSAGE', 'TIMESTAMP', 'STATUS']
        };

        const headerRow = headers[this.currentReportType] || [];
        tableHead.innerHTML = headerRow.map(header => `<th>${header}</th>`).join('');
    }

    generateTableRow(item) {
        switch (this.currentReportType) {
            case 'user-activity':
                return `
                    <td>${item.logId || ''}</td>
                    <td><span class="action-badge">${item.action || ''}</span></td>
                    <td>${item.timestamp || ''}</td>
                `;
            case 'food-spoilage':
                return `
                    <td>${item.foodItem}</td>
                    <td>${item.category}</td>
                    <td><span class="status-badge ${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span></td>
                    <td>${item.riskScore}</td>
                    <td>${item.expiryDate}</td>
                    <td>${item.sensorReadings}</td>
                `;
            case 'sensor-data':
                return `
                    <td>${item.sensorId}</td>
                    <td>${item.location}</td>
                    <td>${item.sensorType}</td>
                    <td>${item.currentValue}</td>
                    <td><span class="status-badge ${item.status.toLowerCase()}">${item.status}</span></td>
                    <td>${item.lastUpdate}</td>
                `;
            case 'alert-summary':
                return `
                    <td>${item.alertId}</td>
                    <td>${item.alertType}</td>
                    <td><span class="severity-badge ${item.severity.toLowerCase()}">${item.severity}</span></td>
                    <td>${item.location}</td>
                    <td>${item.message}</td>
                    <td>${item.timestamp}</td>
                    <td><span class="status-badge ${item.status.toLowerCase()}">${item.status}</span></td>
                `;
            default:
                return '';
        }
    }

    filterData(data) {
        let filtered = [...data];

        // Filter by date range
        const today = new Date();
        const currentDate = new Date();

        if (this.currentDateRange === 'custom' && this.customStartDate && this.customEndDate) {
            const start = new Date(this.customStartDate);
            const end = new Date(this.customEndDate);
            filtered = filtered.filter(item => {
                const itemDate = this.getDateFromItem(item);
                return itemDate && itemDate >= start && itemDate <= end;
            });
            return filtered;
        }

        switch (this.currentDateRange) {
            case 'daily':
                filtered = filtered.filter(item => {
                    const itemDate = this.getDateFromItem(item);
                    return itemDate && itemDate.toDateString() === today.toDateString();
                });
                break;
            case 'weekly':
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                filtered = filtered.filter(item => {
                    const itemDate = this.getDateFromItem(item);
                    return itemDate && itemDate >= weekAgo;
                });
                break;
            case 'monthly':
                const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                filtered = filtered.filter(item => {
                    const itemDate = this.getDateFromItem(item);
                    return itemDate && itemDate >= monthAgo;
                });
                break;
            case 'yearly':
                const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
                filtered = filtered.filter(item => {
                    const itemDate = this.getDateFromItem(item);
                    return itemDate && itemDate >= yearAgo;
                });
                break;
        }

        return filtered;
    }

    getDateFromItem(item) {
        // Extract date from different item types
        const dateField = item.lastActivity || item.timestamp || item.lastUpdate || item.expiryDate;
        
        // For user-activity, use the timestamp field
        if (this.currentReportType === 'user-activity') {
            return item.timestamp ? new Date(item.timestamp) : null;
        }
        if (dateField) {
            return new Date(dateField);
        }
        return null;
    }

    updateReportTitle(count) {
        const reportTitle = document.getElementById('reportTitle');
        if (reportTitle) {
            const reportTypeText = this.getReportTypeText();
            reportTitle.textContent = `${reportTypeText} (${count} items)`;
        }
    }

    getReportTypeText() {
        const reportTypes = {
            'user-activity': 'User Activity',
            'food-spoilage': 'Food Spoilage',
            'sensor-data': 'Sensor Data',
            'alert-summary': 'Alert Summary'
        };
        return reportTypes[this.currentReportType] || 'Report';
    }

    downloadExcel() {
        let data = this.reportData[this.currentReportType] || [];
        let filteredData = [];
        
        // For API-based reports, use the data directly
        if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'sensor-data' || this.currentReportType === 'alert-summary') {
            filteredData = data;
        } else {
            // For mock data, apply filtering
            filteredData = this.filterData(data);
        }
        
        if (filteredData.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }

        // Create CSV content
        let csvContent = 'data:text/csv;charset=utf-8,';
        
        // Add headers based on report type
        const headers = this.getCSVHeaders();
        csvContent += headers.join(',') + '\n';
        
        // Add data rows
        filteredData.forEach(item => {
            const row = this.getCSVRow(item);
            csvContent += row.join(',') + '\n';
        });

        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${this.currentReportType}-${this.currentDateRange}-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Excel file downloaded successfully!', 'success');
    }

    getCSVHeaders() {
        const headers = {
            'user-activity': ['Log ID', 'Action', 'Timestamp'],
            'food-spoilage': ['Food Item', 'Category', 'Status', 'Risk Score', 'Expiry Date', 'Sensor Readings'],
            'sensor-data': ['Sensor ID', 'Location', 'Sensor Type', 'Current Value', 'Status', 'Last Update'],
            'alert-summary': ['Alert ID', 'Alert Type', 'Severity', 'Location', 'Message', 'Timestamp', 'Status']
        };
        return headers[this.currentReportType] || [];
    }

    getCSVRow(item) {
        switch (this.currentReportType) {
            case 'user-activity':
                return [
                    `"${item.logId}"`,
                    `"${item.action}"`,
                    `"${item.timestamp}"`
                ];
            case 'food-spoilage':
                return [
                    `"${item.foodItem}"`,
                    `"${item.category}"`,
                    `"${item.status}"`,
                    `"${item.riskScore}"`,
                    `"${item.expiryDate}"`,
                    `"${item.sensorReadings}"`
                ];
            case 'sensor-data':
                return [
                    `"${item.sensorId}"`,
                    `"${item.location}"`,
                    `"${item.sensorType}"`,
                    `"${item.currentValue}"`,
                    `"${item.status}"`,
                    `"${item.lastUpdate}"`
                ];
            case 'alert-summary':
                return [
                    `"${item.alertId}"`,
                    `"${item.alertType}"`,
                    `"${item.severity}"`,
                    `"${item.location}"`,
                    `"${item.message}"`,
                    `"${item.timestamp}"`,
                    `"${item.status}"`
                ];
            default:
                return [];
        }
    }

    downloadPDF() {
        let data = this.reportData[this.currentReportType] || [];
        let filteredData = [];
        
        // For API-based reports, use the data directly
        if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'sensor-data' || this.currentReportType === 'alert-summary') {
            filteredData = data;
        } else {
            // For mock data, apply filtering
            filteredData = this.filterData(data);
        }
        
        if (filteredData.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }

        // For a real implementation, you would use a library like jsPDF
        // For now, we'll show a notification
        this.showNotification('PDF download feature requires jsPDF library. CSV download is available.', 'info');
        
        // Alternative: Open print dialog
        setTimeout(() => {
            window.print();
        }, 1000);
    }

    showNotification(message, type = 'info') {
        // Create notification element
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

        // Set background color based on type
        const colors = {
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        notification.textContent = message;

        // Add to page
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Method to add custom CSS for notifications
    addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            .pagination-ellipsis {
                padding: 8px 4px;
                color: #666;
                font-weight: bold;
                user-select: none;
            }
            
            .pagination-current {
                padding: 8px 12px;
                background: #007bff;
                color: white;
                border: 1px solid #007bff;
                border-radius: 4px;
                font-weight: bold;
                margin: 0 4px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize report generator when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the report generator page
    const reportGeneratorMain = document.querySelector('.report-generator-main');
    if (reportGeneratorMain) {
        window.reportGenerator = new ReportGenerator();
        window.reportGenerator.addNotificationStyles();
        
        // Add test method to window for debugging
        window.testRecordsPerPage = () => {
            if (window.reportGenerator) {
                window.reportGenerator.testRecordsPerPage();
            } else {
                console.error('Report generator not initialized');
            }
        };
        
        // Add pagination test method to window for debugging
        window.testPagination = () => {
            if (window.reportGenerator) {
                window.reportGenerator.testPagination();
            } else {
                console.error('Report generator not initialized');
            }
        };
        
        // Global function for pagination (accessible from HTML)
        window.goToReportPage = function(page) {
            console.log('goToReportPage called with page:', page);
            if (window.reportGenerator) {
                window.reportGenerator.goToPage(page);
            } else {
                console.error('Report generator not available');
            }
        };
    }
});

// Export for use in SPA
if (typeof window !== 'undefined') {
    window.ReportGenerator = ReportGenerator;
    
    // Global function for pagination (always available)
    window.goToReportPage = function(page) {
        console.log('goToReportPage called with page:', page);
        if (window.reportGenerator) {
            window.reportGenerator.goToPage(page);
        } else {
            console.error('Report generator not available');
        }
    };
} 