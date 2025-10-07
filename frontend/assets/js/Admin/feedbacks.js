console.log('📜 Feedbacks.js file loaded successfully');

// js/feedbacks.js - Handles Feedbacks/Support Tickets interactivity

class FeedbacksManager {
    constructor() {
        console.log('🚀 FeedbacksManager constructor called');
        this.feedbacks = [];
        this.currentFilters = {};
        this.currentFeedbackId = null;
        this.init();
    }

    async init() {
        console.log('🔧 FeedbacksManager init() called');
        await this.loadStatistics();
        await this.loadFeedbacks();
        this.setupEventListeners();
        console.log('✅ FeedbacksManager initialization complete');
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/feedbacks/statistics/summary');
            const result = await response.json();
            
            if (result.success && result.data) {
                // Map summary keys into the structure updateStatisticsDisplay expects
                this.updateStatisticsDisplay({
                    total_feedbacks: result.data['Total'] || 0,
                    avg_rating: result.data['Avg Rating'] || 0,
                    positive_count: result.data['Positive'] || 0,
                    five_star_count: result.data['5 Stars'] || 0,
                    negative_count: result.data['Negative'] || 0,
                    recent_count: result.data['Recent (3d)'] || 0
                });
            } else {
                this.updateStatisticsDisplay({
                    total_feedbacks: 0,
                    avg_rating: 0,
                    positive_count: 0,
                    five_star_count: 0,
                    negative_count: 0,
                    recent_count: 0
                });
            }
        } catch (error) {
            console.error('Error loading feedback statistics:', error);
        }
    }

    async loadFeedbacks() {
        try {
            console.log('🔍 Starting to load feedbacks...');
            // Show loading state
            this.showLoadingState();
            
            // Get the current origin for the API call
            const baseUrl = window.location.origin;
            // Use endpoint that returns all user-submitted feedbacks (exclude Admin role) with exact aliases
            const apiUrl = `${baseUrl}/api/feedbacks/users/all-plain`;
            console.log('🌐 Using API URL:', apiUrl);
            
            let response = await fetch(apiUrl);
            console.log('📡 API Response:', response);
            
            let result = await response.json();
            console.log('📊 API Result:', result);
            console.log('📊 Result type:', typeof result);
            console.log('📊 Result.success:', result.success);
            console.log('📊 Result.data:', result.data);
            console.log('📊 Result.data type:', typeof result.data);
            console.log('📊 Result.data isArray:', Array.isArray(result.data));
            if (result.data) {
                console.log('📊 Result.data length:', result.data.length);
                console.log('📊 Result.data keys:', Object.keys(result.data));
            }
            
            if (result.success && result.data) {
                // Ensure data is an array
                if (Array.isArray(result.data)) {
                    this.feedbacks = result.data;
                    console.log('✅ Feedbacks loaded:', this.feedbacks);
                    this.updateFeedbacksTable();
                } else if (typeof result.data === 'object' && result.data !== null) {
                    // Handle case where single object is returned instead of array
                    console.log('⚠️ Single object received, converting to array');
                    this.feedbacks = [result.data];
                    console.log('✅ Feedbacks converted to array:', this.feedbacks);
                    this.updateFeedbacksTable();
                } else {
                    console.error('❌ API data is not an array or object:', result.data);
                    this.feedbacks = [];
                    this.showEmptyState('Invalid data format received');
                }
      } else {
                console.warn('⚠️ users/all failed; retrying generic endpoint /api/feedbacks');
                const fallbackUrl = `${baseUrl}/api/feedbacks`;
                response = await fetch(fallbackUrl);
                result = await response.json();
                if (result && result.success && Array.isArray(result.data)) {
                    this.feedbacks = result.data;
                    this.updateFeedbacksTable();
                } else {
                    console.error('❌ API returned success: false or no data');
                    this.feedbacks = [];
                    this.showEmptyState('Failed to load feedbacks');
                }
            }
        } catch (error) {
            console.error('💥 Error loading feedbacks:', error);
            this.feedbacks = [];
            this.showEmptyState('Error loading feedbacks');
        }
    }

    async filterFeedbacks(filters) {
        try {
            // Show loading state
            this.showLoadingState();
            
            const baseUrl = window.location.origin;

            // Decide best endpoint strategy
            const noOtherFilters = (
                (filters.customer_name == null || filters.customer_name === '') &&
                (filters.star_rating == null || filters.star_rating === '') &&
                (filters.sentiment == null || filters.sentiment === '') &&
                (filters.feedback_type == null || filters.feedback_type === '') &&
                (filters.priority == null || filters.priority === '') &&
                (filters.status == null || filters.status === '')
            );
            const onlyDateFilters = noOtherFilters && (filters.date_from || filters.date_to);
            const allTimeNoFilters = noOtherFilters && !filters.date_from && !filters.date_to;

            if (onlyDateFilters || allTimeNoFilters) {
                const qs = new URLSearchParams();
                if (filters.date_from) qs.append('date_from', filters.date_from);
                if (filters.date_to) qs.append('date_to', filters.date_to);
                const url = `${baseUrl}/api/feedbacks/users/all-plain${qs.toString() ? `?${qs.toString()}` : ''}`;
                const r = await fetch(url);
                const j = await r.json();
                const rows = Array.isArray(j.data) ? j.data : [];
                this.feedbacks = rows;
                this.updateFeedbacksTable();
                if (rows.length === 0) this.showEmptyState('No feedbacks match your date range');
                return;
            }

            const apiUrl = `${baseUrl}/api/feedbacks/users/filter`;
            console.log('🔍 Filtering feedbacks with URL:', apiUrl);
            console.log('🔍 Filter params:', filters);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    limit: this.currentFilters.records_per_page || 25,
                    offset: 0,
                    customer_name: filters.customer_name || null,
                    // Ensure dates are sent as YYYY-MM-DD strings
                    date_from: filters.date_from || null,
                    date_to: filters.date_to || null,
                    star_rating: filters.star_rating || null,
                    sentiment: filters.sentiment || null,
                    feedback_type: filters.feedback_type || null,
                    priority: filters.priority || null,
                    status: filters.status || null
                })
            });
            
            const result = await response.json();
            
            if (result && result.success) {
                const rows = Array.isArray(result.data)
                    ? result.data
                    : (result && result.data && Array.isArray(result.data.rows) ? result.data.rows : []);

                this.feedbacks = rows;
                this.updateFeedbacksTable();
                
                if (!Array.isArray(rows) || rows.length === 0) {
                    this.showEmptyState('No feedbacks match your filters');
                }
            } else {
                this.feedbacks = [];
                this.showEmptyState('Failed to filter feedbacks');
            }
        } catch (error) {
            console.error('Error filtering feedbacks:', error);
            this.showEmptyState('Error filtering feedbacks');
        }
    }

    updateStatisticsDisplay(stats) {
        // Update statistics cards
        const totalElement = document.querySelector('.feedbacks-stat-card .stat-value');
        if (totalElement) {
            totalElement.textContent = stats.total_feedbacks || 0;
        }

        const avgRatingElement = document.querySelector('.stat-rating');
        if (avgRatingElement) {
            avgRatingElement.textContent = stats.avg_rating || '0.0';
        }

        const positiveElement = document.querySelector('.feedbacks-stat-card:nth-child(3) .stat-value');
        if (positiveElement) {
            positiveElement.textContent = stats.positive_count || 0;
        }

        const fiveStarElement = document.querySelector('.feedbacks-stat-card:nth-child(4) .stat-value');
        if (fiveStarElement) {
            fiveStarElement.textContent = stats.five_star_count || 0;
        }

        const negativeElement = document.querySelector('.feedbacks-stat-card:nth-child(5) .stat-value');
        if (negativeElement) {
            negativeElement.textContent = stats.negative_count || 0;
        }

        const recentElement = document.querySelector('.feedbacks-stat-card:nth-child(6) .stat-value');
        if (recentElement) {
            recentElement.textContent = stats.recent_count || 0;
        }

        // Update feedbacks count in header
        const feedbacksLink = document.querySelector('.feedbacks-tickets-link');
        if (feedbacksLink) {
            feedbacksLink.textContent = `${stats.total_feedbacks || 0} feedbacks`;
        }
    }

    updateFeedbacksTable() {
        console.log('🔄 Updating feedbacks table...');
        const tbody = document.querySelector('.feedbacks-table tbody');
        const pagination = document.getElementById('feedbacksPagination');
        const pageInfo = document.getElementById('feedbacksPageInfo');
        const pageControls = document.getElementById('feedbacksPageControls');
        if (!tbody) {
            console.error('❌ Table body not found!');
            return;
        }

        console.log('📋 Found table body, clearing and populating...');
        tbody.innerHTML = '';

        // Ensure this.feedbacks is an array
        if (!Array.isArray(this.feedbacks)) {
            console.error('❌ this.feedbacks is not an array:', this.feedbacks);
            this.feedbacks = [];
        }

        if (this.feedbacks.length === 0) {
            console.log('📭 No feedbacks to display');
            this.showEmptyState('No feedbacks found');
            if (pagination) pagination.style.display = 'none';
            return;
        }

        console.log(`🎯 Creating ${this.feedbacks.length} table rows...`);
        this.feedbacks.forEach((feedback, index) => {
            console.log(`📝 Creating row ${index + 1}:`, feedback);
            const row = this.createFeedbackRow(feedback);
            tbody.appendChild(row);
        });
        
        console.log('✅ Table updated successfully');
        // Toggle pagination visibility
        if (pagination) {
            const total = this.feedbacks.length;
            pagination.style.display = total > 0 ? '' : 'none';
            const limit = this.currentFilters.records_per_page || total;
            const offset = 0;
            const start = total === 0 ? 0 : offset + 1;
            const end = Math.min(offset + limit, total);
            if (pageInfo) pageInfo.textContent = `Showing ${start} to ${end} of ${total} records`;
            if (pageControls) {
                pageControls.innerHTML = '';
                const btn = document.createElement('button');
                btn.textContent = '1';
                btn.className = 'pagination-btn active';
                pageControls.appendChild(btn);
            }
        }
    }

    createFeedbackRow(feedback) {
        const row = document.createElement('tr');
        
        // Feedback ID (supports both raw field and aliased column)
        const feedbackIdValue = (typeof feedback['FEEDBACK ID'] !== 'undefined') ? feedback['FEEDBACK ID'] : feedback.feedback_id;
        const feedbackId = document.createElement('td');
        feedbackId.textContent = feedbackIdValue;
        
        // Feedback Text
        const feedbackText = document.createElement('td');
        feedbackText.innerHTML = `<b>${(feedback['FEEDBACK TEXT'] || '')}</b>`;
        
        // Feedback Type
        const feedbackType = document.createElement('td');
        feedbackType.innerHTML = `<span class="badge badge-type">${(feedback['FEEDBACK TYPE'] || '')}</span>`;
        
        // Customer Name
        const customerName = document.createElement('td');
        customerName.innerHTML = `<b>${(feedback['CUSTOMER NAME'] || '')}</b>`;
        
        // Customer Email
        const customerEmail = document.createElement('td');
        customerEmail.textContent = (feedback['CUSTOMER EMAIL'] || 'N/A');
        
        // Priority
        const priority = document.createElement('td');
        const priorityClass = this.getPriorityClass(feedback['PRIORITY']);
        const priorityDisplay = (feedback['PRIORITY'] || '').toString().toLowerCase();
        priority.innerHTML = `<span class="badge badge-priority ${priorityClass}">${(feedback.priority_icon || '')} ${priorityDisplay}</span>`;
        
        // Star Rating
        const starRating = document.createElement('td');
        if (typeof feedback['STAR RATE'] !== 'undefined' && feedback['STAR RATE'] !== null && feedback['STAR RATE'] !== '') {
            starRating.innerHTML = `<span class="badge badge-rating">${feedback['STAR RATE']}</span>`;
        } else {
            starRating.innerHTML = '<span class="badge badge-neutral">N/A</span>';
        }
        
        // Sentiment
        const sentiment = document.createElement('td');
        if (feedback['SENTIMENT']) {
            const sentimentClass = feedback['SENTIMENT'] === 'Positive' ? 'positive' : 
                                 feedback['SENTIMENT'] === 'Negative' ? 'negative' : 'neutral';
            sentiment.innerHTML = `<span class="badge badge-${sentimentClass}">${feedback['SENTIMENT']}</span>`;
        } else {
            sentiment.innerHTML = '<span class="badge badge-neutral">N/A</span>';
        }
        
        // Status
        const status = document.createElement('td');
        const statusClass = this.getStatusClass(feedback['STATUS']);
        status.innerHTML = `<span class="badge badge-status ${statusClass}">${(feedback['STATUS'] || '')}</span>`;
        
        // Action
        const action = document.createElement('td');
        if (feedbackIdValue) {
            action.innerHTML = `<button class="action-btn" onclick="window.feedbacksManager.openResponseModal(${feedbackIdValue})">📝 Respond</button>`;
        } else {
            action.innerHTML = `<button class="action-btn" disabled title="No ID">📝 Respond</button>`;
        }

        row.appendChild(feedbackId);
        row.appendChild(feedbackText);
        row.appendChild(feedbackType);
        row.appendChild(customerName);
        row.appendChild(customerEmail);
        row.appendChild(priority);
        row.appendChild(starRating);
        row.appendChild(sentiment);
        row.appendChild(status);
        row.appendChild(action);

        return row;
    }

    getPriorityClass(priority) {
        switch (priority) {
            case 'Critical': return 'badge-critical';
            case 'High': return 'badge-high';
            case 'Medium': return 'badge-medium';
            case 'Low': return 'badge-low';
            default: return 'badge-low';
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'Active': return 'badge-active';
            case 'Resolved': return 'badge-resolved';
            case 'Archived': return 'badge-archived';
            default: return 'badge-active';
        }
    }

    openResponseModal(feedbackId) {
        // Support both aliased key "FEEDBACK ID" and raw key "feedback_id"
        const feedback = this.feedbacks.find(f => {
            const idAliased = typeof f['FEEDBACK ID'] !== 'undefined' ? Number(f['FEEDBACK ID']) : null;
            const idRaw = typeof f.feedback_id !== 'undefined' ? Number(f.feedback_id) : null;
            return idAliased === Number(feedbackId) || idRaw === Number(feedbackId);
        });
        if (!feedback) return;

        this.currentFeedbackId = feedbackId;
        
        // Populate modal with feedback details
        document.getElementById('modalFeedbackText').textContent = feedback['FEEDBACK TEXT'] || feedback.feedback_text || '';
        document.getElementById('modalCustomerName').textContent = feedback['CUSTOMER NAME'] || feedback.customer_name || '';
        document.getElementById('modalFeedbackType').textContent = feedback['FEEDBACK TYPE'] || feedback.feedback_type || '';
        document.getElementById('modalPriority').textContent = feedback['PRIORITY'] || feedback.priority || '';
        
        // Set current values
        document.getElementById('responseStatus').value = feedback['STATUS'] || feedback.status || 'Active';
        
        // Show current response text
        const currentResponseText = feedback.response_text || feedback['RESPONSE TEXT'] || '';
        const currentResponseElement = document.getElementById('currentResponseText');
        if (currentResponseText) {
            currentResponseElement.textContent = currentResponseText;
            currentResponseElement.style.fontStyle = 'normal';
            currentResponseElement.style.color = '#e0e6f6';
        } else {
            currentResponseElement.textContent = 'No response sent yet';
            currentResponseElement.style.fontStyle = 'italic';
            currentResponseElement.style.color = '#bfc9da';
        }
        
        document.getElementById('responseText').value = '';
        
        // Add keyboard event listener for ESC key
        this.escKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeResponseModal();
            }
        };
        document.addEventListener('keydown', this.escKeyHandler);
        
        // Show modal
        document.getElementById('responseModal').style.display = 'block';
    }

    closeResponseModal() {
        document.getElementById('responseModal').style.display = 'none';
        this.currentFeedbackId = null;
        
        // Remove keyboard event listener
        if (this.escKeyHandler) {
            document.removeEventListener('keydown', this.escKeyHandler);
            this.escKeyHandler = null;
        }
    }

    async saveResponse() {
        if (!this.currentFeedbackId) return;

        const status = document.getElementById('responseStatus').value;
        const responseText = document.getElementById('responseText').value;

        // Validate that response text is provided
        if (!responseText.trim()) {
            this.showToast('Please enter a response to the customer.', 'warning');
            return;
        }

        try {
            const success = await this.updateFeedbackStatus(
                this.currentFeedbackId, 
                status, 
                responseText
            );

            if (success) {
                this.closeResponseModal();
                // Refresh data
                await this.loadFeedbacks();
                await this.loadStatistics();
                this.showToast('Response saved successfully!', 'success');
            } else {
                this.showToast('Failed to save response. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error saving response:', error);
            this.showToast('Error saving response. Please try again.', 'error');
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('feedback-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.currentFilters.customer_name = searchInput.value || null;
                // Auto-apply only when Date Range is All Time
                if (!dateRangeSelect || dateRangeSelect.value === 'all') {
                    this.applyFilters();
                }
            }, 300));
        }

        // Date filters
        const dateFromInput = document.getElementById('feedback-date-from');
        const dateToInput = document.getElementById('feedback-date-to');
        const dateRangeSelect = document.getElementById('feedbackDateRange');
        const customDateGroup = document.getElementById('feedbackCustomDateGroup');
        const weekGroup = document.getElementById('feedbackWeekGroup');
        const weekInput = document.getElementById('feedbackWeekPicker');
        const monthGroup = document.getElementById('feedbackMonthGroup');
        const monthInput = document.getElementById('feedbackMonthPicker');
        const yearGroup = document.getElementById('feedbackYearGroup');
        const yearInput = document.getElementById('feedbackYearPicker');

        const setRange = (range) => {
            const today = new Date();
            let start = null;
            let end = null;
            if (range === 'daily') {
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                end = new Date(start);
            } else if (range === 'weekly') {
                if (weekGroup) weekGroup.style.display = '';
                // If a week is chosen (YYYY-Www), compute start (Mon) and end (Sun)
                if (weekInput && weekInput.value) {
                    const [yearStr, weekStr] = weekInput.value.split('-W');
                    const year = parseInt(yearStr, 10);
                    const week = parseInt(weekStr, 10);
                    // ISO week: week 1 is the week with Jan 4th; start Monday
                    const jan4 = new Date(year, 0, 4);
                    const jan4Day = (jan4.getDay() || 7); // 1..7
                    const mondayOfWeek1 = new Date(jan4);
                    mondayOfWeek1.setDate(jan4.getDate() - (jan4Day - 1));
                    start = new Date(mondayOfWeek1);
                    start.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                } else {
                    // fallback: current week
                    const day = today.getDay();
                    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                    start = new Date(today.getFullYear(), today.getMonth(), diff);
                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                }
            } else if (range === 'monthly') {
                if (monthGroup) monthGroup.style.display = '';
                let year = today.getFullYear();
                let month = today.getMonth(); // 0..11
                if (monthInput && monthInput.value) {
                    const [y, m] = monthInput.value.split('-');
                    year = parseInt(y, 10);
                    month = parseInt(m, 10) - 1;
                }
                start = new Date(year, month, 1);
                end = new Date(year, month + 1, 0);
            } else if (range === 'yearly') {
                if (yearGroup) yearGroup.style.display = '';
                let year = today.getFullYear();
                if (yearInput && yearInput.value) {
                    year = parseInt(yearInput.value, 10) || year;
                }
                start = new Date(year, 0, 1);
                end = new Date(year, 11, 31);
            }

            if (range === 'custom') {
                if (customDateGroup) customDateGroup.style.display = '';
                if (weekGroup) weekGroup.style.display = 'none';
                return; // wait for manual input
            } else {
                if (customDateGroup) customDateGroup.style.display = 'none';
                if (weekGroup) weekGroup.style.display = (range === 'weekly' ? '' : 'none');
                if (monthGroup) monthGroup.style.display = (range === 'monthly' ? '' : 'none');
                if (yearGroup) yearGroup.style.display = (range === 'yearly' ? '' : 'none');
            }

            // Format date in local timezone as YYYY-MM-DD to avoid UTC off-by-one
            const fmt = (d) => d ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
                .toLocaleDateString('en-CA') : null;
            this.currentFilters.date_from = start ? fmt(start) : null;
            this.currentFilters.date_to = end ? fmt(end) : null;
            if (dateFromInput) dateFromInput.value = this.currentFilters.date_from || '';
            if (dateToInput) dateToInput.value = this.currentFilters.date_to || '';
        };

        if (dateRangeSelect) {
            dateRangeSelect.addEventListener('change', () => {
                const val = dateRangeSelect.value;
                if (val === 'all') {
                    if (customDateGroup) customDateGroup.style.display = 'none';
                    if (weekGroup) weekGroup.style.display = 'none';
                    if (monthGroup) monthGroup.style.display = 'none';
                    if (yearGroup) yearGroup.style.display = 'none';
                    this.currentFilters.date_from = null;
                    this.currentFilters.date_to = null;
                    if (dateFromInput) dateFromInput.value = '';
                    if (dateToInput) dateToInput.value = '';
                    this.applyFilters();
                } else {
                    setRange(val);
                    // Do NOT auto-apply for non-All ranges; wait for Filter button
                }
            });
        }

        if (weekInput) {
            weekInput.addEventListener('change', () => {
                if (dateRangeSelect && dateRangeSelect.value === 'weekly') {
                    setRange('weekly');
                }
            });
        }

        if (monthInput) {
            monthInput.addEventListener('change', () => {
                if (dateRangeSelect && dateRangeSelect.value === 'monthly') {
                    setRange('monthly');
                }
            });
        }

        if (yearInput) {
            yearInput.addEventListener('change', () => {
                if (dateRangeSelect && dateRangeSelect.value === 'yearly') {
                    setRange('yearly');
                }
            });
        }

        if (dateFromInput) {
            dateFromInput.addEventListener('change', () => {
                this.currentFilters.date_from = dateFromInput.value || null;
                if (!dateRangeSelect || dateRangeSelect.value === 'all') {
                    this.applyFilters();
                }
            });
        }

        if (dateToInput) {
            dateToInput.addEventListener('change', () => {
                this.currentFilters.date_to = dateToInput.value || null;
                if (!dateRangeSelect || dateRangeSelect.value === 'all') {
                    this.applyFilters();
                }
            });
        }

        // Star rating filter
        const starRatingSelect = document.querySelector('.feedbacks-filter-select');
        if (starRatingSelect) {
            starRatingSelect.addEventListener('change', () => {
                const value = starRatingSelect.value;
                this.currentFilters.star_rating = value === 'All Ratings' ? null : parseInt(value);
                if (!dateRangeSelect || dateRangeSelect.value === 'all') {
                    this.applyFilters();
                }
            });
        }

        // Sentiment filter
        const sentimentSelect = document.querySelectorAll('.feedbacks-filter-select')[1];
        if (sentimentSelect) {
            sentimentSelect.addEventListener('change', () => {
                const value = sentimentSelect.value;
                this.currentFilters.sentiment = value === 'All' ? null : value;
                if (!dateRangeSelect || dateRangeSelect.value === 'all') {
                    this.applyFilters();
                }
            });
        }

        // Records per Page
        const recordsSelect = document.getElementById('feedbackRecordsPerPage');
        if (recordsSelect) {
            recordsSelect.addEventListener('change', () => {
                const value = parseInt(recordsSelect.value, 10);
                this.currentFilters.records_per_page = isNaN(value) ? 25 : value;
                if (!dateRangeSelect || dateRangeSelect.value === 'all') {
                    this.applyFilters();
                }
            });
            // initialize
            this.currentFilters.records_per_page = parseInt(recordsSelect.value, 10) || 25;
        }

        // Apply button
        const applyBtn = document.getElementById('applyFeedbackFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                // Recompute date range in case user changed pickers without blur
                const currentRange = dateRangeSelect ? dateRangeSelect.value : 'all';
                if (currentRange && currentRange !== 'all') {
                    setRange(currentRange);
                }
                this.applyFilters();
            });
        }

        // Export buttons
        const exportExcelBtn = document.getElementById('export-feedbacks-excel');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        }

        const exportPdfBtn = document.getElementById('export-feedbacks-pdf');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportToPdf());
        }
    }

    applyFilters() {
        this.filterFeedbacks(this.currentFilters);
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

    exportToExcel() {
        // Implementation for Excel export
        console.log('Exporting to Excel...');
        // You can implement actual Excel export logic here
    }

    exportToPdf() {
        // Implementation for PDF export
        console.log('Exporting to PDF...');
        // You can implement actual PDF export logic here
    }

    async updateFeedbackStatus(feedbackId, status, responseText) {
        try {
            const response = await fetch(`/api/feedbacks/${feedbackId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status,
                    response_text: responseText,
                    resolved_by: 1 // You can get this from current admin session
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error updating feedback:', error);
            return false;
        }
    }

    showLoadingState() {
        const tbody = document.querySelector('.feedbacks-table tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #bfc9da;">
                        <div style="font-size: 16px;">Loading feedbacks...</div>
                    </td>
                </tr>
            `;
        }
    }

    showEmptyState(message) {
        const tbody = document.querySelector('.feedbacks-table tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding: 48px 16px;">
                        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:#bfc9da;">
                            <div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:#1e2a4f;border-radius:12px;border:1px solid #2b3a66;">
                                <span style="font-size:28px;">📈</span>
                            </div>
                            <div style="font-size:16px;font-weight:600;">No Data Available</div>
                            <div style="font-size:13px;color:#7f8c8d;">${message || 'No available data.'}</div>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            success: { bg: '#10b981', icon: '✅' },
            error: { bg: '#ef4444', icon: '❌' },
            warning: { bg: '#f59e0b', icon: '⚠️' },
            info: { bg: '#3b82f6', icon: 'ℹ️' }
        };
        
        const config = colors[type] || colors.info;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${config.bg};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 400px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease-out;
        `;
        
        toast.innerHTML = `
            <span style="font-size: 16px;">${config.icon}</span>
            <span>${message}</span>
        `;
        
        // Add animation keyframes if not already added
        if (!document.getElementById('toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
}

// Make FeedbacksManager globally available
window.FeedbacksManager = FeedbacksManager;
console.log('🌐 FeedbacksManager class made globally available');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 DOM Content Loaded');
    const feedbacksContainer = document.querySelector('.feedbacks-container');
    console.log('🔍 Looking for .feedbacks-container:', feedbacksContainer);
    
    if (feedbacksContainer) {
        console.log('✅ Found feedbacks container, creating FeedbacksManager');
        window.feedbacksManager = new FeedbacksManager();
    } else {
        console.log('❌ Feedbacks container not found');
    }
});

// Global functions for modal
function openResponseModal(feedbackId) {
    if (window.feedbacksManager) {
        window.feedbacksManager.openResponseModal(feedbackId);
    }
}

function closeResponseModal() {
    if (window.feedbacksManager) {
        window.feedbacksManager.closeResponseModal();
    }
}

function saveResponse() {
    if (window.feedbacksManager) {
        window.feedbacksManager.saveResponse();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeedbacksManager;
} 