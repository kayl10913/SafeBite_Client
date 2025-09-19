// Feedback Center JavaScript
class FeedbackCenter {
  constructor() {
    this.currentPage = 1;
    this.recordsPerPage = 25;
    this.currentFilters = {
      search: '',
      type: '',
      priority: '',
      status: ''
    };
    this.feedbackData = [];
    
    this.init();
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

    // Action buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('action-btn') || e.target.classList.contains('feedback-card-action')) {
        let feedbackId;
        if (e.target.classList.contains('action-btn')) {
          const row = e.target.closest('tr');
          feedbackId = row.dataset.feedbackId;
        } else {
          const card = e.target.closest('.feedback-card');
          feedbackId = card.dataset.feedbackId;
        }
        this.showFeedbackDetails(feedbackId);
      }
    });
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

    // If switching to history tab, refresh the current view
    if (tabName === 'history') {
      const activeView = document.querySelector('.view-toggle-btn.active').dataset.view;
      this.switchView(activeView);
    }
  }

  switchView(viewType) {
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

  async submitFeedbackForm(form) {
    const formData = new FormData(form);
    const rating = parseInt(formData.get('rating')) || null;
    const feedback_type = formData.get('type') || '';
    const priority = formData.get('priority') || '';
    const feedback_text = formData.get('description') || '';
    const sentiment = rating >= 4 ? 'Positive' : (rating >= 3 ? 'Neutral' : 'Negative');

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
        await Promise.all([this.loadFeedbacks(), this.loadStats()]);
        this.switchTab('history');
        form.reset();
        this.showNotification('Feedback submitted successfully!', 'success');
      } else {
        throw new Error(json && json.message ? json.message : 'Failed to submit');
      }
    } catch (e) {
      console.error('Submit feedback error:', e);
      this.showNotification('Failed to submit feedback', 'info');
    }
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
      if (!currentUser || !currentUser.user_id) {
        return;
      }
      const res = await fetch(`/api/feedbacks/user/${encodeURIComponent(currentUser.user_id)}`);
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        this.feedbackData = json.data.map(r => ({
          id: r.feedback_id || r['FEEDBACK ID'] || Date.now(),
          customer: r['CUSTOMER NAME'] || currentUser.full_name || currentUser.username || 'You',
          email: r['CUSTOMER EMAIL'] || currentUser.email || '',
          description: r['FEEDBACK TEXT'] || r.feedback_text || '',
          type: r['FEEDBACK TYPE'] || r.feedback_type || '',
          priority: r['PRIORITY'] || r.priority || 'Low',
          status: r['STATUS'] || r.status || 'Active',
          rating: Number(r['STAR RATE'] || r.star_rating || 0),
          date: this.formatDate(r.created_at)
        }));
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
    const activeIssues = (this.feedbackData || []).filter(f => (f.status || '').toLowerCase() === 'active').length;
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
      const matchesSearch = !this.currentFilters.search || 
        feedback.customer.toLowerCase().includes(this.currentFilters.search) ||
        feedback.description.toLowerCase().includes(this.currentFilters.search);
      
      const matchesType = !this.currentFilters.type || 
        feedback.type.toLowerCase().includes(this.currentFilters.type);
      
      const matchesPriority = !this.currentFilters.priority || 
        feedback.priority.toLowerCase() === this.currentFilters.priority;
      
      const matchesStatus = !this.currentFilters.status || 
        feedback.status.toLowerCase() === this.currentFilters.status;

      return matchesSearch && matchesType && matchesPriority && matchesStatus;
    });
  }

  renderTable() {
    const filteredData = this.getFilteredData();
    const startIndex = (this.currentPage - 1) * this.recordsPerPage;
    const endIndex = startIndex + this.recordsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

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
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rating ? 'filled' : '';
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
    
    if (!paginationContainer || totalPages <= 1) {
      if (paginationContainer) paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'flex';
    paginationContainer.innerHTML = '';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = this.currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTable();
      }
    });
    paginationContainer.appendChild(prevBtn);

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.className = `pagination-btn ${i === this.currentPage ? 'active' : ''}`;
      pageBtn.addEventListener('click', () => {
        this.currentPage = i;
        this.renderTable();
      });
      paginationContainer.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = this.currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderTable();
      }
    });
    paginationContainer.appendChild(nextBtn);
  }


  showFeedbackDetails(feedbackId) {
    const feedback = this.feedbackData.find(f => f.id == feedbackId);
    if (!feedback) return;

    // Add admin response if not exists
    if (!feedback.adminResponse) {
      feedback.adminResponse = feedback.status === 'Resolved' ? 
        'Thank you for your feedback. We have reviewed your concern and implemented the necessary changes. We appreciate your patience and continued support.' : 
        'We have received your feedback and our team is currently reviewing it. We will provide an update within 24-48 hours.';
    }

    const modal = document.createElement('div');
    modal.className = 'feedback-modal';
    modal.innerHTML = `
      <div class="feedback-modal-backdrop"></div>
      <div class="feedback-modal-content">
        <div class="feedback-modal-header">
          <h3>Feedback Details</h3>
          <button class="feedback-modal-close">&times;</button>
        </div>
        <div class="feedback-details">
          <div class="detail-section">
            <h4 class="detail-section-title">Customer Information</h4>
            <div class="detail-row">
              <label>Customer:</label>
              <span>${feedback.customer}</span>
            </div>
            <div class="detail-row">
              <label>Email:</label>
              <span>${feedback.email || 'Not provided'}</span>
            </div>
            <div class="detail-row">
              <label>Date Submitted:</label>
              <span>${feedback.date}</span>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-section-title">Feedback Details</h4>
            <div class="detail-row">
              <label>Type:</label>
              <span class="type-badge">${feedback.type}</span>
            </div>
            <div class="detail-row">
              <label>Priority:</label>
              <span class="priority-badge priority-${feedback.priority.toLowerCase()}">${feedback.priority}</span>
            </div>
            <div class="detail-row">
              <label>Status:</label>
              <span class="status-badge status-${feedback.status.toLowerCase()}">${this.getStatusIcon(feedback.status)} ${feedback.status}</span>
            </div>
            <div class="detail-row">
              <label>Rating:</label>
              <div class="rating-stars">
                ${this.renderStars(feedback.rating)}
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-section-title">Customer Feedback</h4>
            <div class="feedback-description">
              ${feedback.description}
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-section-title">Admin Response</h4>
            <div class="admin-response">
              <div class="admin-response-header">
                <span class="admin-label">Admin Response</span>
                <span class="response-date">${feedback.status === 'Resolved' ? 'Resolved on ' + feedback.date : 'Pending'}</span>
              </div>
              <div class="admin-response-content">
                ${feedback.adminResponse}
              </div>
            </div>
          </div>
        </div>
        <div class="feedback-modal-footer">
          <button type="button" class="feedback-modal-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal events
    const closeBtn = modal.querySelector('.feedback-modal-close');
    const backdrop = modal.querySelector('.feedback-modal-backdrop');

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
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

// Add CSS for modal and notifications
const style = document.createElement('style');
style.textContent = `
  .feedback-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .feedback-modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
  }

  .feedback-modal-content {
    background: #212c4d;
    border-radius: 12px;
    width: 90%;
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    z-index: 1001;
    border: 1px solid #3a4a6b;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .feedback-modal-header {
    padding: 24px;
    border-bottom: 1px solid #3a4a6b;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .feedback-modal-header h3 {
    margin: 0;
    color: #ffffff;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .feedback-modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #bfc9da;
    transition: color 0.2s ease;
  }

  .feedback-modal-close:hover {
    color: #ffffff;
  }

  .feedback-details {
    padding: 24px;
  }

  .detail-section {
    margin-bottom: 32px;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .detail-section-title {
    color: #ffffff;
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #4a9eff;
  }

  .detail-row {
    display: flex;
    margin-bottom: 12px;
    align-items: center;
    gap: 12px;
  }

  .detail-row label {
    font-weight: 600;
    min-width: 120px;
    color: #e0e6f6;
    font-size: 0.95rem;
  }

  .detail-row span {
    color: #ffffff;
  }

  .feedback-description {
    background: #2a3658;
    border: 1px solid #3a4a6b;
    border-radius: 8px;
    padding: 16px;
    color: #bfc9da;
    line-height: 1.6;
    font-size: 0.95rem;
  }

  .admin-response {
    background: #1e3a8a;
    border: 1px solid #3b82f6;
    border-radius: 8px;
    padding: 16px;
  }

  .admin-response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .admin-label {
    color: #60a5fa;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .response-date {
    color: #bfc9da;
    font-size: 0.85rem;
  }

  .admin-response-content {
    color: #ffffff;
    line-height: 1.6;
    font-size: 0.95rem;
  }

  .feedback-modal-footer {
    padding: 24px;
    border-top: 1px solid #3a4a6b;
    display: flex;
    justify-content: flex-end;
  }

  .feedback-modal-footer .feedback-modal-close {
    background: #4a9eff;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }

  .feedback-modal-footer .feedback-modal-close:hover {
    background: #3b82f6;
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 20px;
  }

  .pagination-btn {
    padding: 8px 12px;
    border: 1px solid #3a4a6b;
    background: #2a3658;
    color: #ffffff;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .pagination-btn:hover:not(:disabled) {
    background: #3a4a6b;
  }

  .pagination-btn.active {
    background: #4a9eff;
    color: white;
    border-color: #4a9eff;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
