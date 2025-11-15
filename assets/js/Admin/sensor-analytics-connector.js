// Sensor Analytics Connector - Connects SensorAnalyticsAPI with Admin Dashboard

// Utility function to format timestamp to "10:51:25 AM" format
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;
  
  // Format date
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  // Format time as "10:51:25 AM"
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  return `${dateStr} ${timeStr}`;
}

class SensorAnalyticsConnector {
    constructor() {
        this.api = null;
        this.currentPage = 'analytics-summary';
        this.pagination = { page: 1, limit: 25, total: 0 };
        this.init();
    }

    async init() {
        try {
            // Initialize the API
            this.api = new SensorAnalyticsAPI();
            
            // Wait for API to initialize
            await this.api.initializeData();
            
            // Set up event listeners
        this.setupEventListeners();
            
            // Load initial data
            await this.loadAnalyticsData();
            
            console.log('Sensor Analytics Connector initialized successfully');
        } catch (error) {
            console.error('Error initializing Sensor Analytics Connector:', error);
        }
    }

    setupEventListeners() {
        // Page navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('.spoilage-btn')) {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.switchPage(page);
            }
        });

        // Filter inputs (no auto-apply)
        // Name search will be used only when Filter is clicked

        // Date range filter
        const dateRange = document.getElementById('dateRange');
        if (dateRange) {
            dateRange.addEventListener('change', async (e) => {
                await this.handleDateRangeChange(e.target.value);
            });
        }

        // Week picker
        const weekPicker = document.getElementById('analyticsWeekPicker');
        // Do not auto-apply on week change

        // Month picker
        const monthPicker = document.getElementById('analyticsMonthPicker');
        // Do not auto-apply on month change

        // Year picker
        const yearPicker = document.getElementById('analyticsYearPicker');
        // Do not auto-apply on year change

        // Custom date inputs
        const startDate = document.getElementById('startDate');
        // Do not auto-apply on custom start date

        const endDate = document.getElementById('endDate');
        // Do not auto-apply on custom end date

        const testerType = document.getElementById('testerType');
        // Do not auto-apply on tester type change

        const sensorType = document.getElementById('sensorType');
        // sensorType removed

        const foodType = document.getElementById('foodType');
        // foodType removed

        const status = document.getElementById('status');
        // Do not auto-apply on status change

        // Records per page selector (optional if present in DOM)
        const rpp = document.getElementById('recordsPerPage');
        if (rpp) {
            this.pagination.limit = parseInt(rpp.value || '25', 10) || 25;
            rpp.addEventListener('change', async (e) => {
                const val = parseInt(e.target.value || '25', 10) || 25;
                this.pagination.page = 1;
                this.pagination.limit = val;
                await this.applyFilters();
            });
        }

        // Filter actions
        const applyFiltersBtn = document.getElementById('applyFilters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', async () => {
                await this.applyFilters();
            });
        }

        // Ensure handler works even if button is injected later (SPA)
        document.addEventListener('click', async (e) => {
            const btn = e.target && e.target.closest && e.target.closest('#applyFilters');
            if (btn) {
                e.preventDefault();
                await this.applyFilters();
            }
        });

        const exportCSV = document.getElementById('exportCSV');
        if (exportCSV) {
            exportCSV.addEventListener('click', () => {
                this.exportToCSV();
            });
        }

        const exportPDF = document.getElementById('exportPDF');
        if (exportPDF) {
            exportPDF.addEventListener('click', () => {
                this.exportToPDF();
            });
        }
    }

    async loadAnalyticsData() {
        try {
            if (this.currentPage === 'analytics-summary') {
                await this.loadSummaryData();
            } else if (this.currentPage === 'analytics-detail') {
                await this.loadDetailedData();
            }
        } catch (error) {
            console.error('Error loading analytics data:', error);
        }
    }

    async loadSummaryData() {
        try {
            // Ensure summary DOM is present before updating
            await this.waitForElement('.spoilage-stat-card, .spoilage-summary-list');
            const summaryData = await this.api.fetchSummaryData();
            if (summaryData && summaryData.summary) {
                this.updateSummaryDisplay(summaryData);
            }
        } catch (error) {
            console.error('Error loading summary data:', error);
        }
    }

    async loadDetailedData() {
        try {
            // Ensure detailed DOM is present before updating
            await this.waitForElement('#sensorTableBody');
            // Load filter options first
            await this.loadFilterOptions();
            
            // Then load detailed data
            const detailedData = await this.api.fetchDetailedData();
            if (detailedData) {
                // Store and render first page
                this.pagination.page = 1;
                this.pagination.total = Array.isArray(detailedData) ? detailedData.length : (detailedData?.length || 0);
                this.updateDetailedDisplay(detailedData);
            }
        } catch (error) {
            console.error('Error loading detailed data:', error);
        }
    }

    async loadFilterOptions() {
        try {
            const response = await fetch('/api/sensor-analytics/filter-options', {
                headers: {
                    'Authorization': `Bearer ${this.api.getAuthToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.populateFilterOptions(data.data);
                }
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    populateFilterOptions(data) {
        // Populate tester type options
        const testerTypeSelect = document.getElementById('testerType');
        if (testerTypeSelect && data.testerTypes) {
            // Keep the "All Types" option
            const allOption = testerTypeSelect.querySelector('option[value="all"]');
            testerTypeSelect.innerHTML = '';
            if (allOption) testerTypeSelect.appendChild(allOption);
            
            // Add dynamic options
            data.testerTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.label;
                testerTypeSelect.appendChild(option);
            });
        }

        // Populate sensor type options
        const sensorTypeSelect = document.getElementById('sensorType');
        if (sensorTypeSelect && data.sensorTypes) {
            // Keep the "All Types" option
            const allOption = sensorTypeSelect.querySelector('option[value="all"]');
            sensorTypeSelect.innerHTML = '';
            if (allOption) sensorTypeSelect.appendChild(allOption);
            
            // Add dynamic options
            data.sensorTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.label;
                sensorTypeSelect.appendChild(option);
            });
        }

        // Populate food type options from ML prediction data
        this.populateFoodTypeOptions();
    }

    async populateFoodTypeOptions() {
        try {
            const foodTypeSelect = document.getElementById('foodType');
            if (!foodTypeSelect) return;

            // Keep the "All Food Types" option
            const allOption = foodTypeSelect.querySelector('option[value="all"]');
            foodTypeSelect.innerHTML = '';
            if (allOption) foodTypeSelect.appendChild(allOption);

            // Fetch unique food types from ML prediction data
            const response = await fetch('/api/ml/food-types', {
                headers: {
                    'Authorization': `Bearer ${this.api.getAuthToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.foodTypes)) {
                    // Add unique food types from ML prediction data
                    data.foodTypes.forEach(foodType => {
                        const option = document.createElement('option');
                        option.value = foodType.food_name;
                        option.textContent = `${foodType.food_name} (${foodType.food_category})`;
                        option.dataset.category = foodType.food_category;
                        foodTypeSelect.appendChild(option);
                    });
                }
            } else {
                console.warn('Failed to fetch food types from ML prediction data');
                // Fallback to static options if API fails
                this.addFallbackFoodTypes(foodTypeSelect);
            }
        } catch (error) {
            console.error('Error populating food type options:', error);
            // Fallback to static options if API fails
            const foodTypeSelect = document.getElementById('foodType');
            if (foodTypeSelect) {
                this.addFallbackFoodTypes(foodTypeSelect);
            }
        }
    }

    addFallbackFoodTypes(foodTypeSelect) {
        // Add fallback food types if API fails
        const fallbackTypes = [
            { name: 'Tomato', category: 'Vegetables' },
            { name: 'Apple', category: 'Fruits' },
            { name: 'Banana', category: 'Fruits' },
            { name: 'Chicken', category: 'Meat' },
            { name: 'Fish', category: 'Seafood' },
            { name: 'Milk', category: 'Dairy' }
        ];

        fallbackTypes.forEach(foodType => {
            const option = document.createElement('option');
            option.value = foodType.name;
            option.textContent = `${foodType.name} (${foodType.category})`;
            option.dataset.category = foodType.category;
            foodTypeSelect.appendChild(option);
        });
    }

    updateSummaryDisplay(data) {
        // Update summary statistics
        const totalSensors = document.querySelector('.spoilage-stat-card:nth-child(1) .stat-value');
        if (totalSensors) {
            totalSensors.textContent = data.summary.totalSensors || 0;
        }

        const activeTesters = document.querySelector('.spoilage-stat-card:nth-child(2) .stat-value');
        if (activeTesters) {
            activeTesters.textContent = data.summary.activeTesters || 0;
        }

        const spoilageAlerts = document.querySelector('.spoilage-stat-card:nth-child(3) .stat-value');
        if (spoilageAlerts) {
            spoilageAlerts.textContent = data.summary.spoilageAlerts || 0;
        }

        const inactiveUsers = document.querySelector('.spoilage-stat-card:nth-child(4) .stat-value');
        if (inactiveUsers) {
            inactiveUsers.textContent = data.summary.inactiveUsers || 0;
        }

        // Update sensor usage by tester type
        if (data.testerTypes && data.testerTypes.length > 0) {
            this.updateTesterTypeBreakdown(data.testerTypes);
        }

        // Update sensor activity summary
        if (data.sensorTypes && data.sensorTypes.length > 0) {
            this.updateSensorActivitySummary(data.sensorTypes);
        }
    }

    updateTesterTypeBreakdown(testerTypes) {
        const barList = document.querySelector('.spoilage-bar-list');
        if (!barList) return;

        // Clear existing content
        barList.innerHTML = '';

        // Add new content based on data
        testerTypes.forEach(testerType => {
            const percentage = testerType.activePercentage || 0;
            const barRow = document.createElement('div');
            barRow.className = 'spoilage-bar-row';
            barRow.innerHTML = `
                <span class="bar-label">${testerType.testerType}</span>
                <div class="bar-bg">
                    <div class="bar-fill ${percentage > 50 ? 'bar-red' : ''}" style="width:${percentage}%"></div>
                </div>
                <span class="bar-value">${percentage}%</span>
            `;
            barList.appendChild(barRow);
        });
    }

    updateSensorActivitySummary(sensorTypes) {
        const summaryList = document.querySelector('.spoilage-summary-list');
        if (!summaryList) return;

        // Clear existing content
        summaryList.innerHTML = '';

        // Add new content based on data - using the updated structure
        sensorTypes.forEach(sensorType => {
            const summaryRow = document.createElement('div');
            summaryRow.className = 'summary-row';
            summaryRow.innerHTML = `
                <span class="summary-label">${sensorType.sensorType} Sensors</span>
                <span class="summary-desc">${sensorType.activeUsers} food testers actively using</span>
                <span class="summary-rate ${sensorType.activePercentage > 80 ? 'bar-red' : ''}">${sensorType.activePercentage}%</span>
            `;
            summaryList.appendChild(summaryRow);
        });

        // Update total overview
        const totalOverview = document.querySelector('.summary-total-right');
        if (totalOverview) {
            const totalActive = sensorTypes.reduce((sum, type) => sum + (type.activeUsers || 0), 0);
            totalOverview.textContent = `${totalActive} food testers actively using sensors`;
        }
    }

    updateDetailedDisplay(data) {
        // Update sensor count
        const sensorCount = document.getElementById('sensorCount');
        if (sensorCount) {
            sensorCount.textContent = data.length || 0;
        }

        // Update table body
        const tableBody = document.getElementById('sensorTableBody');
        if (!tableBody) return;

        // Clear existing content
        tableBody.innerHTML = '';

        // Empty state: show the container with an empty message; hide pagination
        if (!data || data.length === 0) {
            const tableCard = document.querySelector('.detailed-report-table-card');
            if (tableCard) tableCard.style.display = '';
            const paginationWrap = document.getElementById('analyticsPagination');
            if (paginationWrap) paginationWrap.style.display = 'none';
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 0;color:#bfc9da;">
                            <div style="font-size:46px;line-height:1;opacity:0.8;">📊</div>
                            <div class="empty-state-title">No Data Available</div>
                            <div class="empty-state-desc">No matching records for the selected filters.</div>
                        </div>
                    </td>
                </tr>
            `;
            // Update pagination total and controls
            this.pagination.total = 0;
            this.renderPagination();
            return;
        } else {
            const tableCard = document.querySelector('.detailed-report-table-card');
            if (tableCard) tableCard.style.display = '';
            const paginationWrap = document.getElementById('analyticsPagination');
            if (paginationWrap) paginationWrap.style.display = '';
        }

        // Update pagination total
        this.pagination.total = data.length;

        // Determine current slice
        const currentPage = this.pagination.page || 1;
        const limit = this.pagination.limit || 25;
        const startIdx = (currentPage - 1) * limit;
        const endIdx = Math.min(startIdx + limit, data.length);
        const pageItems = data.slice(startIdx, endIdx);

        // Add new rows based on paged data
        pageItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Format last ping time
            const lastPing = item.lastPing ? new Date(item.lastPing) : null;
            const timeAgo = lastPing ? this.getTimeAgo(lastPing) : 'No activity yet';
            const pingClass = this.getPingClass(lastPing);
            
            // Status is derived from reading presence: Active if has reading, else Inactive
            const hasReading = !!(item.lastReading && /[0-9]/.test(String(item.lastReading)));
            const statusText = hasReading ? 'Active' : 'Inactive';
            let statusModifier = statusText.toLowerCase(); // active | inactive
            
        row.innerHTML = `
            <td><strong>${item.foodTester}</strong><br><span class="created-date">Registered: ${this.formatDate(item.registeredDate)}</span></td>
            <td><span class="cat-badge">${item.type}</span></td>
            <td><span class="status-badge status-${statusModifier}">${statusText}</span></td>
                <td>${this.formatDate(lastPing)}<br><span class="${pingClass}">${timeAgo}</span></td>
                <td>${item.lastReading || 'No data'}</td>
            `;
            
            tableBody.appendChild(row);
        });

        // Render pagination controls
        this.renderPagination();
    }

    async handleNameSearch(searchTerm) {
        try {
            const results = await this.api.handleNameSearch(searchTerm);
            this.updateDetailedDisplay(results);
        } catch (error) {
            console.error('Error handling name search:', error);
        }
    }

         async handleDateRangeChange(dateRange) {
         try {
             // Show/hide week picker
             const weekGroup = document.getElementById('analyticsWeekGroup');
             if (weekGroup) {
                 weekGroup.style.display = dateRange === 'weekly' ? 'flex' : 'none';
             }

             // Show/hide month picker
             const monthGroup = document.getElementById('analyticsMonthGroup');
             if (monthGroup) {
                 monthGroup.style.display = dateRange === 'monthly' ? 'flex' : 'none';
             }

             // Show/hide year picker
             const yearGroup = document.getElementById('analyticsYearGroup');
             if (yearGroup) {
                 yearGroup.style.display = dateRange === 'yearly' ? 'flex' : 'none';
             }

             // Show/hide custom date inputs
             const customDateGroup = document.getElementById('analyticsCustomDateGroup');
             if (customDateGroup) {
                 customDateGroup.style.display = dateRange === 'custom' ? 'flex' : 'none';
             }

             // Auto-apply filters for All Time, require Filter button for others
             if (dateRange === 'all') {
                 await this.applyFilters();
             }
         } catch (error) {
             console.error('Error handling date range change:', error);
         }
     }

    async applyFilters() {
        try {
            const filters = this.getCurrentFilters();
            console.log('Applying filters:', filters); // Debug log
            
            // Reset to first page when applying filters
            this.pagination.page = 1;
            const results = await this.api.fetchDetailedData(filters);
            console.log('Filter results:', results); // Debug log
            
            // Render with pagination
            this.updateDetailedDisplay(results || []);
        } catch (error) {
            console.error('Error applying filters:', error);
        }
    }

    renderPagination() {
        const info = document.getElementById('analyticsPageInfo');
        const controls = document.getElementById('analyticsPageControls');
        if (!info || !controls) return;

        const page = this.pagination.page || 1;
        const limit = this.pagination.limit || 25;
        const total = this.pagination.total || 0;

        if (total === 0) {
            info.textContent = 'No records';
            controls.innerHTML = '';
            return;
        }

        const start = (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);
        info.textContent = `Showing ${start} to ${end} of ${total} records`;

        const totalPages = Math.max(1, Math.ceil(total / limit));
        const makeBtn = (label, targetPage, disabled=false, active=false) => {
            const btn = document.createElement('button');
            btn.className = 'pagination-btn' + (active ? ' active' : '');
            btn.textContent = label;
            btn.disabled = disabled;
            btn.onclick = async () => {
                if (targetPage === page) return;
                this.pagination.page = targetPage;
                // Re-render current data slice; re-run applyFilters to respect server-side filtering
                await this.applyFilters();
            };
            return btn;
        };

        controls.innerHTML = '';
        // Only show Prev when a previous page exists
        if (page > 1) {
            controls.appendChild(makeBtn('‹ Prev', page - 1));
        }
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                controls.appendChild(makeBtn(String(i), i, false, i === page));
            } else if (i === page - 3 || i === page + 3) {
                const dots = document.createElement('span');
                dots.className = 'pagination-ellipsis';
                dots.textContent = '...';
                controls.appendChild(dots);
            }
        }
        // Only show Next when a next page exists
        if (page < totalPages) {
            controls.appendChild(makeBtn('Next ›', page + 1));
        }
    }

    getCurrentFilters() {
        const filters = {};
        
        const nameSearch = document.getElementById('nameSearch');
        if (nameSearch && nameSearch.value.trim()) {
            filters.nameSearch = nameSearch.value.trim();
        }
        
        const dateRange = document.getElementById('dateRange');
        if (dateRange && dateRange.value !== 'all') {
            filters.dateRange = dateRange.value;
            console.log('Date range selected:', dateRange.value); // Debug log
            
            if (dateRange.value === 'weekly') {
                const weekPicker = document.getElementById('analyticsWeekPicker');
                if (weekPicker && weekPicker.value) {
                    console.log('Week picker value:', weekPicker.value); // Debug log
                    const [year, week] = weekPicker.value.split('-W');
                    const startDate = this.getWeekStartDate(parseInt(year), parseInt(week));
                    const endDate = this.getWeekEndDate(parseInt(year), parseInt(week));
                    filters.startDate = startDate.toISOString().split('T')[0];
                    filters.endDate = endDate.toISOString().split('T')[0];
                    console.log('Weekly dates calculated:', filters.startDate, filters.endDate); // Debug log
                }
            } else if (dateRange.value === 'monthly') {
                const monthPicker = document.getElementById('analyticsMonthPicker');
                if (monthPicker && monthPicker.value) {
                    console.log('Month picker value:', monthPicker.value); // Debug log
                    const [year, month] = monthPicker.value.split('-');
                    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                    const endDate = new Date(parseInt(year), parseInt(month), 0);
                    filters.startDate = startDate.toISOString().split('T')[0];
                    filters.endDate = endDate.toISOString().split('T')[0];
                    console.log('Monthly dates calculated:', filters.startDate, filters.endDate); // Debug log
                }
            } else if (dateRange.value === 'yearly') {
                const yearPicker = document.getElementById('analyticsYearPicker');
                if (yearPicker && yearPicker.value) {
                    console.log('Year picker value:', yearPicker.value); // Debug log
                    const year = parseInt(yearPicker.value);
                    const startDate = new Date(year, 0, 1);
                    const endDate = new Date(year, 11, 31);
                    filters.startDate = startDate.toISOString().split('T')[0];
                    filters.endDate = endDate.toISOString().split('T')[0];
                    console.log('Yearly dates calculated:', filters.startDate, filters.endDate); // Debug log
                }
            } else if (dateRange.value === 'custom') {
                const startDate = document.getElementById('startDate');
                const endDate = document.getElementById('endDate');
                if (startDate && startDate.value) filters.startDate = startDate.value;
                if (endDate && endDate.value) filters.endDate = endDate.value;
                console.log('Custom dates:', filters.startDate, filters.endDate); // Debug log
            }
        }
        
        const testerType = document.getElementById('testerType');
        if (testerType && testerType.value !== 'all') {
            filters.testerType = testerType.value;
        }
        
        const sensorType = document.getElementById('sensorType');
        if (sensorType && sensorType.value !== 'all') {
            filters.sensorType = sensorType.value;
        }
        
        const foodType = document.getElementById('foodType');
        if (foodType && foodType.value !== 'all') {
            filters.foodType = foodType.value;
        }
        
        const status = document.getElementById('status');
        if (status && status.value !== 'all') {
            filters.status = status.value;
        }
        
        console.log('Final filters object:', filters); // Debug log
        return filters;
    }

    async handleFilterChange(filterType, value) {
        try {
            // Apply all current filters
            await this.applyFilters();
        } catch (error) {
            console.error('Error handling filter change:', error);
        }
    }

    async handleClearFilters() {
        try {
            // Reset filter inputs
            const nameSearch = document.getElementById('nameSearch');
            if (nameSearch) nameSearch.value = '';
            
            const dateRange = document.getElementById('dateRange');
            if (dateRange) dateRange.value = 'all';
            
            const startDate = document.getElementById('startDate');
            if (startDate) startDate.value = '';
            
            const endDate = document.getElementById('endDate');
            if (endDate) endDate.value = '';
            
            // Reset week, month, year pickers
            const weekPicker = document.getElementById('analyticsWeekPicker');
            if (weekPicker) weekPicker.value = '';
            
            const monthPicker = document.getElementById('analyticsMonthPicker');
            if (monthPicker) monthPicker.value = '';
            
            const yearPicker = document.getElementById('analyticsYearPicker');
            if (yearPicker) yearPicker.value = '';
            
            const testerType = document.getElementById('testerType');
            if (testerType) testerType.value = 'all';
            
            const sensorType = document.getElementById('sensorType');
            if (sensorType) sensorType.value = 'all';
            
            const foodType = document.getElementById('foodType');
            if (foodType) foodType.value = 'all';
            
            const status = document.getElementById('status');
            if (status) status.value = 'all';

            // Hide all date picker groups
            const weekGroup = document.getElementById('analyticsWeekGroup');
            if (weekGroup) weekGroup.style.display = 'none';
            
            const monthGroup = document.getElementById('analyticsMonthGroup');
            if (monthGroup) monthGroup.style.display = 'none';
            
            const yearGroup = document.getElementById('analyticsYearGroup');
            if (yearGroup) yearGroup.style.display = 'none';
            
            const customDateGroup = document.getElementById('analyticsCustomDateGroup');
            if (customDateGroup) customDateGroup.style.display = 'none';

            // Reset internal filters and reload fresh data
            this.api.updateFilters({
                nameSearch: '',
                startDate: '',
                endDate: '',
                testerType: 'All Types',
                sensorType: 'All Types',
                foodType: 'All Food Types',
                status: 'All Status'
            });
            const detailed = await this.api.fetchDetailedData({});
            this.updateDetailedDisplay(detailed || []);
            await this.loadSummaryData();
        } catch (error) {
            console.error('Error clearing filters:', error);
        }
    }

    exportToCSV() {
        try {
            const currentData = this.api.data.detailed || [];
            this.api.exportToCSV(currentData);
        } catch (error) {
            console.error('Error exporting to CSV:', error);
        }
    }

    exportToPDF() {
        try {
            const currentData = this.api.data.detailed || [];
            this.api.exportToPDF(currentData);
        } catch (error) {
            console.error('Error exporting to PDF:', error);
        }
    }

    switchPage(page) {
        // Remove active class from all buttons
        document.querySelectorAll('.spoilage-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to clicked button
        const activeBtn = document.querySelector(`[data-page="${page}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update current page
        this.currentPage = page;

        // Load appropriate data
        this.loadAnalyticsData();
    }

    // Utility functions
    getTimeAgo(date) {
        if (!date) return 'No activity yet';

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    getPingClass(date) {
        if (!date) return 'expiry-expired';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = diffMs / (1000 * 60);

        if (diffMins < 5) return 'expiry-today';
        if (diffMins < 60) return 'expiry-today';
        if (diffMins < 1440) return 'expiry-days';
        return 'expiry-expired';
    }

    formatDate(date) {
        if (!date) return 'No ping yet';
        
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
    }

    debounce(func, wait) {
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

    // Wait for an element to exist in the DOM (helps with SPA-loaded content)
    waitForElement(selector, timeoutMs = 2000) {
        return new Promise((resolve, reject) => {
            const found = document.querySelector(selector);
            if (found) return resolve(found);
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });
            observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                resolve(null); // Resolve anyway to avoid blocking
            }, timeoutMs);
        });
    }

    // Helper methods for date calculations
    getWeekStartDate(year, week) {
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

    getWeekEndDate(year, week) {
        const weekStart = this.getWeekStartDate(year, week);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return weekEnd;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Create global instance
    window.sensorAnalyticsConnector = new SensorAnalyticsConnector();

    // Also create global API instance for backward compatibility
    window.sensorAnalyticsAPI = window.sensorAnalyticsConnector.api;
    
    console.log('Sensor Analytics Connector loaded');
});

//  ML Predictions Manager for SPA ML pages
(function(){
    if (!window.mlPredictionsManager) {
        window.mlPredictionsManager = {
            _accuracyCalculated: false, // Flag to prevent multiple calculations
            _calculatingAccuracy: false, // Flag to prevent simultaneous calculations
            _storedAccuracy: null, // Store the calculated accuracy value
            _storedAccuracySub: null, // Store the accuracy subtitle
            async loadOverview(){
                try {
                    console.log('Loading ML overview...');
                    const res = await fetch('/api/ml/analytics/overview', { headers: this._authHeaders() });
                    const json = await res.json();
                    console.log('ML overview API response:', json);
                    
                    if (!json.success) {
                        console.error('ML overview API failed:', json.error);
                        return;
                    }
                    
                    const d = json.data || {};
                    console.log('ML overview data:', d);
                    
                    const set = (id, val) => { 
                        const el = document.getElementById(id); 
                        if (el) {
                            el.textContent = String(val);
                            console.log(`Set ${id} to: ${val}`);
                        } else {
                            console.log(`Element ${id} not found in DOM`);
                        }
                    };
                    
                    set('mlKpiTotal', d.total_predictions || 0);
                    set('mlKpiTotalSub', `+${d.predictions_today || 0} today`);
                    set('mlKpiConfidence', d.avg_confidence_7d != null ? `${d.avg_confidence_7d}%` : '--%');
                    set('mlKpiConfidenceSub', '+ this week');
                    set('mlKpiSamples', d.training_samples || 0);
                    set('mlKpiSamplesSub', `+${d.training_added_today || 0} added`);
                    
                    // Use stored accuracy if available, otherwise use API value
                    // Only use API value if it's not 0 and not null
                    let accuracyValue = null;
                    let accuracySub = '';
                    
                    if (this._storedAccuracy !== null) {
                        // Use stored accuracy value
                        accuracyValue = this._storedAccuracy;
                        accuracySub = this._storedAccuracySub || '+ improved';
                        console.log('Using stored accuracy value:', accuracyValue);
                    } else if (d.model_accuracy != null && Number(d.model_accuracy) > 0) {
                        // Use API value if it's valid and greater than 0
                        accuracyValue = Number(d.model_accuracy);
                        accuracySub = '+ improved';
                        // Store it for future use
                        this._storedAccuracy = accuracyValue;
                        this._storedAccuracySub = accuracySub;
                    }
                    
                    set('mlKpiAccuracy', accuracyValue != null ? `${(accuracyValue * 100).toFixed(1)}%` : '--%');
                    set('mlKpiAccuracySub', accuracySub);

                    // Removed Recent ML Predictions section per request
                    await this._loadSamples();
                    this.setupEventListeners();
                    console.log('ML overview loaded successfully');
                } catch (e) { 
                    console.error('ML overview load failed', e);
                }
            },
            async _loadRecent(){
                try {
                    console.log('Loading recent ML predictions...');
                    const res = await fetch('/api/ml/analytics/recent?limit=5', { headers: this._authHeaders() });
                    const json = await res.json();
                    console.log('Recent predictions API response:', json);
                    console.log('Data type:', typeof json.data, 'Is array:', Array.isArray(json.data));
                    
                    const tbody = document.getElementById('mlRecentTableBody');
                    const countSpan = document.getElementById('mlRecentCount');
                    if (!tbody) {
                        console.log('mlRecentTableBody not found in DOM');
                        return;
                    }
                    tbody.innerHTML = '';
                    const rows = json.success ? (Array.isArray(json.data) ? json.data : []) : [];
                    if (countSpan) countSpan.textContent = rows.length;
                    
                    if (rows.length === 0) {
                        const tr = document.createElement('tr');
                        const td = document.createElement('td');
                        td.colSpan = 7; 
                        td.innerHTML = `
                            <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 0;color:#bfc9da;">
                                <div style="font-size:46px;line-height:1;opacity:0.8;">📊</div>
                                <div>No recent predictions</div>
                            </div>
                        `;
                        tr.appendChild(td); tbody.appendChild(tr); 
                        return;
                    }
                    
                    rows.forEach(r => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${r.food_name || ''}<div style="color:#9fb2e6;font-size:12px;">${r.food_category||''}</div></td>
                            <td>🌡️ ${r.temperature}°C &nbsp; 💧 ${r.humidity}% &nbsp; 🧪 ${r.gas_level} ppm</td>
                            <td>${r.spoilage_probability}%</td>
                            <td>${r.confidence_score}% <div style="color:#9fb2e6;font-size:12px;">Model ${r.model_version||''}</div></td>
                            <td><span class="ml-badge ${String(r.spoilage_status).toLowerCase()}">${String(r.spoilage_status).toUpperCase()}</span></td>
                            <td>${formatTimestamp(r.created_at)}</td>
                            <td><button class="ml-btn secondary" data-id="${r.prediction_id}">Details</button></td>
                        `;
                        tbody.appendChild(tr);
                    });
                    console.log(`Loaded ${rows.length} recent predictions`);
                } catch (e) { 
                    console.error('ML recent load failed', e);
                    const tbody = document.getElementById('mlRecentTableBody');
                    if (tbody) {
                        tbody.innerHTML = `
                            <tr><td colspan="7" style="color:#f87171;text-align:center;padding:20px;">
                                Error loading recent predictions
                            </td></tr>
                        `;
                    }
                }
            },
            async _loadSamples(){
                try {
                    console.log('Loading training data samples...');
                    const res = await fetch('/api/ml/analytics/samples?limit=all', { headers: this._authHeaders() });
                    const json = await res.json();
                    console.log('Training samples API response:', json);
                    console.log('Data type:', typeof json.data, 'Is array:', Array.isArray(json.data));
                    
                    const tbody = document.getElementById('mlSamplesTableBody');
                    const countSpan = document.getElementById('mlSamplesCount');
                    if (!tbody) {
                        console.log('mlSamplesTableBody not found in DOM');
                        return;
                    }
                    // Store and render with pagination
                    const allRows = json.success ? (Array.isArray(json.data) ? json.data : []) : [];
                    this._samplesAll = allRows;
                    this._samplesFiltered = null; // Reset filter when loading new data
                    this._samplesPage = this._samplesPage || 1;
                    this._samplesPageSize = this._samplesPageSize || 10;
                    if (countSpan) countSpan.textContent = allRows.length;
                    this._renderSamplesPage();
                    // Setup search listeners after data is loaded
                    this._setupMlSearchListeners();
                    // Automatically calculate accuracy from training data (only once, no toasts)
                    if (!this._accuracyCalculated) {
                        this._accuracyCalculated = true;
                        this._calculateModelAccuracy();
                    }
                    console.log(`Loaded ${allRows.length} training samples`);
                } catch (e) { 
                    console.error('ML samples load failed', e);
                    const tbody = document.getElementById('mlSamplesTableBody');
                    if (tbody) {
                        tbody.innerHTML = `
                            <tr><td colspan="7" style="color:#f87171;text-align:center;padding:20px;">
                                Error loading training data
                            </td></tr>
                        `;
                    }
                }
            },
            _renderSamplesPage(){
                const tbody = document.getElementById('mlSamplesTableBody');
                const pag = document.getElementById('mlSamplesPagination');
                const info = document.getElementById('mlSamplesPageInfo');
                const ctrls = document.getElementById('mlSamplesPageControls');
                const countSpan = document.getElementById('mlSamplesCount');
                if (!tbody) return;
                tbody.innerHTML = '';
                // Use filtered data if search is active, otherwise use all data
                const rows = this._samplesFiltered !== null ? this._samplesFiltered : (Array.isArray(this._samplesAll) ? this._samplesAll : []);
                const total = rows.length;
                // Update count display
                if (countSpan) {
                    const totalAll = Array.isArray(this._samplesAll) ? this._samplesAll.length : 0;
                    countSpan.textContent = this._samplesFiltered !== null ? `${total} of ${totalAll}` : totalAll;
                }
                if (total === 0) {
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    td.colSpan = 7; 
                    td.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 0;color:#bfc9da;"><div style="font-size:46px;line-height:1;opacity:0.8;">📊</div><div>No training data</div></div>`;
                    tr.appendChild(td); tbody.appendChild(tr);
                    if (pag) pag.style.display = 'none';
                    return;
                }
                const size = this._samplesPageSize || 10;
                const page = Math.max(1, Math.min(this._samplesPage || 1, Math.ceil(total/size)));
                const start = (page-1)*size;
                const end = Math.min(start+size, total);
                const slice = rows.slice(start, end);
                slice.forEach((r, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${r.food_name || ''}<div style="color:#9fb2e6;font-size:12px;">${r.food_category||''}</div></td>
                        <td>🌡️ ${r.temperature}°C &nbsp; 💧 ${r.humidity}% &nbsp; 🧪 ${r.gas_level} ppm</td>
                        <td><span class="ml-badge ${String(r.actual_spoilage_status).toLowerCase()}">${String(r.actual_spoilage_status).toUpperCase()}</span></td>
                        <td><div class="ml-progress"><span style="width:${Math.round((r.quality_score||0)*100)}%"></span></div></td>
                        <td>${(r.data_source||'').toUpperCase()}</td>
                        <td>${new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                            <button class="ml-btn secondary update-training-btn" data-id="${r.id || r.training_id}" data-food="${r.food_name || ''}" style="font-size: 12px; padding: 4px 8px;">
                                🔄 Update
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                if (pag && info && ctrls) {
                    pag.style.display = '';
                    info.textContent = `Showing ${start+1} to ${end} of ${total} records`;
                    ctrls.innerHTML = '';
                    const totalPages = Math.max(1, Math.ceil(total/size));
                    const makeBtn = (label, p, disabled=false, active=false) => {
                        const b = document.createElement('button');
                        b.className = 'pagination-btn' + (active?' active':'');
                        b.textContent = label;
                        b.disabled = disabled;
                        b.onclick = () => { if (p!==page){ this._samplesPage=p; this._renderSamplesPage(); }};
                        return b;
                    };
                    if (page>1) ctrls.appendChild(makeBtn('‹ Prev', page-1));
                    for (let i=1;i<=totalPages;i++){
                        if (i===1 || i===totalPages || (i>=page-2 && i<=page+2)) ctrls.appendChild(makeBtn(String(i), i, false, i===page));
                        else if (i===page-3 || i===page+3){ const s=document.createElement('span'); s.className='pagination-ellipsis'; s.textContent='...'; ctrls.appendChild(s);} 
                    }
                    if (page<totalPages) ctrls.appendChild(makeBtn('Next ›', page+1));
                }
            },
            _filterSamples(searchTerm){
                if (!searchTerm || searchTerm.trim() === '') {
                    this._samplesFiltered = null;
                    this._samplesPage = 1; // Reset to first page
                    this._renderSamplesPage();
                    return;
                }
                const term = searchTerm.toLowerCase().trim();
                const allRows = Array.isArray(this._samplesAll) ? this._samplesAll : [];
                this._samplesFiltered = allRows.filter(row => {
                    const foodName = (row.food_name || '').toLowerCase();
                    const foodCategory = (row.food_category || '').toLowerCase();
                    const status = (row.actual_spoilage_status || '').toLowerCase();
                    const source = (row.data_source || '').toLowerCase();
                    return foodName.includes(term) || 
                           foodCategory.includes(term) || 
                           status.includes(term) || 
                           source.includes(term);
                });
                this._samplesPage = 1; // Reset to first page when filtering
                this._renderSamplesPage();
            },
            _setupMlSearchListeners(){
                const searchInput = document.getElementById('mlTrainingSearch');
                const clearBtn = document.getElementById('mlClearSearch');
                if (searchInput) {
                    // Real-time search as user types
                    searchInput.addEventListener('input', (e) => {
                        const searchTerm = e.target.value;
                        this._filterSamples(searchTerm);
                        // Show/hide clear button
                        if (clearBtn) {
                            clearBtn.style.display = searchTerm.trim() ? 'block' : 'none';
                        }
                    });
                    // Also handle Enter key
                    searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this._filterSamples(e.target.value);
                        }
                    });
                }
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        if (searchInput) {
                            searchInput.value = '';
                            this._filterSamples('');
                        }
                        if (clearBtn) clearBtn.style.display = 'none';
                    });
                }
            },
            async _calculateModelAccuracy(){
                // Prevent multiple simultaneous calculations
                if (this._calculatingAccuracy) {
                    console.log('⏳ Accuracy calculation already in progress, skipping...');
                    return;
                }
                
                this._calculatingAccuracy = true;
                
                try {
                    console.log('🔄 Automatically calculating model accuracy from training data...');
                    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
                    const response = await fetch('/api/ml/analytics/calculate-accuracy', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Store the calculated accuracy value
                        const accuracyPercent = parseFloat(result.accuracy_percent);
                        const accuracySub = `+${result.correct_predictions}/${result.total_samples} correct`;
                        
                        // Store accuracy for persistence across page switches
                        this._storedAccuracy = accuracyPercent / 100; // Store as decimal (0.8818 for 88.18%)
                        this._storedAccuracySub = accuracySub;
                        
                        // Update the accuracy display silently (no toasts)
                        const accuracyEl = document.getElementById('mlKpiAccuracy');
                        const accuracySubEl = document.getElementById('mlKpiAccuracySub');
                        
                        if (accuracyEl) {
                            accuracyEl.textContent = `${accuracyPercent}%`;
                        }
                        if (accuracySubEl) {
                            accuracySubEl.textContent = accuracySub;
                        }
                        
                        console.log(`✅ Model accuracy calculated: ${accuracyPercent}% (${result.correct_predictions}/${result.total_samples} correct)`);
                        console.log(`💾 Stored accuracy value: ${this._storedAccuracy} for persistence`);
                        
                        // Update accuracy in overview without reloading (to avoid toast spam)
                        // Just update the accuracy display directly
                        // No need to reload overview - accuracy is already updated
                    } else {
                        throw new Error(result.error || 'Failed to calculate accuracy');
                    }
                } catch (error) {
                    console.error('Error calculating model accuracy:', error);
                    // Silently fail - don't show error to user on automatic calculation
                } finally {
                    this._calculatingAccuracy = false;
                }
            },
            _authHeaders(){
                const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
                return token ? { 'Authorization': `Bearer ${token}` } : {};
            },
            showToast(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    font-size: 14px;
                    font-weight: 500;
                    max-width: 300px;
                    word-wrap: break-word;
                `;
                toast.textContent = message;
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300);
                }, 3000);
            },
            setupEventListeners(){
                const retrain = document.getElementById('mlRetrain');
                if (retrain) retrain.addEventListener('click', ()=> alert('Retrain endpoint to be wired'));
                const exportBtn = document.getElementById('mlExport');
                if (exportBtn) exportBtn.addEventListener('click', ()=> alert('Export coming soon'));
                
                // ML Predictions Update button
                const mlUpdateBtn = document.getElementById('mlUpdate');
                if (mlUpdateBtn) {
                    mlUpdateBtn.addEventListener('click', async () => {
                        try {
                            console.log('🔄 Updating ML Predictions data...');
                            mlUpdateBtn.disabled = true;
                            mlUpdateBtn.innerHTML = '<span>🔄</span>Updating...';
                            
                            // Refresh ML predictions data
                            if (this.loadDetail) {
                                await this.loadDetail();
                            }
                            
                            // Show success message
                            this.showToast('ML Predictions data updated successfully!', 'success');
                            
                        } catch (error) {
                            console.error('Error updating ML predictions:', error);
                            this.showToast('Error updating ML predictions data', 'error');
                        } finally {
                            mlUpdateBtn.disabled = false;
                            mlUpdateBtn.innerHTML = '<span>🔄</span>Update';
                        }
                    });
                }
                
                // Individual Training Data Update buttons (delegated event listener)
                document.addEventListener('click', (e) => {
                    console.log('🔍 Click detected on:', e.target);
                    console.log('🔍 Target classes:', e.target.classList);
                    
                    if (e.target.classList.contains('update-training-btn')) {
                        console.log('✅ Update training button clicked!');
                        e.preventDefault();
                        this.handleIndividualTrainingUpdate(e.target);
                    }
                });
                
                // Initialize update modal after page load
                setTimeout(() => {
                    const testModal = document.getElementById('updateTrainingDataModal');
                    const testForm = document.getElementById('updateTrainingDataForm');
                    const testBtn = document.getElementById('updateTrainingDataBtn');
                    
                    if (testModal && testForm && testBtn) {
                        console.log('✅ Update modal elements initialized successfully');
                    } else {
                        console.warn('⚠️ Some update modal elements not found - fallback modal will be used if needed');
                    }
                }, 1000);

                // Normalize text inputs to Sample Case (Title Case) on blur
                const toSampleCase = (s) => {
                    if (!s) return '';
                    return String(s).replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
                };
                const foodName = document.getElementById('mlFoodName');
                if (foodName) {
                    foodName.addEventListener('blur', () => { foodName.value = toSampleCase(foodName.value.trim()); });
                }
                const category = document.getElementById('mlCategory');
                if (category) {
                    category.addEventListener('blur', () => { category.value = toSampleCase(category.value.trim()); });
                }
            },
            async loadDetail(){
                try {
                    console.log('Loading ML predictions detail data...');
                    
                    // Get filter values
                    const search = document.getElementById('mlSearch')?.value || '';
                    const dateRange = document.getElementById('mlDateRange')?.value || 'all';
                    const recordsPerPage = document.getElementById('mlRecordsPerPage')?.value || '25';
                    
                    // Build query parameters
                    const params = new URLSearchParams();
                    if (search) params.append('search', search);
                    if (dateRange !== 'all') params.append('dateRange', dateRange);
                    params.append('limit', recordsPerPage);
                    
                    // Add specific date parameters if needed
                    if (dateRange === 'weekly' && document.getElementById('mlWeekPicker')?.value) {
                        params.append('week', document.getElementById('mlWeekPicker').value);
                    }
                    if (dateRange === 'monthly' && document.getElementById('mlMonthPicker')?.value) {
                        params.append('month', document.getElementById('mlMonthPicker').value);
                    }
                    if (dateRange === 'yearly' && document.getElementById('mlYearPicker')?.value) {
                        params.append('year', document.getElementById('mlYearPicker').value);
                    }
                    
                    const url = `/api/ml/analytics/detail?${params.toString()}`;
                    console.log('Fetching ML predictions from:', url);
                    
                    const response = await fetch(url, { headers: this._authHeaders() });
                    const result = await response.json();
                    
                    if (!result.success) {
                        throw new Error(result.message || 'Failed to load ML predictions');
                    }
                    
                    // Update the table with new data
                    this.updateMlPredictionsTable(result.data || []);
                    
                    console.log('ML predictions detail loaded successfully');
                    
                } catch (error) {
                    console.error('Error loading ML predictions detail:', error);
                    this.showToast('Error loading ML predictions data', 'error');
                }
            },
            updateMlPredictionsTable(data) {
                const tbody = document.querySelector('#ml-predictions-detail-template tbody, .admin-log-table tbody');
                if (!tbody) {
                    console.error('ML predictions table body not found');
                    return;
                }
                
                tbody.innerHTML = '';
                
                if (!data || data.length === 0) {
                    const row = document.createElement('tr');
                    row.innerHTML = '<td colspan="7" style="text-align: center; padding: 20px; color: #666;">No ML predictions found</td>';
                    tbody.appendChild(row);
                    return;
                }
                
                data.forEach(prediction => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${formatTimestamp(prediction.timestamp || prediction.created_at)}</td>
                        <td>${prediction.device_id || prediction.sensor_id || 'N/A'}</td>
                        <td>${prediction.user_email || prediction.username || 'N/A'}</td>
                        <td>${prediction.sensor_type || prediction.type || 'N/A'}</td>
                        <td>${prediction.model_name || prediction.model || 'N/A'}</td>
                        <td>${prediction.prediction || prediction.result || 'N/A'}</td>
                        <td>${prediction.confidence ? `${(prediction.confidence * 100).toFixed(1)}%` : 'N/A'}</td>
                    `;
                    tbody.appendChild(row);
                });
            },
            async handleIndividualTrainingUpdate(button) {
                try {
                    const trainingId = button.getAttribute('data-id');
                    const foodName = button.getAttribute('data-food');
                    
                    if (!this._samplesAll || this._samplesAll.length === 0) {
                        this.showToast('No training data available', 'error');
                        return;
                    }
                    
                    // Try multiple ways to find the training data
                    let trainingData = null;
                    
                    // Method 1: Direct ID match
                    trainingData = this._samplesAll.find(item => 
                        item.id == trainingId || item.training_id == trainingId
                    );
                    
                    if (!trainingData) {
                        // Method 2: String conversion
                        trainingData = this._samplesAll.find(item => 
                            String(item.id) === String(trainingId) || 
                            String(item.training_id) === String(trainingId)
                        );
                    }
                    
                    if (!trainingData) {
                        // Method 3: Partial match
                        trainingData = this._samplesAll.find(item => 
                            String(item.id).includes(String(trainingId)) || 
                            String(item.training_id).includes(String(trainingId))
                        );
                    }
                    
                    if (!trainingData) {
                        // Create a fallback training data object
                        trainingData = {
                            id: trainingId,
                            training_id: trainingId,
                            food_name: foodName || 'Unknown Food',
                            food_category: 'Unknown Category',
                            temperature: 25,
                            humidity: 50,
                            gas_level: 100,
                            actual_spoilage_status: 'safe',
                            data_source: 'manual',
                            quality_score: 0.95
                        };
                    }
                    
                    // Try to open the modal directly
                    this.openUpdateModalDirect(trainingData);
                    
                } catch (error) {
                    console.error('Error opening update modal:', error);
                    this.showToast('Error opening update modal', 'error');
                }
            },
            openUpdateModal(trainingData) {
                console.log('🔍 Opening update modal with data:', trainingData);
                
                // Get the new update modal elements
                const modal = document.getElementById('updateTrainingDataModal');
                console.log('🔍 Modal element found:', modal);
                
                if (!modal) {
                    console.error('❌ Update modal element not found!');
                    console.log('🔍 Available modals in DOM:', document.querySelectorAll('.modal'));
                    this.showToast('Update modal not found', 'error');
                    return;
                }
                
                const modalHeader = modal.querySelector('.modal-header h3');
                const form = document.getElementById('updateTrainingDataForm');
                const saveBtn = document.getElementById('updateTrainingDataBtn');
                
                console.log('🔍 Modal sub-elements found:', { modalHeader, form, saveBtn });
                
                if (!modalHeader || !form || !saveBtn) {
                    console.error('❌ Update modal sub-elements not found!');
                    console.log('🔍 Available forms:', document.querySelectorAll('form'));
                    console.log('🔍 Available buttons:', document.querySelectorAll('button'));
                    this.showToast('Update modal elements not found', 'error');
                    return;
                }
                
                // Pre-fill form with existing data
                const foodNameInput = document.getElementById('updateFoodName');
                const categoryInput = document.getElementById('updateCategory');
                const temperatureInput = document.getElementById('updateTemperature');
                const humidityInput = document.getElementById('updateHumidity');
                const phInput = document.getElementById('updatePh');
                const actualStatusSelect = document.getElementById('updateActualStatus');
                const sourceSelect = document.getElementById('updateSource');
                const dataQualityInput = document.getElementById('updateDataQuality');
                
                // Set form values
                if (foodNameInput) foodNameInput.value = trainingData.food_name || '';
                if (categoryInput) categoryInput.value = trainingData.food_category || '';
                if (temperatureInput) temperatureInput.value = trainingData.temperature || '';
                if (humidityInput) humidityInput.value = trainingData.humidity || '';
                if (phInput) phInput.value = trainingData.gas_level || '';
                if (actualStatusSelect) actualStatusSelect.value = trainingData.actual_spoilage_status || '';
                if (sourceSelect) sourceSelect.value = trainingData.data_source || '';
                if (dataQualityInput) dataQualityInput.value = Math.round((trainingData.quality_score || 0) * 100);
                
                // Add training ID to save button
                saveBtn.setAttribute('data-training-id', trainingData.id || trainingData.training_id);
                
                // Show the modal with forced visibility
                modal.style.display = 'block';
                modal.style.zIndex = '10000'; // Ensure it's on top
                modal.style.visibility = 'visible';
                modal.style.opacity = '1';
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100%';
                modal.style.height = '100%';
                modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                
                console.log('✅ Update modal opened successfully');
                console.log('🔍 Modal styles applied:', {
                    display: modal.style.display,
                    zIndex: modal.style.zIndex,
                    visibility: modal.style.visibility,
                    opacity: modal.style.opacity
                });
            },
            openUpdateModalDirect(trainingData) {
                // Try multiple ways to find the modal
                let modal = document.getElementById('updateTrainingDataModal');
                
                if (!modal) {
                    modal = document.querySelector('#updateTrainingDataModal');
                }
                
                if (!modal) {
                    modal = document.querySelector('.modal[id*="update"]');
                }
                
                if (!modal) {
                    this.createTemporaryModal(trainingData);
                    return;
                }
                
                // Pre-fill form data
                const foodNameInput = document.getElementById('updateFoodName');
                const categoryInput = document.getElementById('updateCategory');
                const temperatureInput = document.getElementById('updateTemperature');
                const humidityInput = document.getElementById('updateHumidity');
                const phInput = document.getElementById('updatePh');
                const actualStatusSelect = document.getElementById('updateActualStatus');
                const sourceSelect = document.getElementById('updateSource');
                const dataQualityInput = document.getElementById('updateDataQuality');
                const environmentalFactorsInput = document.getElementById('updateEnvironmentalFactors');
                
                if (foodNameInput) foodNameInput.value = trainingData.food_name || '';
                if (categoryInput) categoryInput.value = trainingData.food_category || '';
                if (temperatureInput) temperatureInput.value = trainingData.temperature || '';
                if (humidityInput) humidityInput.value = trainingData.humidity || '';
                if (phInput) phInput.value = trainingData.gas_level || '';
                if (actualStatusSelect) actualStatusSelect.value = trainingData.actual_spoilage_status || '';
                if (sourceSelect) sourceSelect.value = trainingData.data_source || '';
                if (dataQualityInput) dataQualityInput.value = Math.round((trainingData.quality_score || 0) * 100);
                if (environmentalFactorsInput) {
                    const envFactors = trainingData.environmental_factors;
                    const debugDiv = document.getElementById('envFactorsDebug');
                    
                    console.log('📊 Loading Environmental Factors:', envFactors);
                    console.log('📊 Training Data Object:', trainingData);
                    
                    if (envFactors) {
                        let envValue = typeof envFactors === 'string' ? envFactors : JSON.stringify(envFactors, null, 2);
                        
                        console.log('📝 Environmental Factors Value:', envValue);
                        console.log('📝 Value Length:', envValue.length);
                        
                        // Only filter out EXACT placeholder match (all 3 fields with exact values)
                        const isExactPlaceholder = envValue === '{"notes": "Additional observations", "location": "Storage area", "conditions": "Normal"}' ||
                                                  (envValue.includes('"notes": "Additional observations"') && 
                                                   envValue.includes('"location": "Storage area"') && 
                                                   envValue.includes('"conditions": "Normal"') &&
                                                   !envValue.includes('gas_emission_analysis') &&
                                                   !envValue.includes('storage_location'));
                        
                        if (!isExactPlaceholder) {
                            // Don't load JSON into textarea - keep it empty for plain text input
                            environmentalFactorsInput.value = '';
                            environmentalFactorsInput.placeholder = '💡 Describe the food condition:\n\nExamples:\n• "Fresh appearance, no visible damage"\n• "Slight browning on edges"\n• "Strong odor detected"\n• "Soft texture, minor discoloration"\n\n✨ AI will analyze and generate detailed recommendations for optimal food handling.';
                            
                            console.log('✅ Showing current data in card view');
                            if (debugDiv) {
                                debugDiv.textContent = `✅ Loaded ${envValue.length} characters of environmental data`;
                                debugDiv.style.color = '#4CAF50';
                            }
                            
                            // Display user-friendly version (but keep original data stored)
                            this.displayUserFriendlyEnvFactors(envValue, environmentalFactorsInput);
                        } else {
                            environmentalFactorsInput.value = '';
                            environmentalFactorsInput.placeholder = '💡 Describe the food condition:\n\nExamples:\n• "Fresh appearance, no visible damage"\n• "Slight browning on edges"\n• "Strong odor detected"\n• "Soft texture, minor discoloration"\n\n✨ AI will analyze and generate detailed recommendations for optimal food handling.';
                            console.log('🔄 Filtered out placeholder, showing empty field');
                            if (debugDiv) {
                                debugDiv.textContent = '⚠️ Old placeholder data was cleared. Please enter new data.';
                                debugDiv.style.color = '#ff9800';
                            }
                        }
                    } else {
                        console.log('ℹ️ No environmental factors data');
                        console.warn('⚠️ WARNING: environmental_factors is null/undefined in training data!');
                        if (debugDiv) {
                            debugDiv.textContent = 'ℹ️ No environmental factors data found for this entry.';
                            debugDiv.style.color = '#888';
                        }
                    }
                    
                    // Remove auto-format listeners - user wants to enter text without auto-formatting
                    // Remove previous listeners if any
                    const newEnvInput = environmentalFactorsInput.cloneNode(true);
                    environmentalFactorsInput.parentNode.replaceChild(newEnvInput, environmentalFactorsInput);
                    
                    // Auto-format listeners removed - user can enter text freely without automatic JSON formatting
                }
                
                // Set training ID on save button
                const saveBtn = document.getElementById('updateTrainingDataBtn');
                if (saveBtn) {
                    saveBtn.setAttribute('data-training-id', trainingData.id || trainingData.training_id);
                }
                
                // Force show modal with all possible styles
                modal.style.cssText = `
                    display: block !important;
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    background-color: rgba(0,0,0,0.5) !important;
                    z-index: 10000 !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                `;
            },
            createTemporaryModal(trainingData) {
                
                // Create modal HTML directly
                const modalHTML = `
                    <div id="tempUpdateModal" style="
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0,0,0,0.7);
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        backdrop-filter: blur(4px);
                    ">
                        <div class="update-modal" style="max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                            <div class="update-modal-header">
                                <h3 class="update-modal-title">
                                    <span class="update-modal-icon">✏️</span>
                                    Update Training Data
                                </h3>
                            </div>
                            <div class="update-modal-body">
                                <div class="update-modal-info">
                                    <p class="update-modal-info-text">
                                        <span class="update-modal-info-icon">ℹ️</span>
                                        Update the details for the training data sample.
                                    </p>
                                </div>
                            <form id="tempUpdateForm">
                                <!-- Food Information Section -->
                                <div class="update-modal-section">
                                    <h4 class="update-modal-section-title">
                                        <span>🍎</span> Food Information
                                    </h4>
                            <div class="update-modal-form-row">
                                <div class="update-modal-form-group">
                                    <label class="update-modal-label">Food Name</label>
                                    <input type="text" id="tempFoodName" value="${trainingData.food_name || ''}" readonly class="update-modal-input">
                                </div>
                                <div class="update-modal-form-group">
                                    <label class="update-modal-label">Category</label>
                                    <input type="text" id="tempCategory" value="${trainingData.food_category || ''}" readonly class="update-modal-input">
                                </div>
                            </div>
                                </div>
                                
                        <!-- Environmental Conditions Section -->
                        <div class="update-modal-section">
                            <h4 class="update-modal-section-title">
                                <span>🌡️</span> Environmental Conditions
                            </h4>
                            <div class="update-modal-form-row-three">
                                <div class="update-modal-form-group">
                                    <label class="update-modal-label">🌡️ Temp (°C)</label>
                                    <input type="number" id="tempTemperature" value="${trainingData.temperature || ''}" step="0.1" class="update-modal-input">
                                </div>
                                <div class="update-modal-form-group">
                                    <label class="update-modal-label">💧 Humidity (%)</label>
                                    <input type="number" id="tempHumidity" value="${trainingData.humidity || ''}" step="0.1" class="update-modal-input">
                                </div>
                                <div class="update-modal-form-group">
                                    <label class="update-modal-label">💨 Gas (ppm)</label>
                                    <input type="number" id="tempPh" value="${trainingData.gas_level || ''}" step="0.1" class="update-modal-input">
                                </div>
                            </div>
                        </div>
                                
                                <!-- Status & Quality Section -->
                                <div class="update-modal-section">
                                    <h4 class="update-modal-section-title">
                                        <span>📊</span> Status & Quality
                                    </h4>
                                    <div class="update-modal-form-row" style="margin-bottom: 12px;">
                                        <div class="update-modal-form-group">
                                            <label class="update-modal-label">Actual Status</label>
                                            <select id="tempActualStatus" class="update-modal-select">
                                                <option value="">Select status</option>
                                                <option value="safe" ${trainingData.actual_spoilage_status === 'safe' ? 'selected' : ''} class="update-modal-option safe">✅ Safe</option>
                                                <option value="caution" ${trainingData.actual_spoilage_status === 'caution' ? 'selected' : ''} class="update-modal-option caution">⚠️ Caution</option>
                                                <option value="unsafe" ${trainingData.actual_spoilage_status === 'unsafe' ? 'selected' : ''} class="update-modal-option unsafe">❌ Unsafe</option>
                                            </select>
                                        </div>
                                        <div class="update-modal-form-group">
                                            <label class="update-modal-label">Data Source</label>
                                            <select id="tempSource" class="update-modal-select">
                                                <option value="">Select source</option>
                                                <option value="manual" ${trainingData.data_source === 'manual' ? 'selected' : ''} class="update-modal-option">👤 Manual</option>
                                                <option value="sensor" ${trainingData.data_source === 'sensor' ? 'selected' : ''} class="update-modal-option">📡 Sensor</option>
                                                <option value="user_feedback" ${trainingData.data_source === 'user_feedback' ? 'selected' : ''} class="update-modal-option">💬 User Feedback</option>
                                                <option value="expert" ${trainingData.data_source === 'expert' ? 'selected' : ''} class="update-modal-option">🎓 Expert</option>
                                            </select>
                                        </div>
                                    </div>
                            <div class="update-modal-form-group">
                                <label class="update-modal-label">Data Quality (%)</label>
                                <input type="number" id="tempDataQuality" value="${Math.round((trainingData.quality_score || 0) * 100)}" min="0" max="100" step="1" class="update-modal-input">
                            </div>
                        </div>
                        
                        <!-- Environmental Factors Section -->
                        <div class="update-modal-section">
                            <h4 class="update-modal-section-title">
                                <span>🌍</span> Environmental Factors
                            </h4>
                            <div class="update-modal-form-group">
                                <label class="update-modal-label">Additional Environmental Data (JSON)</label>
                                <textarea id="tempEnvironmentalFactors" name="environmentalFactors" placeholder='Type plain text or JSON (AI will format it automatically)' class="update-modal-textarea" rows="3">${trainingData.environmental_factors ? (typeof trainingData.environmental_factors === 'string' ? trainingData.environmental_factors : JSON.stringify(trainingData.environmental_factors, null, 2)) : ''}</textarea>
                            </div>
                        </div>
                    </form>
                            <div class="update-modal-footer">
                                <button type="button" id="tempCancelBtn" class="update-modal-btn update-modal-btn-secondary">Cancel</button>
                                <button type="button" id="tempSaveBtn" data-training-id="${trainingData.id || trainingData.training_id}" class="update-modal-btn update-modal-btn-primary">Update Training Data</button>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add modal to body
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                
                // Add event listeners
                document.getElementById('tempCancelBtn').onclick = () => {
                    document.getElementById('tempUpdateModal').remove();
                };
                
                document.getElementById('tempSaveBtn').onclick = () => {
                    // Use the main updateTrainingData function
                    if (typeof updateTrainingData === 'function') {
                        updateTrainingData();
                    } else {
                        this.saveTemporaryModal(trainingData.id || trainingData.training_id);
                    }
                };
                
                // Close on background click
                document.getElementById('tempUpdateModal').onclick = (e) => {
                    if (e.target.id === 'tempUpdateModal') {
                        document.getElementById('tempUpdateModal').remove();
                    }
                };
                
                // Auto-format JSON in Environmental Factors textarea
                const envFactorsTextarea = document.getElementById('tempEnvironmentalFactors');
                if (envFactorsTextarea) {
                    console.log('📊 Temp Modal Environmental Factors:', envFactorsTextarea.value);
                    
                    // Check if it's placeholder text and clear it
                    const isExactPlaceholder = envFactorsTextarea.value === '{"notes": "Additional observations", "location": "Storage area", "conditions": "Normal"}' ||
                                              (envFactorsTextarea.value.includes('"notes": "Additional observations"') && 
                                               envFactorsTextarea.value.includes('"location": "Storage area"') && 
                                               envFactorsTextarea.value.includes('"conditions": "Normal"') &&
                                               !envFactorsTextarea.value.includes('gas_emission_analysis') &&
                                               !envFactorsTextarea.value.includes('storage_location'));
                    
                    if (isExactPlaceholder) {
                        console.log('🔄 Clearing placeholder from temp modal');
                        envFactorsTextarea.value = '';
                    } else {
                        console.log('✅ Showing current data in temp modal');
                    }
                    
                    // Auto-format listeners removed - user can enter text freely without automatic JSON formatting
                }
                
            },
            saveTemporaryModal(trainingId) {
                console.log('💾 Saving temporary modal data...');
                
                const formData = {
                    foodName: document.getElementById('tempFoodName').value,
                    category: document.getElementById('tempCategory').value,
                    temperature: parseFloat(document.getElementById('tempTemperature').value),
                    humidity: parseFloat(document.getElementById('tempHumidity').value),
                    ph: parseFloat(document.getElementById('tempPh').value),
                    actualStatus: document.getElementById('tempActualStatus').value,
                    source: document.getElementById('tempSource').value,
                    dataQuality: parseInt(document.getElementById('tempDataQuality').value)
                };
                
                // Validate form data
                if (!formData.foodName || !formData.category || !formData.actualStatus || !formData.source) {
                    alert('Please fill in all required fields');
                    return;
                }
                
                if (isNaN(formData.temperature) || isNaN(formData.humidity) || isNaN(formData.ph) || isNaN(formData.dataQuality)) {
                    alert('Please enter valid numeric values for temperature, humidity, pH, and data quality');
                    return;
                }
                
                // Show loading state
                const saveBtn = document.getElementById('tempSaveBtn');
                saveBtn.disabled = true;
                saveBtn.textContent = 'Updating...';
                
                // Send data to backend
                fetch(`/api/ml-training/update/${trainingId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token') || ''}`
                    },
                    body: JSON.stringify(formData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Success - close modal and refresh data
                        document.getElementById('tempUpdateModal').remove();
                        this.showToast('Training data updated successfully!', 'success');
                        
                        // Refresh ML data if function exists
                        if (typeof refreshMlData === 'function') {
                            refreshMlData();
                        }
                    } else {
                        throw new Error(data.message || 'Failed to update training data');
                    }
                })
                .catch(error => {
                    console.error('Error updating training data:', error);
                    alert('Error updating training data: ' + error.message);
                })
                .finally(() => {
                    // Reset button state
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Update Training Data';
                });
            },
            
            // Display environmental factors in user-friendly format
            displayUserFriendlyEnvFactors(jsonString, textareaElement) {
                try {
                    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
                    const cardsContainer = document.getElementById('envFactorsCards');
                    const displayDiv = document.getElementById('envFactorsDisplay');
                    const editorDiv = document.getElementById('envFactorsEditor');
                    const toggleBtn = document.getElementById('toggleEnvView');
                    
                    if (!cardsContainer || !displayDiv || !editorDiv) return;
                    
                    // Store original JSON for when switching back to editor
                    if (textareaElement) {
                        textareaElement.dataset.originalJson = jsonString;
                    }
                    
                    // Build user-friendly cards
                    let html = '';
                    
                    // AI Analysis Summary Card (if AI-generated)
                    if (data.ai_analysis || data.confidence !== undefined) {
                        const confidencePercent = data.confidence || 0;
                        const confidenceColor = confidencePercent >= 70 ? '#4CAF50' : confidencePercent >= 40 ? '#FF9800' : '#f44336';
                        html += `
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 14px; border-radius: 6px; margin-bottom: 10px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <div style="font-weight: bold; font-size: 15px; margin-bottom: 8px;">🤖 AI Analysis</div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-size: 13px; opacity: 0.9;">Confidence Level</div>
                                        <div style="font-size: 20px; font-weight: bold;">${confidencePercent}%</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 13px; opacity: 0.9;">Status</div>
                                        <div style="font-size: 16px; font-weight: bold; text-transform: uppercase;">${data.provided_status || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    
                    // Storage Conditions Card (with sensor readings)
                    if (data.storage_conditions) {
                        const sc = data.storage_conditions;
                        const timestamp = sc.timestamp ? formatTimestamp(sc.timestamp) : 'N/A';
                        html += `
                            <div style="background: white; padding: 14px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e0e0e0; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                                <div style="font-weight: bold; color: #333; margin-bottom: 10px; font-size: 14px;">📊 Storage Conditions</div>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                    <div style="background: #fff3e0; padding: 10px; border-radius: 4px; border-left: 3px solid #FF9800;">
                                        <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px;">🌡️ Temperature</div>
                                        <div style="font-size: 18px; font-weight: bold; color: #333;">${sc.temperature !== undefined ? sc.temperature + '°C' : 'N/A'}</div>
                                    </div>
                                    <div style="background: #e3f2fd; padding: 10px; border-radius: 4px; border-left: 3px solid #2196F3;">
                                        <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px;">💧 Humidity</div>
                                        <div style="font-size: 18px; font-weight: bold; color: #333;">${sc.humidity !== undefined ? Math.round(sc.humidity) + '%' : 'N/A'}</div>
                                    </div>
                                    <div style="background: #f3e5f5; padding: 10px; border-radius: 4px; border-left: 3px solid #9C27B0;">
                                        <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px;">🧪 Gas Level</div>
                                        <div style="font-size: 18px; font-weight: bold; color: #333;">${sc.gas_level !== undefined ? sc.gas_level + ' ppm' : 'N/A'}</div>
                                    </div>
                                    <div style="background: #fce4ec; padding: 10px; border-radius: 4px; border-left: 3px solid #E91E63;">
                                        <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px;">⏰ Timestamp</div>
                                        <div style="font-size: 11px; font-weight: 600; color: #333;">${timestamp}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    
                    // Storage Location Card
                    if (data.storage_location) {
                        html += `
                            <div style="background: white; padding: 12px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid #4CAF50;">
                                <div style="font-weight: bold; color: #333; margin-bottom: 4px;">📦 Storage Location</div>
                                <div style="color: #666;">${data.storage_location}</div>
                            </div>
                        `;
                    }
                    
                    // Observations/Notes Card
                    if (data.observations || data.notes) {
                        html += `
                            <div style="background: white; padding: 12px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid #2196F3;">
                                <div style="font-weight: bold; color: #333; margin-bottom: 4px;">📝 Observations</div>
                                <div style="color: #666;">${data.observations || data.notes}</div>
                            </div>
                        `;
                    }
                    
                    // Condition Card
                    if (data.condition || data.conditions) {
                        html += `
                            <div style="background: white; padding: 12px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid #FF9800;">
                                <div style="font-weight: bold; color: #333; margin-bottom: 4px;">🔍 Condition</div>
                                <div style="color: #666;">${data.condition || data.conditions}</div>
                            </div>
                        `;
                    }
                    
                    // Food Item Card
                    if (data.food_item) {
                        html += `
                            <div style="background: white; padding: 12px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid #9C27B0;">
                                <div style="font-weight: bold; color: #333; margin-bottom: 4px;">🍎 Food Item</div>
                                <div style="color: #666;">${data.food_item}</div>
                            </div>
                        `;
                    }
                    
                    // Gas Emission Analysis Card (if present)
                    if (data.gas_emission_analysis) {
                        const gas = data.gas_emission_analysis;
                        const riskLevel = (gas.risk_level || 'unknown').toLowerCase();
                        const riskColor = riskLevel === 'low' ? '#4CAF50' : riskLevel === 'medium' ? '#FF9800' : '#f44336';
                        const riskBg = riskLevel === 'low' ? '#e8f5e9' : riskLevel === 'medium' ? '#fff3e0' : '#ffebee';
                        const riskIcon = riskLevel === 'low' ? '✅' : riskLevel === 'medium' ? '⚠️' : '❌';
                        const statusIcon = (gas.status || '').toLowerCase() === 'safe' ? '🟢' : '🔴';
                        
                        html += `
                            <div style="background: ${riskBg}; padding: 14px; border-radius: 6px; margin-bottom: 10px; border: 2px solid ${riskColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                                <div style="font-weight: bold; color: #333; margin-bottom: 12px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                                    <span>🔬</span> Gas Emission Analysis
                                </div>
                                <div style="display: grid; gap: 10px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px; border-radius: 4px;">
                                        <div>
                                            <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 2px;">Risk Level</div>
                                            <div style="font-size: 16px; font-weight: bold; color: ${riskColor}; text-transform: uppercase;">${riskIcon} ${gas.risk_level || 'N/A'}</div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 2px;">Status</div>
                                            <div style="font-size: 16px; font-weight: bold; color: #333;">${statusIcon} ${gas.status || 'N/A'}</div>
                                        </div>
                                    </div>
                                    ${gas.probability !== undefined ? `
                                        <div style="background: white; padding: 10px; border-radius: 4px;">
                                            <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 6px;">Probability</div>
                                            <div style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
                                                <div style="background: ${riskColor}; height: 100%; width: ${gas.probability}%; transition: width 0.3s;"></div>
                                            </div>
                                            <div style="font-size: 12px; font-weight: 600; color: #333; margin-top: 4px;">${gas.probability}%</div>
                                        </div>
                                    ` : ''}
                                    ${gas.recommendation ? `
                                        <div style="background: white; padding: 10px; border-radius: 4px; border-left: 3px solid ${riskColor};">
                                            <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px;">💡 Recommendation</div>
                                            <div style="font-size: 12px; color: #444; line-height: 1.5;">${gas.recommendation}</div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }
                    
                    // If no common fields, show a generic card
                    if (!html) {
                        const entries = Object.entries(data).filter(([key]) => key !== 'gas_emission_analysis' && key !== 'provided_status' && key !== 'gas_emission_override');
                        if (entries.length > 0) {
                            html += `<div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #607D8B;">`;
                            entries.forEach(([key, value]) => {
                                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
                                html += `<div style="margin-bottom: 6px;"><strong>${displayKey}:</strong> ${displayValue}</div>`;
                            });
                            html += `</div>`;
                        }
                    }
                    
                    cardsContainer.innerHTML = html || '<div style="color: #888; text-align: center; padding: 20px;">No environmental data to display</div>';
                    
                    // Show user-friendly view by default
                    displayDiv.style.display = 'block';
                    editorDiv.style.display = 'none';
                    
                    // Toggle button functionality
                    if (toggleBtn) {
                        toggleBtn.onclick = () => {
                            if (displayDiv.style.display === 'none') {
                                displayDiv.style.display = 'block';
                                editorDiv.style.display = 'none';
                                toggleBtn.textContent = 'Switch to JSON';
                            } else {
                                displayDiv.style.display = 'none';
                                editorDiv.style.display = 'block';
                                toggleBtn.textContent = 'Switch to Cards';
                                
                                // Clear textarea for fresh plain text input
                                if (textareaElement) {
                                    textareaElement.value = '';
                                    textareaElement.placeholder = '💡 Describe the food condition:\n\nExamples:\n• "Fresh appearance, no visible damage"\n• "Slight browning on edges"\n• "Strong odor detected"\n• "Soft texture, minor discoloration"\n\n✨ AI will analyze and generate detailed recommendations for optimal food handling.';
                                    textareaElement.focus();
                                }
                            }
                        };
                    }
                    
                    // Edit button functionality
                    const editBtn = document.getElementById('editEnvFactors');
                    if (editBtn) {
                        editBtn.onclick = () => {
                            displayDiv.style.display = 'none';
                            editorDiv.style.display = 'block';
                            toggleBtn.textContent = 'Switch to Cards';
                            
                            // Clear textarea for fresh plain text input
                            if (textareaElement) {
                                textareaElement.value = '';
                                textareaElement.placeholder = '💡 Describe the food condition:\n\nExamples:\n• "Fresh appearance, no visible damage"\n• "Slight browning on edges"\n• "Strong odor detected"\n• "Soft texture, minor discoloration"\n\n✨ AI will analyze and generate detailed recommendations for optimal food handling.';
                                textareaElement.focus();
                            }
                        };
                    }
                } catch (error) {
                    console.error('Error displaying user-friendly env factors:', error);
                }
            },
            
            // Auto-format JSON in textarea with AI fallback
            async autoFormatJSON(textarea) {
                try {
                    const value = textarea.value.trim();
                    if (!value) return; // Empty, no need to format
                    
                    // Try to parse and re-stringify with formatting
                    const parsed = JSON.parse(value);
                    const formatted = JSON.stringify(parsed, null, 2);
                    
                    // Only update if different to avoid unnecessary cursor movement
                    if (textarea.value !== formatted) {
                        textarea.value = formatted;
                        
                        // Visual feedback
                        textarea.style.borderColor = '#4CAF50';
                        setTimeout(() => {
                            textarea.style.borderColor = '';
                        }, 500);
                    }
                } catch (error) {
                    // Invalid JSON - try AI formatting
                    console.warn('Invalid JSON detected, using AI to format:', error.message);
                    
                    // Show loading state
                    textarea.style.borderColor = '#2196F3';
                    const originalValue = textarea.value;
                    textarea.placeholder = '🤖 AI is formatting your text...';
                    
                    try {
                        // Call AI formatting endpoint
                        const response = await fetch('/api/ml-training/format-env-factors', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token') || ''}`
                            },
                            body: JSON.stringify({ text: originalValue })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success && result.json) {
                            // AI successfully formatted the text
                            textarea.value = result.json;
                            textarea.style.borderColor = '#4CAF50';
                            
                            // Toast notification removed as requested
                            
                            setTimeout(() => {
                                textarea.style.borderColor = '';
                            }, 1000);
                        } else {
                            throw new Error(result.message || 'AI formatting failed');
                        }
                    } catch (aiError) {
                        console.error('AI formatting error:', aiError);
                        // Restore original value and show error
                        textarea.value = originalValue;
                        textarea.style.borderColor = '#ff9800';
                        textarea.placeholder = 'Enter valid JSON or plain text (AI will format it)';
                        
                        if (window.showToastNotification) {
                            window.showToastNotification('⚠️ Could not format text. Try simpler input or valid JSON.', 'warning');
                        }
                        
                        setTimeout(() => {
                            textarea.style.borderColor = '';
                        }, 1500);
                    }
                }
            }
        };
    }
    // Global helper to refresh ML tables/kpis after adding data
    if (!window.refreshMlData) {
        window.refreshMlData = async function() {
            try {
                if (window.mlPredictionsManager && window.mlPredictionsManager._loadSamples) {
                    await window.mlPredictionsManager._loadSamples();
                }
                if (window.mlPredictionsManager && window.mlPredictionsManager.loadOverview) {
                    // Reload KPIs
                    await window.mlPredictionsManager.loadOverview();
                }
            } catch (e) { console.error('refreshMlData failed:', e); }
        };
    }
})();
