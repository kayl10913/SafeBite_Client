// Report Generator JavaScript
class ReportGenerator {
    constructor() {
        this.reportData = [];
        this.currentReportType = 'user-activity';
        this.currentDateRange = 'daily'; // Match the HTML default
        this.customStartDate = null;
        this.customEndDate = null;
        
        // Pagination variables for activity log
        this.currentPage = 1;
        this.recordsPerPage = 25;
        this.totalRecords = 0;
        this.totalPages = 1;
        
        // Flag to prevent auto-filtering when setting default values
        this.isSettingDefaultValue = false;
        
        // Store actual date range from database
        this.actualDateRange = null;
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing Report Generator - showing empty state by default');
        
        // Read initial values from HTML elements
        this.readInitialValues();
        
        this.loadReportData();
        this.setupEventListeners();
        this.showEmptyState();
        this.togglePaginationControls(); // Show/hide pagination controls
        this.fetchActualDateRange(); // Fetch actual date range from database
        console.log('✅ Report Generator initialized - user must click Generate Report to see data');
    }

    readInitialValues() {
        // Read initial values from HTML elements
        const reportTypeSelect = document.getElementById('userReportType');
        const dateRangeSelect = document.getElementById('userDateRange');
        
        if (reportTypeSelect) {
            this.currentReportType = reportTypeSelect.value;
            console.log('📊 Initial report type from HTML:', this.currentReportType);
        }
        
        if (dateRangeSelect) {
            this.currentDateRange = dateRangeSelect.value;
            console.log('📅 Initial date range from HTML:', this.currentDateRange);
        }
    }

