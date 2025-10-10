// Feedback Center JavaScript
class FeedbackCenter {
  constructor() {
    this.currentPage = 1;
    this.recordsPerPage = this.getRecordsPerPageFromUI();
    this.currentView = 'table'; // Track current view: 'table' or 'cards'
    this.currentFilters = {
      search: '',
      type: '',
      priority: '',
      status: ''
    };
    this.feedbackData = [];
    
    this.init();
  }

  getRecordsPerPageFromUI() {
    const recordsPerPageSelect = document.getElementById('feedbackRecordsPerPage');
    if (recordsPerPageSelect) {
      return parseInt(recordsPerPageSelect.value) || 6;
    }
    return 6; // Default to 6 if not found
  }

  updateRecordsPerPage(newValue) {
    this.recordsPerPage = parseInt(newValue) || 6;
    this.currentPage = 1; // Reset to first page
    
    // Refresh the current view
    this.renderTable();
    this.renderCards();
    
    // Re-render pagination
    const filteredData = this.getFilteredData();
    this.renderPagination(filteredData.length);
  }

  async init() {
    this.bindEvents();
    this.prefillUserContactFields();
    await Promise.all([
      this.loadFeedbacks().catch(() => {})
    ]);
    // If no user feedbacks loaded, try global summary as a fallback
    if (!this.feedbackData || this.feedbackData.length === 0) {
      await this.loadStats().catch(() => {});
    }
    this.updateStats();
    this.renderTable();
  }

