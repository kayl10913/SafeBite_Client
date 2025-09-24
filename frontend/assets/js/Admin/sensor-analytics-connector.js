// Sensor Analytics Connector - Connects SensorAnalyticsAPI with Admin Dashboard
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
            
            // Format alerts badge
            const alertsClass = item.alertsToday > 0 ? '' : 'none';

        row.innerHTML = `
            <td><strong>${item.foodTester}</strong><br><span class="created-date">Registered: ${this.formatDate(item.registeredDate)}</span></td>
            <td><span class="cat-badge">${item.type}</span></td>
            <td><span class="status-badge status-${statusModifier}">${statusText}</span></td>
                <td>${this.formatDate(lastPing)}<br><span class="${pingClass}">${timeAgo}</span></td>
                <td>${item.lastReading || 'No data'}</td>
                <td><span class="alert-badge ${alertsClass}">${item.alertsToday} alerts</span></td>
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

// Lightweight ML Predictions Manager for SPA ML pages
(function(){
    if (!window.mlPredictionsManager) {
        window.mlPredictionsManager = {
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
                    set('mlKpiAccuracy', d.model_accuracy != null ? `${(Number(d.model_accuracy)*100).toFixed(1)}%` : '--%');
                    set('mlKpiAccuracySub', d.model_accuracy!=null ? '+ improved' : '');

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
                            <td>${new Date(r.created_at).toLocaleString()}</td>
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
                    this._samplesPage = this._samplesPage || 1;
                    this._samplesPageSize = this._samplesPageSize || 10;
                    if (countSpan) countSpan.textContent = allRows.length;
                    this._renderSamplesPage();
                    console.log(`Loaded ${allRows.length} training samples`);
                } catch (e) { 
                    console.error('ML samples load failed', e);
                    const tbody = document.getElementById('mlSamplesTableBody');
                    if (tbody) {
                        tbody.innerHTML = `
                            <tr><td colspan="6" style="color:#f87171;text-align:center;padding:20px;">
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
                if (!tbody) return;
                tbody.innerHTML = '';
                const rows = Array.isArray(this._samplesAll) ? this._samplesAll : [];
                const total = rows.length;
                if (total === 0) {
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    td.colSpan = 6; 
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
                slice.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${r.food_name || ''}<div style="color:#9fb2e6;font-size:12px;">${r.food_category||''}</div></td>
                        <td>🌡️ ${r.temperature}°C &nbsp; 💧 ${r.humidity}% &nbsp; 🧪 ${r.gas_level} ppm</td>
                        <td><span class="ml-badge ${String(r.actual_spoilage_status).toLowerCase()}">${String(r.actual_spoilage_status).toUpperCase()}</span></td>
                        <td><div class="ml-progress"><span style="width:${Math.round((r.quality_score||0)*100)}%"></span></div></td>
                        <td>${(r.data_source||'').toUpperCase()}</td>
                        <td>${new Date(r.created_at).toLocaleDateString()}</td>
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
            _authHeaders(){
                const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
                return token ? { 'Authorization': `Bearer ${token}` } : {};
            },
            setupEventListeners(){
                const retrain = document.getElementById('mlRetrain');
                if (retrain) retrain.addEventListener('click', ()=> alert('Retrain endpoint to be wired'));
                const exportBtn = document.getElementById('mlExport');
                if (exportBtn) exportBtn.addEventListener('click', ()=> alert('Export coming soon'));

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
            loadDetail(){ /* placeholder */ }
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