    setupEventListeners() {
        // Report type change
        const reportTypeSelect = document.getElementById('userReportType');
        if (reportTypeSelect) {
            reportTypeSelect.addEventListener('change', (e) => {
                this.currentReportType = e.target.value;
                // Keep existing data visible - user must click Generate Report to update data
                console.log('📊 Report type changed to:', e.target.value, '- keeping existing data visible until Generate Report is clicked');
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
        const dateRangeSelect = document.getElementById('userDateRange');
        const customDateGroup = document.getElementById('customDateRangeGroup');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (dateRangeSelect) {
            dateRangeSelect.addEventListener('change', (e) => {
                this.currentDateRange = e.target.value;
                this.updateDateRangePickers();
                
                if (this.currentDateRange === 'custom') {
                    if (customDateGroup) customDateGroup.style.display = '';
                    // Set default dates to actual data range from database
                    if (!this.customStartDate && !this.customEndDate) {
                        let startDateStr, endDateStr;
                        if (this.actualDateRange && this.actualDateRange.earliest && this.actualDateRange.latest) {
                            startDateStr = this.actualDateRange.earliest;
                            endDateStr = this.actualDateRange.latest;
                        } else {
                            // Fallback to current date range (last 7 days)
                            const today = new Date();
                            const weekAgo = new Date(today);
                            weekAgo.setDate(today.getDate() - 7);
                            startDateStr = weekAgo.toISOString().split('T')[0];
                            endDateStr = today.toISOString().split('T')[0];
                        }
                        
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
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
                // Don't auto-refresh - user must click Generate Report button
                console.log('Date range changed to:', this.currentDateRange, '- user must click Generate Report to see data');
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
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
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
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
            });
        }

        // Week picker event listener
        const weekPicker = document.getElementById('weekPicker');
        if (weekPicker) {
            // Store the event handler function
            this.weekPickerHandler = (e) => {
                console.log('🔍 Week picker changed:', e.target.value);
                
                // Reset to first page when week changes
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
                // Keep existing data visible - user must click Generate Report to update data
                console.log('📊 Week picker changed - keeping existing data visible until Generate Report is clicked');
            };
            
            weekPicker.addEventListener('change', this.weekPickerHandler);
        }

        // Month picker event listener
        const monthPicker = document.getElementById('monthPicker');
        if (monthPicker) {
            // Store the event handler function
            this.monthPickerHandler = (e) => {
                console.log('🔍 Month picker changed:', e.target.value);
                
                // Reset to first page when month changes
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
                // Keep existing data visible - user must click Generate Report to update data
                console.log('📊 Month picker changed - keeping existing data visible until Generate Report is clicked');
            };
            
            monthPicker.addEventListener('change', this.monthPickerHandler);
        }

        // Year picker event listener
        const yearPicker = document.getElementById('yearPicker');
        if (yearPicker) {
            // Store the event handler function
            this.yearPickerHandler = (e) => {
                console.log('🔍 Year picker changed:', e.target.value);
                
                // Reset to first page when year changes
                if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
                    this.currentPage = 1;
                }
                // Keep existing data visible - user must click Generate Report to update data
                console.log('📊 Year picker changed - keeping existing data visible until Generate Report is clicked');
            };
            
            yearPicker.addEventListener('change', this.yearPickerHandler);
        }

        // Generate report button
        const generateBtn = document.getElementById('userGenerateReport');
        if (generateBtn) {
            console.log('✅ Generate Report button found and event listener attached');
            generateBtn.addEventListener('click', () => {
                console.log('🔘 Generate Report button clicked!');
                this.generateReport();
            });
        } else {
            console.error('❌ Generate Report button not found!');
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

    updateDateRangePickers() {
        console.log('🔄 updateDateRangePickers called for date range:', this.currentDateRange);
        
        const weekPickerGroup = document.getElementById('weekPickerGroup');
        const monthPickerGroup = document.getElementById('monthPickerGroup');
        const yearPickerGroup = document.getElementById('yearPickerGroup');
        
        // Hide all pickers first
        if (weekPickerGroup) weekPickerGroup.style.display = 'none';
        if (monthPickerGroup) monthPickerGroup.style.display = 'none';
        if (yearPickerGroup) yearPickerGroup.style.display = 'none';
        
        // Show appropriate picker based on date range
        switch (this.currentDateRange) {
            case 'weekly':
                if (weekPickerGroup) {
                    weekPickerGroup.style.display = 'block';
                    console.log('📅 Setting default week picker');
                    this.setDefaultWeekPicker();
                }
                break;
            case 'monthly':
                if (monthPickerGroup) {
                    monthPickerGroup.style.display = 'block';
                    console.log('📅 Setting default month picker');
                    this.setDefaultMonthPicker();
                }
                break;
            case 'yearly':
                if (yearPickerGroup) {
                    yearPickerGroup.style.display = 'block';
                    console.log('📅 Setting default year picker');
                    this.setDefaultYearPicker();
                }
                break;
        }
    }

    setDefaultWeekPicker() {
        const weekPicker = document.getElementById('weekPicker');
        if (weekPicker) {
            console.log('🔧 setDefaultWeekPicker called - setting current ISO week');
            const today = new Date();
            const year = today.getFullYear();
            const weekNumber = this.getWeekNumber(today);
            
            // Temporarily remove the event listener to prevent triggering change event
            if (this.weekPickerHandler) {
                weekPicker.removeEventListener('change', this.weekPickerHandler);
            }
            
            // Set the value
            weekPicker.value = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
            
            // Re-add the event listener
            if (this.weekPickerHandler) {
                weekPicker.addEventListener('change', this.weekPickerHandler);
            }
            
            console.log('✅ setDefaultWeekPicker completed - value set to:', weekPicker.value);
        } else {
            console.log('⏭️ setDefaultWeekPicker skipped - weekPicker not found');
        }
    }

    setDefaultMonthPicker() {
        const monthPicker = document.getElementById('monthPicker');
        if (monthPicker) {
            console.log('🔧 setDefaultMonthPicker called - setting current month');
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            
            // Temporarily remove the event listener to prevent triggering change event
            if (this.monthPickerHandler) {
                monthPicker.removeEventListener('change', this.monthPickerHandler);
            }
            
            // Set the value
            monthPicker.value = `${year}-${month}`;
            
            // Re-add the event listener
            if (this.monthPickerHandler) {
                monthPicker.addEventListener('change', this.monthPickerHandler);
            }
            
            console.log('✅ setDefaultMonthPicker completed - value set to:', monthPicker.value);
        } else {
            console.log('⏭️ setDefaultMonthPicker skipped - monthPicker not found');
        }
    }

    setDefaultYearPicker() {
        const yearPicker = document.getElementById('yearPicker');
        if (yearPicker) {
            console.log('🔧 setDefaultYearPicker called - setting default value');
            // Set to 2025 where your data exists
            
            // Temporarily remove the event listener to prevent triggering change event
            if (this.yearPickerHandler) {
                yearPicker.removeEventListener('change', this.yearPickerHandler);
            }
            
            // Set the value
            yearPicker.value = 2025;
            
            // Re-add the event listener
            if (this.yearPickerHandler) {
                yearPicker.addEventListener('change', this.yearPickerHandler);
            }
            
            console.log('✅ setDefaultYearPicker completed - value set to:', yearPicker.value);
        } else {
            console.log('⏭️ setDefaultYearPicker skipped - yearPicker not found');
        }
    }

    getWeekNumber(date) {
        // ISO week number (Monday-based). Week 1 is the week with Jan 4th.
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        // Thursday in current week decides the year.
        target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
        const week1 = new Date(target.getFullYear(), 0, 4);
        // Adjust to Thursday in week 1 and count number of weeks from week1 to target.
        const weekNumber =
            1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
        return weekNumber;
    }

    // Build a set of YYYY-MM-DD (local) strings for the selected range
    buildSelectedDaysSet() {
        const { startDate, endDate } = this.getDatesFromPicker();
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const days = new Set();
        const cur = new Date(start);
        while (cur <= end) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, '0');
            const d = String(cur.getDate()).padStart(2, '0');
            days.add(`${y}-${m}-${d}`);
            cur.setDate(cur.getDate() + 1);
        }
        return days;
    }

    // Compare an item's timestamp against the selected range using UTC date bucketing
    filterItemsByUTCDate(items, getTimestamp) {
        const daysSetLocal = this.buildSelectedDaysSet();
        const parseToDateUtc = (ts) => {
            if (!ts) return new Date('');
            if (ts instanceof Date) return ts;
            const s = String(ts).trim();
            // If ISO with timezone or Z, rely on Date
            if (s.includes('T') && (s.endsWith('Z') || /[\+\-]\d{2}:?\d{2}$/.test(s))) return new Date(s);
            // If ISO without TZ, treat as UTC by appending Z
            if (s.includes('T')) return new Date(s + 'Z');
            // If space separated "YYYY-MM-DD HH:MM:SS", convert to ISO and treat as UTC
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return new Date(s.replace(' ', 'T') + 'Z');
            // Fallback
            return new Date(s);
        };
        const formatUTC = (dt) => {
            const y = dt.getUTCFullYear();
            const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const d = String(dt.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        return items.filter(item => {
            const ts = getTimestamp(item);
            if (!ts) return false;
            const dt = parseToDateUtc(ts);
            if (isNaN(dt.getTime())) return false;
            // If the item's UTC date matches any local day in the picker range, include it
            return daysSetLocal.has(formatUTC(dt));
        });
    }

    getDatesFromPicker() {
        const today = new Date();
        let startDate, endDate;

        switch (this.currentDateRange) {
            case 'weekly':
                const weekPicker = document.getElementById('weekPicker');
                if (weekPicker && weekPicker.value) {
                    const [year, week] = weekPicker.value.split('-W');
                    startDate = this.getWeekStartDate(parseInt(year), parseInt(week));
                    endDate = this.getWeekEndDate(parseInt(year), parseInt(week));
                } else {
                    // Default to current ISO week (Monday-Sunday)
                    const currentWeek = this.getWeekNumber(today);
                    startDate = this.getWeekStartDate(today.getFullYear(), currentWeek);
                    endDate = this.getWeekEndDate(today.getFullYear(), currentWeek);
                }
                break;
            case 'monthly':
                const monthPicker = document.getElementById('monthPicker');
                if (monthPicker && monthPicker.value) {
                    const [year, month] = monthPicker.value.split('-');
                    startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                    endDate = new Date(parseInt(year), parseInt(month), 0);
                } else {
                    // Default to current month
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                }
                break;
            case 'yearly':
                const yearPicker = document.getElementById('yearPicker');
                if (yearPicker && yearPicker.value) {
                    const year = parseInt(yearPicker.value);
                    startDate = new Date(year, 0, 1);
                    endDate = new Date(year, 11, 31);
                } else {
                    // Default to current year
                    startDate = new Date(today.getFullYear(), 0, 1);
                    endDate = new Date(today.getFullYear(), 11, 31);
                }
                break;
            case 'daily':
                // Use current date (today) for daily reports
                startDate = new Date(today);
                endDate = new Date(today);
                console.log('📅 Daily range calculated:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
                break;
            case 'custom':
                if (this.customStartDate && this.customEndDate) {
                    startDate = new Date(this.customStartDate);
                    endDate = new Date(this.customEndDate);
                } else {
                    // Default to current date range (last 7 days)
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 7);
                    endDate = new Date(today);
                }
                break;
            default:
                // Default to current date range (last 7 days)
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                endDate = new Date(today);
        }

        return { startDate, endDate };
    }

    getWeekStartDate(year, week) {
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
        weekStart.setDate(week1Start.getDate() + (week - 1) * 7);
        weekStart.setHours(0, 0, 0, 0); // Ensure local start of day
        
        console.log(`📅 Week ${week}, ${year} starts:`, weekStart.toISOString().split('T')[0]);
        return weekStart;
    }

    getWeekEndDate(year, week) {
        const weekStart = this.getWeekStartDate(year, week);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999); // End of Sunday local time
        console.log(`📅 Week ${week}, ${year} ends:`, weekEnd.toISOString().split('T')[0]);
        return weekEnd;
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
            const sessionToken = localStorage.getItem('jwt_token') || 
                                 localStorage.getItem('sessionToken') || 
                                 localStorage.getItem('session_token');
            if (!sessionToken) return;

            // Always fetch a larger window from activity logs, then filter + paginate client-side
            const apiParams = new URLSearchParams({ limit: '1000', offset: '0' });
            const resp = await fetch(`/api/users/activity-report?${apiParams.toString()}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' }
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const rows = Array.isArray(json?.data) ? json.data : [];

            // Normalize from activity logs table
            const all = rows.map(r => ({
                logId: r['LOG ID'] ?? r.id ?? '',
                action: r['ACTION'] ?? r.action ?? '',
                timestamp: r['TIMESTAMP'] ?? r.timestamp ?? '',
                timestampRaw: r['TIMESTAMP'] ?? r.timestamp ?? ''
            }));

            // Date range filter (client-side, inclusive to end-of-day) with daily exact-date handling
            const { startDate, endDate } = this.getDatesFromPicker();
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);

            const formatLocal = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${da}`;
            };

            const isDaily = this.currentDateRange === 'daily';
            const dailyLocalStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;

            let filtered;
            if (isDaily) {
                filtered = all.filter(item => {
                    const ts = item.timestampRaw || item.timestamp;
                    if (!ts) return false;
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return false;
                    return formatLocal(d) === dailyLocalStr;
                });
            } else if (this.currentDateRange === 'weekly') {
                // Build set of 7 local date strings from start..end to avoid TZ edge cases
                const days = new Set();
                const cur = new Date(start);
                while (cur <= end) {
                    const y = cur.getFullYear();
                    const m = String(cur.getMonth() + 1).padStart(2, '0');
                    const da = String(cur.getDate()).padStart(2, '0');
                    days.add(`${y}-${m}-${da}`);
                    cur.setDate(cur.getDate() + 1);
                }
                filtered = all.filter(item => {
                    const ts = item.timestampRaw || item.timestamp;
                    if (!ts) return false;
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return false;
                    return days.has(formatLocal(d));
                });
            } else {
                filtered = all.filter(item => {
                    const ts = item.timestampRaw || item.timestamp;
                    if (!ts) return false;
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return false;
                    return d >= start && d <= end;
                });
            }

            // Pagination (client-side)
            this.totalRecords = filtered.length;
            this.recordsPerPage = parseInt(limit);
            this.currentPage = parseInt(page);
            this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.recordsPerPage));
            const startIdx = (this.currentPage - 1) * this.recordsPerPage;
            const pageSlice = filtered.slice(startIdx, startIdx + this.recordsPerPage);

            this.reportData['user-activity'] = pageSlice;

            if (filtered.length === 0) {
                this.showNoDataState();
                return;
            }
                
            if (autoRender && this.currentReportType === 'user-activity') {
                this.renderActivityLogReport();
            }
        } catch (error) {
            console.error('Error loading activity log data with filter:', error);
            this.showNoDataState();
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

            // Fetch a larger window and filter on the client similar to Alert Summary
            const response = await fetch(`/api/users/food-spoilage-report?limit=1000&offset=0`, {
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
            console.log('🔍 Food Spoilage API Response:', result);
            console.log('🔍 Raw data sample:', result.data?.[0]);
            
            if (result.success && result.data) {
                // Check if data is empty
                if (result.data.length === 0) {
                    this.showNoDataState();
                    return;
                }
                
                // Transform the data to match the expected format
                const allItems = result.data.map(item => ({
                    foodId: item.foodId || item['FOOD ID'] || '',
                    foodItem: item.foodItem || item['FOOD ITEM'] || '',
                    category: item.category || item['CATEGORY'] || '',
                    status: item.status || item['STATUS'] || '',
                    riskScore: item.riskScore || item['RISK SCORE'] || 0,
                    expiryDate: item.expiryDate || item['EXPIRY DATE'] || '',
                    sensorReadings: item.sensorReadings || item['SENSOR READINGS'] || '',
                    alertCount: item.alertCount || item['ALERT COUNT'] || 0,
                    _rawTs: item.expiryDate || item['EXPIRY DATE'] || item.lastUpdate || item['LAST UPDATE'] || ''
                }));
                // Client-side UTC date filtering (by expiryDate/lastUpdate when available)
                const filtered = this.filterItemsByUTCDate(allItems, (it) => it._rawTs);

                // Manual pagination
                this.totalRecords = filtered.length;
                this.recordsPerPage = parseInt(limit);
                this.currentPage = parseInt(page);
                this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.recordsPerPage));
                const startIdx = (this.currentPage - 1) * this.recordsPerPage;
                this.reportData['food-spoilage'] = filtered.slice(startIdx, startIdx + this.recordsPerPage);

                // Render if requested
                if (autoRender && this.currentReportType === 'food-spoilage') this.renderFoodSpoilageReport();
            } else {
                console.error('Failed to load food spoilage data:', result.error);
                this.showNoDataState();
            }
        } catch (error) {
            console.error('Error loading food spoilage data with filter:', error);
            this.showNoDataState();
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

            // Always fetch a larger window from alerts table, then filter + paginate client-side
            const apiParams = new URLSearchParams({ limit: '1000', offset: '0' });
            const resp = await fetch(`/api/alerts?${apiParams.toString()}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' }
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const rows = Array.isArray(json?.data) ? json.data : [];

            // Normalize from alerts table
            const normalizeStatus = (val) => {
                if (val === null || val === undefined) return 'Unresolved';
                const s = String(val).trim().toLowerCase();
                if (s === '1' || s === 'true' || s === 'resolved') return 'Resolved';
                if (s === '0' || s === 'false' || s === 'active' || s === 'unresolved') return 'Unresolved';
                return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unresolved';
            };

            const all = rows.map(r => ({
                alertId: r.alert_id,
                alertType: r.alert_type, // from alerts table
                severity: r.alert_level,
                location: r.food_name || 'Unknown Location', // join provided by backend
                message: r.message,
                timestamp: (r.timestamp ? new Date(r.timestamp).toLocaleString() : ''),
                timestampRaw: r.timestamp,
                status: normalizeStatus(r.is_resolved)
            }));

            // Date range filter (client-side, inclusive to end-of-day) with daily exact-date handling
            const { startDate, endDate } = this.getDatesFromPicker();
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);

            const formatUTC = (d) => {
                const y = d.getUTCFullYear();
                const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                const da = String(d.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${da}`;
            };

            const isDaily = this.currentDateRange === 'daily';
            const dailyUTCStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;

            let filtered;
            if (isDaily) {
                filtered = all.filter(item => {
                    const ts = item.timestampRaw || item.timestamp;
                    if (!ts) return false;
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return false;
                    return formatUTC(d) === dailyUTCStr;
                });
            } else if (this.currentDateRange === 'weekly') {
                // Build set of 7 local date strings from start..end to avoid TZ edge cases
                const days = new Set();
                const cur = new Date(start);
                while (cur <= end) {
                    const y = cur.getFullYear();
                    const m = String(cur.getMonth() + 1).padStart(2, '0');
                    const da = String(cur.getDate()).padStart(2, '0');
                    days.add(`${y}-${m}-${da}`);
                    cur.setDate(cur.getDate() + 1);
                }
                filtered = all.filter(item => {
                    const ts = item.timestampRaw || item.timestamp;
                    if (!ts) return false;
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return false;
                    return days.has(formatLocal(d));
                });
            } else {
                filtered = all.filter(item => {
                    const ts = item.timestampRaw || item.timestamp;
                    if (!ts) return false;
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return false;
                    return d >= start && d <= end;
                });
            }

            // Pagination (client-side)
            this.totalRecords = filtered.length;
            this.recordsPerPage = parseInt(limit);
            this.currentPage = parseInt(page);
            this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.recordsPerPage));
            const startIdx = (this.currentPage - 1) * this.recordsPerPage;
            const pageSlice = filtered.slice(startIdx, startIdx + this.recordsPerPage);

            this.reportData['alert-summary'] = pageSlice;

            if (filtered.length === 0) {
                    this.showNoDataState();
                    return;
                }
                
                if (autoRender && this.currentReportType === 'alert-summary') {
                    this.renderAlertSummaryReport();
            }
        } catch (error) {
            console.error('Error loading alert summary data with filter:', error);
            this.showNoDataState();
        }
    }