  bindEvents() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.feedback-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.closest('.feedback-tab').dataset.tab;
        this.switchTab(tab);
      });
    });

    // Star rating handling
    this.setupStarRating();

    // Form submission
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
      feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitFeedbackForm(feedbackForm);
      });

      // Add validation handling - mark fields as touched after user interaction
      const formInputs = feedbackForm.querySelectorAll('input, select, textarea');
      formInputs.forEach(input => {
        input.addEventListener('blur', () => {
          input.classList.add('touched');
        });
      });
    }

    // Search functionality
    const searchInput = document.getElementById('feedbackSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilters.search = e.target.value.toLowerCase();
        this.currentPage = 1;
        this.renderTable();
      });
    }

    // Filter functionality
    const typeFilter = document.getElementById('feedbackTypeFilter');
    const priorityFilter = document.getElementById('feedbackPriorityFilter');
    const statusFilter = document.getElementById('feedbackStatusFilter');

    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.currentFilters.type = e.target.value;
        this.currentPage = 1;
        this.renderTable();
      });
    }

    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        this.currentFilters.priority = e.target.value;
        this.currentPage = 1;
        this.renderTable();
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilters.status = e.target.value;
        this.currentPage = 1;
        this.renderTable();
      });
    }

    // Records per page functionality
    const recordsPerPageSelect = document.getElementById('feedbackRecordsPerPage');
    if (recordsPerPageSelect) {
      recordsPerPageSelect.addEventListener('change', (e) => {
        this.updateRecordsPerPage(e.target.value);
      });
      
      // Also sync with the existing global function
      if (window.changeFeedbackRecordsPerPage) {
        const originalFunction = window.changeFeedbackRecordsPerPage;
        window.changeFeedbackRecordsPerPage = (newPerPage) => {
          originalFunction(newPerPage);
          this.updateRecordsPerPage(newPerPage);
        };
      }
    }

    // View toggle
    const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
    viewToggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        viewToggleBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.clearFilters();
      });
    }

    // Action buttons - restore event handling for view buttons
    if (window.__feedbackClickHandler) {
      document.removeEventListener('click', window.__feedbackClickHandler);
    }
    
    const feedbackClickHandler = (e) => {
      console.log('🔍 Click detected on:', e.target);
      console.log('🔍 Target classes:', e.target.classList);
      
      if (e.target.classList.contains('action-btn') || e.target.classList.contains('feedback-card-action')) {
        console.log('✅ View button clicked!');
        e.preventDefault(); // Prevent default action
        e.stopPropagation(); // Stop event bubbling
        
        let feedbackId;
        
        // First try to get feedbackId from onclick attribute (primary method)
        const onclickAttr = e.target.getAttribute('onclick');
        if (onclickAttr) {
          const match = onclickAttr.match(/viewFeedback\((\d+)\)/);
          if (match && match[1]) {
            feedbackId = match[1];
            console.log('🔍 Extracted feedbackId from onclick:', feedbackId);
          }
        }
        
        // If onclick method failed, try dataset method
        if (!feedbackId) {
          if (e.target.classList.contains('action-btn')) {
            const row = e.target.closest('tr');
            feedbackId = row.dataset.feedbackId;
            console.log('🔍 Table row feedbackId:', feedbackId);
          } else {
            const card = e.target.closest('.feedback-card');
            feedbackId = card.dataset.feedbackId;
            console.log('🔍 Card feedbackId:', feedbackId);
          }
        }
        
        if (feedbackId) {
          console.log('🚀 Calling viewFeedback with ID:', feedbackId);
          // Use the existing viewFeedback function from the HTML template
          if (typeof window.viewFeedback === 'function') {
            window.viewFeedback(feedbackId);
          } else {
            console.error('❌ viewFeedback function not found');
          }
        } else {
          console.error('❌ No feedbackId found in onclick or dataset!');
        }
      }
    };
    
    window.__feedbackClickHandler = feedbackClickHandler;
    document.addEventListener('click', feedbackClickHandler);
    console.log('✅ Event handler restored for view buttons');
  }

  cleanupEventListeners() {
    // Remove existing global click handler if it exists
    if (window.__feedbackClickHandler) {
      document.removeEventListener('click', window.__feedbackClickHandler);
      window.__feedbackClickHandler = null;
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.feedback-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.feedback-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}TabContent`).classList.add('active');

    // Clear form validation when switching to form tab
    if (tabName === 'form') {
      this.clearFormValidation();
    }

    // If switching to history tab, refresh the current view
    if (tabName === 'history') {
      const activeView = document.querySelector('.view-toggle-btn.active').dataset.view;
      this.switchView(activeView);
      
      // Ensure pagination is rendered when switching to history
      setTimeout(() => {
        const filteredData = this.getFilteredData();
        this.renderPagination(filteredData.length);
      }, 100);
    }
  }

  switchView(viewType) {
    this.currentView = viewType; // Track the current view
    const cardsContainer = document.getElementById('feedbackCardsContainer');
    const tableContainer = document.getElementById('feedbackTableContainer');
    
    if (viewType === 'cards') {
      cardsContainer.style.display = 'block';
      tableContainer.style.display = 'none';
      this.renderCards();
    } else {
      cardsContainer.style.display = 'none';
      tableContainer.style.display = 'block';
      this.renderTable();
    }
  }

  // Method to render the appropriate view based on current view
  renderCurrentView() {
    if (this.currentView === 'cards') {
      this.renderCards();
    } else {
      this.renderTable();
    }
  }

  async submitFeedbackForm(form) {
    const formData = new FormData(form);
    const rawRating = formData.get('rating');
    const rating = (rawRating && rawRating !== '' && rawRating !== null) ? parseInt(rawRating) : 0;
    const feedback_type = formData.get('type') || '';
    const priority = formData.get('priority') || '';
    const feedback_text = formData.get('description') || '';
    const sentiment = rating >= 4 ? 'Positive' : (rating >= 3 ? 'Neutral' : 'Negative');
    
    console.log('Feedback submission data:', {
      rawRating,
      rating,
      feedback_type,
      priority,
      feedback_text,
      sentiment
    });

    const token = this.getAuthToken();
    if (!token) {
      this.showNotification('You must be logged in to submit feedback', 'info');
      return;
    }

    try {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          feedback_type,
          priority,
          feedback_text,
          star_rating: rating,
          sentiment
        })
      });
      const json = await res.json();
      if (res.ok && json && json.success) {
        // Clear existing data to force fresh load
        this.feedbackData = [];
        this.currentPage = 1;
        
        // Reload feedback data from server
        await Promise.all([this.loadFeedbacks(), this.loadStats()]);
        
        // Force refresh of the display
        this.renderTable();
        this.renderCards();
        
        // Ensure pagination is rendered after data reload
        const filteredData = this.getFilteredData();
        this.renderPagination(filteredData.length);
        
        this.switchTab('history');
        
        // Preserve Name and Email fields, only reset other fields
        const nameValue = form.querySelector('#feedbackName').value;
        const emailValue = form.querySelector('#feedbackEmail').value;
        form.reset();
        form.querySelector('#feedbackName').value = nameValue;
        form.querySelector('#feedbackEmail').value = emailValue;
        
        this.resetStarDisplay();
        this.clearFormValidation();
        this.showNotification('Feedback submitted successfully!', 'success');
      } else {
        throw new Error(json && json.message ? json.message : 'Failed to submit');
      }
    } catch (e) {
      console.error('Submit feedback error:', e);
      this.showNotification('Failed to submit feedback', 'info');
    }
  }

  setupStarRating() {
    const ratingInputs = document.querySelectorAll('.rating-input input[type="radio"]');
    ratingInputs.forEach((input, index) => {
      input.addEventListener('change', () => {
        this.updateStarDisplay(index + 1);
      });
    });
  }

  updateStarDisplay(selectedRating) {
    const ratingLabels = document.querySelectorAll('.rating-input label');
    ratingLabels.forEach((label, index) => {
      if (index < selectedRating) {
        label.classList.add('star-highlighted');
        label.classList.remove('star-dimmed');
      } else {
        label.classList.add('star-dimmed');
        label.classList.remove('star-highlighted');
      }
    });
  }

  resetStarDisplay() {
    const ratingLabels = document.querySelectorAll('.rating-input label');
    ratingLabels.forEach(label => {
      label.classList.remove('star-highlighted', 'star-dimmed');
    });
  }

  clearFormValidation() {
    const formInputs = document.querySelectorAll('#feedbackForm input, #feedbackForm select, #feedbackForm textarea');
    formInputs.forEach(input => {
      input.classList.remove('touched');
    });
  }

  clearFilters() {
    this.currentFilters = {
      search: '',
      type: '',
      priority: '',
      status: ''
    };
    
    // Reset filter inputs
    const searchInput = document.getElementById('feedbackSearch');
    const typeFilter = document.getElementById('feedbackTypeFilter');
    const priorityFilter = document.getElementById('feedbackPriorityFilter');
    const statusFilter = document.getElementById('feedbackStatusFilter');
    
    if (searchInput) searchInput.value = '';
    if (typeFilter) typeFilter.value = '';
    if (priorityFilter) priorityFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    
    this.currentPage = 1;
    this.renderTable();
  }

  prefillUserContactFields() {
    const user = this.getCurrentUser();
    if (!user) return;
    const nameEl = document.getElementById('feedbackName');
    const emailEl = document.getElementById('feedbackEmail');
    const fullName = (user.full_name) ||
      ([user.first_name, user.last_name].filter(Boolean).join(' ').trim()) ||
      (user.username) ||
      (user.name);
    if (nameEl && fullName) {
      nameEl.value = fullName;
      nameEl.readOnly = true;
    }
    if (emailEl && user.email) {
      emailEl.value = user.email;
      emailEl.readOnly = true;
    }
  }

  async loadStats() {
    try {
      const res = await fetch('/api/feedbacks/statistics/summary');
      const json = await res.json();
      if (json && json.success && json.data) {
        const total = json.data['Total'] || 0;
        const avg = json.data['Avg Rating'] || 0;
        const totalFeedbackEl = document.getElementById('totalFeedback');
        const averageRatingEl = document.getElementById('averageRating');
        if (totalFeedbackEl) totalFeedbackEl.textContent = total;
        if (averageRatingEl) averageRatingEl.textContent = (avg || 0).toString();
      }
    } catch (e) {
      // silent
    }
  }

  async loadFeedbacks() {
    try {
      const currentUser = this.getCurrentUser();
      console.log('🔍 Current user:', currentUser);
      if (!currentUser || !currentUser.user_id) {
        console.log('❌ No current user or user_id found');
        return;
      }
      // Add cache-busting parameter to ensure fresh data
      const timestamp = new Date().getTime();
      const apiUrl = `/api/feedbacks/user/${encodeURIComponent(currentUser.user_id)}?t=${timestamp}`;
      console.log('🔍 Fetching feedback data from:', apiUrl);
      const res = await fetch(apiUrl);
      console.log('🔍 API response status:', res.status);
      const json = await res.json();
      console.log('🔍 API response:', json);
      if (json && json.success && Array.isArray(json.data)) {
        console.log('🔍 Raw API data:', json.data);
        this.feedbackData = json.data.map(r => {
          const mappedData = {
            id: r.feedback_id || r['FEEDBACK ID'] || Date.now(),
            customer: r['CUSTOMER NAME'] || currentUser.full_name || currentUser.username || 'You',
            email: r['CUSTOMER EMAIL'] || currentUser.email || '',
            description: r['FEEDBACK TEXT'] || r.feedback_text || '',
            type: r['FEEDBACK TYPE'] || r.feedback_type || '',
            priority: r['PRIORITY'] || r.priority || 'Low',
            status: r['STATUS'] || r.status || 'Active',
            rating: Number(r['STAR RATE'] || r.star_rating || r.rating || 0),
            date: this.formatDate(r.created_at),
            // Admin response fields
            adminResponse: r['ADMIN RESPONSE'] || r.admin_response || r.response_text || '',
            adminNotes: r['ADMIN NOTES'] || r.admin_notes || '',
            responseDate: r['RESPONSE DATE'] || r.response_date || r.updated_at || '',
            hasAdminResponse: !!(r['ADMIN RESPONSE'] || r.admin_response || r.response_text)
          };
          console.log('🔍 Mapped feedback data:', mappedData);
          return mappedData;
        });
        console.log('🔍 Final feedbackData after mapping:', this.feedbackData);
        this.renderTable();
    this.updateStats();
      }
    } catch (e) {
      // silent
    }
  }

  getCurrentUser() {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  getAuthToken() {
    return localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
  }

  formatDate(val) {
    if (!val) return new Date().toLocaleDateString();
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString();
    } catch (_) { return String(val); }
  }

  updateStats() {
    const totalFeedback = Array.isArray(this.feedbackData) ? this.feedbackData.length : 0;
    const activeIssues = (this.feedbackData || []).filter(f => (f.status || '').toLowerCase() === 'active' && (f.type || '').toLowerCase() !== 'general feedback').length;
    const resolvedIssues = (this.feedbackData || []).filter(f => (f.status || '').toLowerCase() === 'resolved').length;
    const sumRatings = (this.feedbackData || []).reduce((sum, f) => sum + (Number(f.rating) || 0), 0);
    const averageRating = totalFeedback > 0 ? (sumRatings / totalFeedback).toFixed(1) : '0.0';

    const totalFeedbackEl = document.getElementById('totalFeedback');
    const activeIssuesEl = document.getElementById('activeIssues');
    const resolvedIssuesEl = document.getElementById('resolvedIssues');
    const averageRatingEl = document.getElementById('averageRating');

    if (totalFeedbackEl) totalFeedbackEl.textContent = totalFeedback;
    if (activeIssuesEl) activeIssuesEl.textContent = activeIssues;
    if (resolvedIssuesEl) resolvedIssuesEl.textContent = resolvedIssues;
    if (averageRatingEl) averageRatingEl.textContent = averageRating;
  }

  getFilteredData() {
    return this.feedbackData.filter(feedback => {
      // Search filter - check customer name and description
      const matchesSearch = !this.currentFilters.search || 
        (feedback.customer && feedback.customer.toLowerCase().includes(this.currentFilters.search.toLowerCase())) ||
        (feedback.description && feedback.description.toLowerCase().includes(this.currentFilters.search.toLowerCase()));
      
      // Type filter - exact match
      const matchesType = !this.currentFilters.type || 
        (feedback.type && feedback.type.toLowerCase() === this.currentFilters.type.toLowerCase());
      
      // Priority filter - exact match
      const matchesPriority = !this.currentFilters.priority || 
        (feedback.priority && feedback.priority.toLowerCase() === this.currentFilters.priority.toLowerCase());
      
      // Status filter - exact match
      const matchesStatus = !this.currentFilters.status || 
        (feedback.status && feedback.status.toLowerCase() === this.currentFilters.status.toLowerCase());

      return matchesSearch && matchesType && matchesPriority && matchesStatus;
    });
  }

  renderTable() {
    console.log('🔍 renderTable called with feedbackData:', this.feedbackData);
    const filteredData = this.getFilteredData();
    console.log('🔍 filteredData for table:', filteredData);
    const startIndex = (this.currentPage - 1) * this.recordsPerPage;
    const endIndex = startIndex + this.recordsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    console.log('🔍 paginatedData for table:', paginatedData);

    const tbody = document.getElementById('feedbackTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (paginatedData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
            <div style="font-size: 1.2rem; margin-bottom: 8px;">📝</div>
            <div>No feedback found matching your criteria</div>
          </td>
        </tr>
      `;
      return;
    }

    paginatedData.forEach(feedback => {
      const row = document.createElement('tr');
      row.dataset.feedbackId = feedback.id;
      console.log('🔍 Setting row feedbackId:', feedback.id, 'for feedback:', feedback);
      
      const stars = this.renderStars(feedback.rating);
      const priorityClass = `priority-${feedback.priority.toLowerCase()}`;
      const statusClass = `status-${feedback.status.toLowerCase()}`;
      
      row.innerHTML = `
        <td>
          <div class="customer-info">
            <div class="customer-name">${feedback.customer}</div>
            <div class="customer-desc">${feedback.description}</div>
          </div>
        </td>
        <td><span class="type-badge">${feedback.type}</span></td>
        <td><span class="priority-badge ${priorityClass}">${feedback.priority}</span></td>
        <td><span class="status-badge ${statusClass}">${this.getStatusIcon(feedback.status)} ${feedback.status}</span></td>
        <td>
          <div class="rating-stars">
            ${stars}
          </div>
        </td>
        <td>${feedback.date}</td>
        <td><button class="action-btn">View</button></td>
      `;
      
      tbody.appendChild(row);
    });

    this.renderPagination(filteredData.length);
  }

  renderCards() {
    const filteredData = this.getFilteredData();
    const startIndex = (this.currentPage - 1) * this.recordsPerPage;
    const endIndex = startIndex + this.recordsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const cardsGrid = document.getElementById('feedbackCardsGrid');
    if (!cardsGrid) return;

    cardsGrid.innerHTML = '';

    if (paginatedData.length === 0) {
      cardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #bfc9da;">
          <div style="font-size: 1.2rem; margin-bottom: 8px;">📝</div>
          <div>No feedback found matching your criteria</div>
        </div>
      `;
      return;
    }

    paginatedData.forEach(feedback => {
      const card = document.createElement('div');
      card.className = 'feedback-card';
      card.dataset.feedbackId = feedback.id;
      console.log('🔍 Setting card feedbackId:', feedback.id, 'for feedback:', feedback);
      
      const stars = this.renderStars(feedback.rating);
      const priorityClass = `priority-${feedback.priority.toLowerCase()}`;
      const statusIcon = this.getStatusIcon(feedback.status);
      const sentiment = this.getSentiment(feedback.rating);
      
      card.innerHTML = `
        <div class="feedback-card-header">
          <h3 class="feedback-card-title">${feedback.customer}</h3>
          <div class="feedback-card-status">${statusIcon}</div>
        </div>
        
        <div class="feedback-card-meta">
          <span>${feedback.type}</span>
          <span>•</span>
          <span>${feedback.date}</span>
        </div>
        
        <div class="feedback-card-badges">
          <span class="feedback-card-badge ${priorityClass}">${feedback.priority}</span>
          <span class="feedback-card-badge sentiment-${sentiment}">${sentiment}</span>
        </div>
        
        <div class="feedback-card-rating">
          ${stars}
        </div>
        
        <div class="feedback-card-description">
          ${feedback.description}
        </div>
        
        <div class="feedback-card-footer">
          <span class="feedback-card-date">${feedback.date}</span>
          <button class="feedback-card-action">View Details</button>
        </div>
      `;
      
      cardsGrid.appendChild(card);
    });

    this.renderPagination(filteredData.length);
  }

  renderStars(rating) {
    // Ensure rating is a valid number
    const numRating = Number(rating) || 0;
    console.log('Rendering stars for rating:', numRating);
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= numRating ? 'filled' : '';
      stars += `<span class="star ${filled}">⭐</span>`;
    }
    return stars;
  }

  getStatusIcon(status) {
    const icons = {
      'Active': '🕐',
      'Resolved': '✅',
      'Closed': '❌'
    };
    return icons[status] || '📝';
  }

  getSentiment(rating) {
    if (rating >= 4) return 'positive';
    if (rating >= 3) return 'neutral';
    return 'negative';
  }


  renderPagination(totalRecords) {
    const totalPages = Math.ceil(totalRecords / this.recordsPerPage);
    const paginationContainer = document.getElementById('feedbackPagination');
    
    if (!paginationContainer || totalRecords === 0) {
      if (paginationContainer) paginationContainer.style.display = 'none';
      return;
    }

    // Show pagination if there are records
    paginationContainer.style.display = 'flex';
    paginationContainer.style.flexDirection = 'column';
    paginationContainer.style.gap = '15px';
    paginationContainer.innerHTML = '';

    // Show page info on the left (like default system)
    const startItem = (this.currentPage - 1) * this.recordsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.recordsPerPage, totalRecords);
    const pageInfo = document.createElement('div');
    pageInfo.className = 'pagination-info';
    pageInfo.style.textAlign = 'left';
    pageInfo.style.alignSelf = 'flex-start';
    pageInfo.style.width = '100%';
    pageInfo.textContent = `Showing ${startItem}-${endItem} of ${totalRecords} feedback entries | Page ${this.currentPage} of ${totalPages}`;
    paginationContainer.appendChild(pageInfo);

    // Always show pagination controls (even for single page)
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'pagination-controls';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.justifyContent = 'center';
    controlsContainer.style.alignItems = 'center';
    controlsContainer.style.gap = '8px';
    controlsContainer.style.flexWrap = 'wrap';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = this.currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderCurrentView();
      }
    });
    controlsContainer.appendChild(prevBtn);

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.className = `pagination-btn ${i === this.currentPage ? 'active' : ''}`;
      pageBtn.addEventListener('click', () => {
        this.currentPage = i;
        this.renderCurrentView();
      });
      controlsContainer.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = this.currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderCurrentView();
      }
    });
    controlsContainer.appendChild(nextBtn);
    
    paginationContainer.appendChild(controlsContainer);
  }


  // showFeedbackDetails(feedbackId) {
  // Commented out - using existing viewFeedback function from HTML template
  _showFeedbackDetails(feedbackId) {
    console.log('🎯 showFeedbackDetails called with ID:', feedbackId);
    console.log('🎯 Available feedback data:', this.feedbackData);
    
    const feedback = this.feedbackData.find(f => f.id == feedbackId);
    console.log('🎯 Found feedback:', feedback);
    
    if (!feedback) {
      console.error('❌ Feedback not found for ID:', feedbackId);
      return;
    }

    // Use actual admin response from API, or add default if none exists
    if (!feedback.adminResponse || feedback.adminResponse.trim() === '') {
      feedback.adminResponse = feedback.status === 'Resolved' ? 
        'Thank you for your feedback. We have reviewed your concern and implemented the necessary changes. We appreciate your patience and continued support.' : 
        'We have received your feedback and our team is currently reviewing it. We will provide an update within 24-48 hours.';
    }
    
    console.log('🔍 Admin response data:', {
      hasAdminResponse: feedback.hasAdminResponse,
      adminResponse: feedback.adminResponse,
      adminNotes: feedback.adminNotes,
      responseDate: feedback.responseDate
    });

    const modal = document.createElement('div');
    modal.className = 'feedback-details-modal';
    modal.innerHTML = `
      <div class="feedback-details-modal-backdrop"></div>
      <div class="feedback-details-modal-content">
        <div class="feedback-details-modal-header">
          <h3 class="feedback-details-modal-title">Feedback Details</h3>
          <button class="feedback-details-modal-close">&times;</button>
        </div>
        <div class="feedback-details-modal-body">
          <div class="feedback-detail-card">
            <div class="feedback-detail-card-header">
              <h4 class="feedback-detail-card-title">Customer Information</h4>
            </div>
            <div class="feedback-detail-card-content">
              <div class="feedback-detail-row">
                <label class="feedback-detail-label">Customer:</label>
                <span class="feedback-detail-value">${feedback.customer}</span>
            </div>
              <div class="feedback-detail-row">
                <label class="feedback-detail-label">Email:</label>
                <span class="feedback-detail-value">${feedback.email || 'Not provided'}</span>
              </div>
              <div class="feedback-detail-row">
                <label class="feedback-detail-label">Date Submitted:</label>
                <span class="feedback-detail-value">${feedback.date}</span>
              </div>
            </div>
          </div>

          <div class="feedback-detail-card">
            <div class="feedback-detail-card-header">
              <h4 class="feedback-detail-card-title">Details</h4>
            </div>
            <div class="feedback-detail-card-content">
              <div class="feedback-detail-row">
                <label class="feedback-detail-label">Type:</label>
                <span class="feedback-detail-value">
                  <span class="feedback-badge type-badge">${feedback.type}</span>
                </span>
            </div>
              <div class="feedback-detail-row">
                <label class="feedback-detail-label">Priority:</label>
                <span class="feedback-detail-value">
                  <span class="feedback-badge priority-${feedback.priority.toLowerCase()}">${feedback.priority}</span>
                </span>
            </div>
              <div class="feedback-detail-row">
                <label class="feedback-detail-label">Status:</label>
                <span class="feedback-detail-value">
                  <span class="feedback-badge status-${feedback.status.toLowerCase()}">${this.getStatusIcon(feedback.status)} ${feedback.status}</span>
                </span>
              </div>
              <div class="feedback-detail-row">
                <label class="feedback-detail-label">Rating:</label>
                <span class="feedback-detail-value">
                  <div class="feedback-rating-stars">
                ${this.renderStars(feedback.rating)}
                  </div>
                </span>
              </div>
            </div>
          </div>

          <div class="feedback-detail-card">
            <div class="feedback-detail-card-header">
              <h4 class="feedback-detail-card-title">Customer Feedback</h4>
            </div>
            <div class="feedback-detail-card-content">
              <div class="feedback-description-area">
              ${feedback.description}
              </div>
            </div>
          </div>

          <div class="feedback-detail-card">
            <div class="feedback-detail-card-header">
              <h4 class="feedback-detail-card-title">Admin Response</h4>
            </div>
            <div class="feedback-detail-card-content">
              <div class="admin-response-area">
              <div class="admin-response-header">
                <span class="admin-label">Admin Response</span>
                <span class="response-date">${feedback.responseDate ? 'Responded on ' + this.formatDate(feedback.responseDate) : (feedback.status === 'Resolved' ? 'Resolved on ' + feedback.date : 'Pending')}</span>
              </div>
              <div class="admin-response-content">
                ${feedback.adminResponse}
                ${feedback.adminNotes ? `<div class="admin-notes" style="margin-top: 12px; padding: 8px; background: rgba(74, 158, 255, 0.1); border-radius: 6px; font-size: 0.9rem; color: #bfc9da;"><strong>Admin Notes:</strong> ${feedback.adminNotes}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
        </div>
        <div class="feedback-details-modal-footer">
          <button type="button" class="feedback-details-modal-btn feedback-details-modal-btn-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    console.log('✅ Modal added to DOM');
    
    // Show the modal
    modal.classList.add('active');
    // Force display as fallback
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.zIndex = '9999';
    console.log('✅ Modal active class added');
    console.log('🔍 Modal element:', modal);
    console.log('🔍 Modal display style:', modal.style.display);
    console.log('🔍 Modal classes:', modal.classList);

    // Close modal events
    const backdrop = modal.querySelector('.feedback-details-modal-backdrop');
    const content = modal.querySelector('.feedback-details-modal-content');

    const closeModal = () => {
      if (modal && document.body.contains(modal)) {
        modal.classList.remove('active');
        // Add a small delay before removing to allow for transition
        setTimeout(() => {
      if (modal && document.body.contains(modal)) {
        document.body.removeChild(modal);
          }
        }, 300);
      }
      document.removeEventListener('keydown', escHandler);
    };

    // Bind all close buttons (header X and footer Close)
    modal.querySelectorAll('.feedback-details-modal-close, .feedback-details-modal-btn-close').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });

    // Click on backdrop closes; clicks inside content should not bubble
    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (content) content.addEventListener('click', (e) => e.stopPropagation());

    // Escape key to close
    const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escHandler);
    
    // Ensure modal is visible after a short delay
    setTimeout(() => {
      console.log('🔍 Modal visibility check after delay:');
      console.log('🔍 Modal display:', modal.style.display);
      console.log('🔍 Modal opacity:', modal.style.opacity);
      console.log('🔍 Modal z-index:', modal.style.zIndex);
      console.log('🔍 Modal classes:', modal.classList);
      console.log('🔍 Modal in DOM:', document.body.contains(modal));
    }, 100);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : '#2196f3'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Make FeedbackCenter globally available
window.FeedbackCenter = FeedbackCenter;

// Initialize feedback center when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the feedback page
  if (document.getElementById('feedback-template')) {
    window.feedbackCenter = new FeedbackCenter();
  }
});

// CSS is now properly located in config.css file