    renderPagination() {
        const paginationContainer = document.getElementById('reportPagination');
        console.log('🔍 renderPagination called - paginationContainer:', paginationContainer);
        console.log('🔍 Current report type:', this.currentReportType);
        console.log('🔍 Total pages:', this.totalPages, 'Total records:', this.totalRecords);
        
        if (!paginationContainer || (this.currentReportType !== 'user-activity' && this.currentReportType !== 'food-spoilage' && this.currentReportType !== 'alert-summary')) {
            console.log('❌ Pagination container not found or invalid report type');
            return;
        }
        
        if (this.totalRecords === 0) {
            console.log('📊 Hiding pagination - no records');
            paginationContainer.innerHTML = '';
            paginationContainer.style.display = 'none';
            return;
        }
        
        // Show pagination even for single page if there are records
        if (this.totalPages <= 1) {
            console.log('📊 Showing pagination for single page with', this.totalRecords, 'records');
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
        
        // Page numbers - always show individual page buttons
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
        paginationContainer.style.display = 'block';
        
        console.log('✅ Pagination HTML rendered and set to display: block');
        console.log('🔍 Pagination container display style:', paginationContainer.style.display);
        
        // Add event listeners to pagination buttons
        this.addPaginationEventListeners();
    }

    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            console.log('Page changed to:', page, '- loading data for new page');
            
            // Load data for the new page
            if (this.currentReportType === 'user-activity') {
                this.loadActivityLogDataWithFilter(this.currentPage, this.recordsPerPage, true);
            } else if (this.currentReportType === 'food-spoilage') {
                this.loadFoodSpoilageDataWithFilter(this.currentPage, this.recordsPerPage, true);
            } else if (this.currentReportType === 'alert-summary') {
                this.loadAlertSummaryDataWithFilter(this.currentPage, this.recordsPerPage, true);
            }
        }
    }

    changeRecordsPerPage(newLimit) {
        console.log('changeRecordsPerPage called with:', newLimit);
        this.recordsPerPage = parseInt(newLimit);
        this.currentPage = 1; // Reset to first page
        console.log('Updated recordsPerPage:', this.recordsPerPage, 'currentPage:', this.currentPage);
        
        // Don't automatically reload data - user must click Generate Report button
        console.log('Records per page changed - user must click Generate Report to see updated data');
    }

    renderActivityLogReport() {
        const tableBody = document.getElementById('userReportTableBody');
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
        console.log('📊 renderActivityLogReport calling renderPagination');
        this.renderPagination();

        // Show success notification
        this.showNotification('Activity log report generated successfully!', 'success');
    }

    renderFoodSpoilageReport() {
        const tableBody = document.getElementById('userReportTableBody');
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
        console.log('📊 renderFoodSpoilageReport calling renderPagination');
        this.renderPagination();

        // Show success notification
        this.showNotification('Food spoilage report generated successfully!', 'success');
    }


    renderAlertSummaryReport() {
        const tableBody = document.getElementById('userReportTableBody');
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
        console.log('📊 renderAlertSummaryReport calling renderPagination');
        this.renderPagination();

        // Show success notification
        this.showNotification('Alert summary report generated successfully!', 'success');
    }

    togglePaginationControls() {
        const recordsPerPageGroup = document.getElementById('recordsPerPageGroup');
        const paginationContainer = document.getElementById('reportPagination');
        
        console.log('togglePaginationControls - currentReportType:', this.currentReportType);
        
        if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
            if (recordsPerPageGroup) {
                recordsPerPageGroup.style.display = 'block';
                console.log('Showing records per page group');
            }
            // Don't force show pagination - let renderPagination() handle visibility based on data
            console.log('Pagination visibility will be controlled by renderPagination() based on data');
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
        if (!paginationContainer) {
            console.error('Pagination container not found!');
            return;
        }
        
        const buttons = paginationContainer.querySelectorAll('.pagination-btn');
        console.log('Adding event listeners to', buttons.length, 'pagination buttons');
        
        buttons.forEach((button, index) => {
            console.log(`Button ${index}:`, button.textContent.trim(), 'data-page:', button.dataset.page);
            
            // Remove any existing event listeners first
            button.replaceWith(button.cloneNode(true));
            const newButton = paginationContainer.querySelectorAll('.pagination-btn')[index];
            
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const page = parseInt(e.target.dataset.page);
                console.log('Pagination button clicked, page:', page);
                if (page && page >= 1 && page <= this.totalPages) {
                    this.goToPage(page);
                } else {
                    console.error('Invalid page number:', page);
                }
            });
        });
        
        console.log('✅ Event listeners added to', buttons.length, 'pagination buttons');
    }

    loadReportData() {
        // Initialize empty data structure - will be populated from API
        this.reportData = {
            'user-activity': [], // Will be populated from API
            'food-spoilage': [], // Will be populated from API
            'alert-summary': [] // Will be populated from API when implemented
        };
    }

    async fetchActualDateRange() {
        try {
            // Get session token for authentication
            const sessionToken = localStorage.getItem('jwt_token') || 
                                 localStorage.getItem('sessionToken') || 
                                 localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('No session token found');
                return;
            }

            // Fetch the actual date range from activity logs
            const response = await fetch('/api/users/activity-date-range', {
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
            
            if (result.success && result.dateRange) {
                this.actualDateRange = result.dateRange;
                console.log('📅 Actual date range from database:', this.actualDateRange);
                
                // Update default picker values with actual data
                this.updateDefaultPickersWithActualData();
            } else {
                console.warn('No date range data available, using fallback dates');
                // Use current date as fallback if no data available
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                this.actualDateRange = {
                    earliest: weekAgo.toISOString().split('T')[0],
                    latest: today.toISOString().split('T')[0],
                    year: today.getFullYear(),
                    month: today.getMonth() + 1,
                    week: this.getWeekNumber(today)
                };
            }
        } catch (error) {
            console.error('Error fetching actual date range:', error);
            // Use current date as fallback on error
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            this.actualDateRange = {
                earliest: weekAgo.toISOString().split('T')[0],
                latest: today.toISOString().split('T')[0],
                year: today.getFullYear(),
                month: today.getMonth() + 1,
                week: this.getWeekNumber(today)
            };
        }
    }

    updateDefaultPickersWithActualData() {
        if (!this.actualDateRange) return;

        // Update week picker (use current ISO week, not DB week to avoid drift)
        const weekPicker = document.getElementById('weekPicker');
        if (weekPicker && !weekPicker.value) {
            this.isSettingDefaultValue = true;
            const today = new Date();
            const wk = this.getWeekNumber(today);
            weekPicker.value = `${today.getFullYear()}-W${wk.toString().padStart(2, '0')}`;
            this.isSettingDefaultValue = false;
        }

        // Update month picker (use current month)
        const monthPicker = document.getElementById('monthPicker');
        if (monthPicker && !monthPicker.value) {
            this.isSettingDefaultValue = true;
            const today = new Date();
            monthPicker.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            this.isSettingDefaultValue = false;
        }

        // Update year picker
        const yearPicker = document.getElementById('yearPicker');
        if (yearPicker && !yearPicker.value) {
            this.isSettingDefaultValue = true;
            yearPicker.value = this.actualDateRange.year;
            this.isSettingDefaultValue = false;
        }

        console.log('📅 Updated default pickers with actual data:', {
            week: `${this.actualDateRange.year}-W${this.actualDateRange.week.toString().padStart(2, '0')}`,
            month: `${this.actualDateRange.year}-${this.actualDateRange.month.toString().padStart(2, '0')}`,
            year: this.actualDateRange.year
        });
    }

    clearAllReportData() {
        console.log('🧹 Clearing all report data');
        // Clear all report data arrays
        this.reportData = {
            'user-activity': [],
            'food-spoilage': [],
            'alert-summary': []
        };
        
        // Reset pagination
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalRecords = 0;
        
        console.log('✅ All report data cleared');
    }

    showEmptyState() {
        console.log('📊 Showing empty state - no data until Generate Report is clicked');
        const tableBody = document.getElementById('userReportTableBody');
        const tableHead = document.querySelector('.report-table thead tr');
        const reportTitle = document.getElementById('reportTitle');
        
        if (!tableBody || !tableHead || !reportTitle) {
            console.error('❌ Required elements not found for empty state');
            return;
        }

        // Update headers based on current report type
        this.updateTableHeaders(tableHead);

        // Get the number of columns for the current report type
        const columnCounts = {
            'user-activity': 3,
            'food-spoilage': 8,
            'alert-summary': 7
        };
        const columnCount = columnCounts[this.currentReportType] || 3;

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
        
        // Hide pagination when showing empty state
        const paginationContainer = document.getElementById('reportPagination');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
    }

    showNoDataState() {
        console.log('📊 showNoDataState() called for report type:', this.currentReportType);
        
        // Get the correct table body ID based on report type
        const tableBodyIds = {
            'user-activity': 'userReportTableBody',
            'food-spoilage': 'userReportTableBody', // Same table for now
            'alert-summary': 'userReportTableBody' // Same table for now
        };
        
        const tableBodyId = tableBodyIds[this.currentReportType] || 'userReportTableBody';
        const tableBody = document.getElementById(tableBodyId);
        const tableHead = document.querySelector('.report-table thead tr');
        const reportTitle = document.getElementById('reportTitle');
        
        console.log('🔍 Table elements found:', {
            tableBodyId: tableBodyId,
            tableBody: !!tableBody,
            tableHead: !!tableHead,
            reportTitle: !!reportTitle
        });
        
        if (!tableBody || !tableHead || !reportTitle) {
            console.error('❌ Required elements not found for no data state');
            return;
        }

        // Update headers based on current report type
        this.updateTableHeaders(tableHead);

        // Get the number of columns for the current report type
        const columnCounts = {
            'user-activity': 3,
            'food-spoilage': 8,
            'alert-summary': 7
        };
        const columnCount = columnCounts[this.currentReportType] || 3;

        // Get the selected date range for the message
        const { startDate, endDate } = this.getDatesFromPicker();
        const dateRangeText = this.getDateRangeText(startDate, endDate);

        console.log('📊 Showing no data state for:', {
            reportType: this.currentReportType,
            dateRange: dateRangeText,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        });

        // Clear any existing data first
        console.log('🧹 Clearing existing data before showing no data state');
        tableBody.innerHTML = '';
        
        // Clear the report data for this report type
        if (this.reportData[this.currentReportType]) {
            this.reportData[this.currentReportType] = [];
            console.log('🧹 Cleared report data for:', this.currentReportType);
        }

        // Clear table and show no data state
        tableBody.innerHTML = `
            <tr>
                <td colspan="${columnCount}" class="empty-state">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">📅</div>
                        <div class="empty-state-title">No Data Found</div>
                        <div class="empty-state-desc">No data available for the selected date range: ${dateRangeText}</div>
                    </div>
                </td>
            </tr>
        `;

        // Update title
        reportTitle.textContent = 'Report Generator';
        
        // Hide pagination when showing no data state
        const paginationContainer = document.getElementById('reportPagination');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
    }

    getDateRangeText(startDate, endDate) {
        const startStr = startDate.toLocaleDateString();
        const endStr = endDate.toLocaleDateString();
        
        if (startStr === endStr) {
            return startStr;
        } else {
            return `${startStr} - ${endStr}`;
        }
    }

    generateReport() {
        console.log('🔘 Generate Report button clicked - loading data for:', this.currentReportType);
        console.log('📅 Current date range:', this.currentDateRange);
        console.log('📄 Current page:', this.currentPage);
        console.log('📊 Records per page:', this.recordsPerPage);
        
        // Clear any existing data first
        console.log('🧹 Clearing all existing data before generating new report');
        this.clearAllReportData();
        
        // Show empty state first to clear previous data
        this.showEmptyState();
        
        if (this.currentReportType === 'user-activity') {
            // For activity logs, load data with current pagination and date filtering when generate is clicked
            this.loadActivityLogDataWithFilter(this.currentPage, this.recordsPerPage, false).then(() => {
                // Check if we have data - if not, showNoDataState was already called
                if (this.reportData['user-activity'] && this.reportData['user-activity'].length > 0) {
                    console.log('📊 Rendering activity log report with data');
                    this.renderActivityLogReport();
                } else {
                    console.log('📊 No data to render - showNoDataState should have been called');
                }
            });
        } else if (this.currentReportType === 'food-spoilage') {
            // For food spoilage, load data with current pagination and date filtering when generate is clicked
            this.loadFoodSpoilageDataWithFilter(this.currentPage, this.recordsPerPage, false).then(() => {
                // Check if we have data - if not, showNoDataState was already called
                if (this.reportData['food-spoilage'] && this.reportData['food-spoilage'].length > 0) {
                    console.log('📊 Rendering food spoilage report with data');
                    this.renderFoodSpoilageReport();
                } else {
                    console.log('📊 No data to render - showNoDataState should have been called');
                }
            });
        } else if (this.currentReportType === 'alert-summary') {
            // For alert summary, load data with current pagination and date filtering when generate is clicked
            this.loadAlertSummaryDataWithFilter(this.currentPage, this.recordsPerPage, false).then(() => {
                // Check if we have data - if not, showNoDataState was already called
                if (this.reportData['alert-summary'] && this.reportData['alert-summary'].length > 0) {
                    console.log('📊 Rendering alert summary report with data');
                    this.renderAlertSummaryReport();
                } else {
                    console.log('📊 No data to render - showNoDataState should have been called');
                }
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
                'alert-summary': 7
            };
            const columnCount = columnCounts[this.currentReportType] || 3;

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
            'food-spoilage': ['Food ID', 'Food Item', 'Category', 'Status', 'Risk Score', 'Expiry Date', 'Sensor Readings', 'Alerts'],
            'alert-summary': ['ALERT ID', 'ALERT TYPE', 'SEVERITY', 'LOCATION', 'MESSAGE', 'TIMESTAMP', 'STATUS']
        };

        const headerRow = headers[this.currentReportType] || [];
        tableHead.innerHTML = headerRow.map(header => `<th>${header}</th>`).join('');
    }

    generateTableRow(item) {
        switch (this.currentReportType) {
            case 'user-activity':
                return `
                    <td>${item['LOG ID'] || item.logId || ''}</td>
                    <td><span class="action-badge">${item['ACTION'] || item.action || ''}</span></td>
                    <td>${item['TIMESTAMP'] || item.timestamp || ''}</td>
                `;
            case 'food-spoilage':
                const alertCount = item.alertCount || 0;
                const alertText = alertCount === 0 ? 'No alerts' : `${alertCount} alert${alertCount > 1 ? 's' : ''}`;
                return `
                    <td>${item.foodId || ''}</td>
                    <td>${item.foodItem || ''}</td>
                    <td>${item.category || ''}</td>
                    <td><span class="status-badge ${(item.status || '').toLowerCase().replace(' ', '-')}">${item.status || ''}</span></td>
                    <td>${parseFloat(item.riskScore || 0).toFixed(1)}%</td>
                    <td>${item.expiryDate || ''}</td>
                    <td>${item.sensorReadings || ''}</td>
                    <td>${alertText}</td>
                `;
            case 'alert-summary':
                return `
                    <td>${item.alertId}</td>
                    <td>${item.alertType}</td>
                    <td><span class="severity-badge ${item.severity.toLowerCase()}">${item.severity}</span></td>
                    <td>${item.location}</td>
                    <td>${item.message}</td>
                    <td>${item.timestampRaw ? new Date(item.timestampRaw).toLocaleString() : (item.timestamp || '')}</td>
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
            'alert-summary': 'Alert Summary'
        };
        return reportTypes[this.currentReportType] || 'Report';
    }

    downloadExcel() {
        let data = this.reportData[this.currentReportType] || [];
        let filteredData = [];
        
        // For API-based reports, use the data directly
        if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
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
        try {
            // Check if jsPDF is available
            if (typeof window.jspdf === 'undefined') {
                this.showNotification('PDF export requires jsPDF library. Please refresh the page and try again.', 'error');
                return;
            }

        let data = this.reportData[this.currentReportType] || [];
        let filteredData = [];
        
        // For API-based reports, use the data directly
        if (this.currentReportType === 'user-activity' || this.currentReportType === 'food-spoilage' || this.currentReportType === 'alert-summary') {
            filteredData = data;
        } else {
            // For mock data, apply filtering
            filteredData = this.filterData(data);
        }
        
        if (filteredData.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }

            // Create PDF document with professional settings
            const doc = new window.jspdf.jsPDF({ 
                orientation: 'portrait', 
                unit: 'pt', 
                format: 'A4',
                compress: true
            });
            
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
            const reportTitle = this.getReportTitle();
            doc.text(reportTitle, 40, 55);
            
            // Reset text color for content
            doc.setTextColor(0, 0, 0);
            
            // Add report metadata in a professional box
            doc.setFillColor(248, 249, 250);
            doc.rect(40, 100, doc.internal.pageSize.width - 80, 50, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.rect(40, 100, doc.internal.pageSize.width - 80, 50, 'S');
            
            // Report info with better formatting
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            const currentDate = new Date().toLocaleDateString();
            const currentTime = new Date().toLocaleTimeString();
            doc.text(`Report Generated: ${currentDate} at ${currentTime}`, 50, 115);
            doc.text(`Total Records: ${filteredData.length}`, 50, 130);
            
            // Get filter values for report info
            const dateRange = document.getElementById('userDateRange')?.value || 'All';
            const reportType = document.getElementById('userReportType')?.value || 'All';
            doc.text(`Date Range: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`, 50, 145);
            doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 300, 145);
            
            // Prepare table data based on report type
            const tableConfig = this.getTableConfig();
            const tableData = filteredData.map(item => this.formatTableRowForPDF(item));
            
            // Calculate estimated total pages for better page numbering
            const recordsPerPage = 25; // Approximate records per page
            const estimatedTotalPages = Math.ceil(tableData.length / recordsPerPage) || 1;
            
            // Add professional table
            doc.autoTable({
                head: [tableConfig.headers],
                body: tableData,
                startY: 160,
                margin: { left: 40, right: 40 },
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    overflow: 'linebreak',
                    halign: 'left',
                    valign: 'middle',
                    lineColor: [200, 200, 200],
                    lineWidth: 0.5
                },
                headStyles: {
                    fillColor: [74, 158, 255],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 9,
                    halign: 'center'
                },
                alternateRowStyles: {
                    fillColor: [248, 249, 250]
                },
                columnStyles: tableConfig.columnStyles,
                didDrawPage: function (data) {
                    // Add page number
                    doc.setFontSize(8);
                    doc.setTextColor(128, 128, 128);
                    const pageCount = data.pageCount || data.totalPages || estimatedTotalPages || 1;
                    doc.text(`Page ${data.pageNumber} of ${pageCount}`, 
                             doc.internal.pageSize.width - 100, 
                             doc.internal.pageSize.height - 20);
                }
            });
            
            // Save the PDF
            const fileName = `SafeBite_${this.currentReportType.replace('-', '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            this.showNotification('PDF exported successfully!', 'success');
            
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showNotification('Failed to export PDF. Please try again.', 'error');
        }
    }

    getReportTitle() {
        const titles = {
            'user-activity': 'User Activity Report',
            'food-spoilage': 'Food Spoilage Report',
            'alert-summary': 'Alert Summary Report'
        };
        return titles[this.currentReportType] || 'Report';
    }

    getTableConfig() {
        const configs = {
            'user-activity': {
                headers: ['LOG ID', 'ACTION', 'TIMESTAMP'],
                columnStyles: {
                    0: { cellWidth: 50, halign: 'center' },   // LOG ID
                    1: { cellWidth: 300, halign: 'left' },    // ACTION
                    2: { cellWidth: 120, halign: 'center' }   // TIMESTAMP
                }
            },
            'food-spoilage': {
                headers: ['Food ID', 'Food Item', 'Category', 'Status', 'Risk Score', 'Expiry Date', 'Sensor Readings', 'Alerts'],
                columnStyles: {
                    0: { cellWidth: 60, halign: 'center' },   // Food ID
                    1: { cellWidth: 100, halign: 'left' },    // Food Item
                    2: { cellWidth: 70, halign: 'center' },   // Category
                    3: { cellWidth: 70, halign: 'center' },   // Status
                    4: { cellWidth: 70, halign: 'center' },   // Risk Score
                    5: { cellWidth: 80, halign: 'center' },   // Expiry Date
                    6: { cellWidth: 150, halign: 'left' },    // Sensor Readings
                    7: { cellWidth: 60, halign: 'center' }    // Alerts
                }
            },
            'alert-summary': {
                headers: ['Alert ID', 'Alert Type', 'Severity', 'Location', 'Message', 'Timestamp', 'Status'],
                columnStyles: {
                    0: { cellWidth: 70, halign: 'center' },   // Alert ID
                    1: { cellWidth: 90, halign: 'center' },   // Alert Type
                    2: { cellWidth: 70, halign: 'center' },   // Severity
                    3: { cellWidth: 120, halign: 'left' },    // Location
                    4: { cellWidth: 200, halign: 'left' },    // Message
                    5: { cellWidth: 120, halign: 'center' },  // Timestamp
                    6: { cellWidth: 70, halign: 'center' }    // Status
                }
            }
        };
        return configs[this.currentReportType] || { headers: [], columnStyles: {} };
    }

    formatTableRowForPDF(item) {
        switch (this.currentReportType) {
            case 'user-activity':
                return [
                    item['LOG ID'] || item.logId || '',
                    item['ACTION'] || item.action || '',
                    item['TIMESTAMP'] || (item.timestamp ? new Date(item.timestamp).toLocaleString() : '')
                ];
            case 'food-spoilage':
                const alertCount = item.alertCount || 0;
                const alertText = alertCount === 0 ? 'No alerts' : `${alertCount} alert${alertCount > 1 ? 's' : ''}`;
                const riskScore = item.riskScore || 0;
                const formattedRiskScore = `${parseFloat(riskScore).toFixed(1)}%`;
                const expiryDate = item.expiryDate || '';
                const formattedExpiry = expiryDate ? new Date(expiryDate).toLocaleDateString() : '';
                
                return [
                    item.foodId || '',
                    item.foodItem || '',
                    item.category || '',
                    item.status || '',
                    formattedRiskScore,
                    formattedExpiry,
                    item.sensorReadings || '',
                    alertText
                ];
            case 'alert-summary':
                return [
                    item.alertId || '',
                    item.alertType || '',
                    item.severity || '',
                    item.location || '',
                    item.message || '',
                    item.timestamp ? new Date(item.timestamp).toLocaleString() : '',
                    item.status || ''
                ];
            default:
                return [];
        }
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