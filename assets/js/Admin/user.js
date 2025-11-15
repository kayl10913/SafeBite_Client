// js/user.js

// Global variables for user data
let usersData = [];
let currentUserPage = 1;
let userRecordsPerPage = 25;
let totalUserRecords = 0;
let currentUserFilters = {
  search: '',
  role: '',
  status: '',
  dateStart: '',
  dateEnd: ''
};

// Function to get current admin user info from session
function getCurrentAdminInfo() {
  const currentAdmin = localStorage.getItem('currentAdmin');
  
  if (currentAdmin) {
    try {
      return JSON.parse(currentAdmin);
    } catch (e) {
      console.error('Error parsing current user:', e);
      return null;
    }
  }
  // Fallbacks other apps may use
  try {
    const userStr = localStorage.getItem('user') || localStorage.getItem('admin');
    if (userStr) return JSON.parse(userStr);
  } catch (_) {}
  return null;
}

// Decode JWT (without verification) to extract logged-in id
function getUserIdFromToken() {
  try {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'));
    const payload = JSON.parse(payloadJson);
    // Common claim keys
    return payload.user_id || payload.id || payload.uid || null;
  } catch (e) {
    console.warn('Unable to decode JWT payload:', e);
    return null;
  }
}

// Function to prompt for admin password using the logged-in user's info
function promptForAdminPassword(action) {
  const adminInfo = getCurrentAdminInfo();
  if (!adminInfo) {
    showToast('Admin session not found. Please log in again.', 'error');
    return null;
  }
  
  const promptMessage = `Enter password for ${adminInfo.username || 'admin'} to ${action}:`;
  return window.prompt(promptMessage);
}

// Function to verify admin password
async function verifyAdminPassword(password) {
  if (!password) return false;
  
  try {
    console.log('Verifying admin password...');
    
    // Try using the makeApiRequest function from API config first
    if (typeof window !== 'undefined' && window.makeApiRequest) {
      console.log('Using makeApiRequest from API config');
      const result = await window.makeApiRequest(window.API_CONFIG.ENDPOINTS.ADMIN.VERIFY_PASSWORD, {
        method: 'POST',
        body: JSON.stringify({ password: password })
      });
      console.log('Password verification result:', result);
      return result.success === true && result.is_valid === true;
    }
    
    // Fallback to direct fetch
    const jwtToken = localStorage.getItem('jwt_token') || 
                     localStorage.getItem('sessionToken') || 
                     localStorage.getItem('session_token');
    
    if (!jwtToken) {
      console.error('No JWT token found');
      showToast('No authentication token found. Please log in again.', 'error');
      return false;
    }
    
    // Use the API configuration if available, otherwise fallback to direct URL
    const apiUrl = (typeof window !== 'undefined' && window.API_CONFIG) 
      ? window.buildApiUrl(window.API_CONFIG.ENDPOINTS.ADMIN.VERIFY_PASSWORD)
      : '/api/admin/verify-password';
    
    console.log('Using direct fetch with API URL:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: password })
    });
    
    console.log('Password verification response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Password verification result:', result);
      return result.success === true && result.is_valid === true;
    } else {
      const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Password verification failed:', errorResult);
      showToast(`Password verification failed: ${errorResult.error || 'Unknown error'}`, 'error');
      return false;
    }
  } catch (error) {
    console.error('Error verifying password:', error);
    showToast('Network error during password verification. Please try again.', 'error');
    return false;
  }
}

// Function to fetch users from API
async function fetchUsers(page = 1, limit = 25) {
  try {
    // Get current filters
    const search = document.getElementById('userSearch')?.value || '';
    const role = document.getElementById('userRoleFilter')?.value || '';
    const status = document.getElementById('userStatusFilter')?.value || '';
    // Date range selection
    const rangeSel = document.getElementById('userDateRangeFilter');
    const weekInput = document.getElementById('userWeekPicker');
    const monthInput = document.getElementById('userMonthPicker');
    const yearInput = document.getElementById('userYearPicker');
    let dateStart = document.getElementById('userDateStart')?.value || '';
    let dateEnd = document.getElementById('userDateEnd')?.value || '';
    const range = rangeSel ? rangeSel.value : 'custom';
    const period = computeUserFilterPeriod({
      range,
      week: weekInput?.value,
      month: monthInput?.value,
      year: yearInput?.value
    }, dateStart, dateEnd);
    dateStart = period.startDate || '';
    dateEnd = period.endDate || '';
    
    // Build query parameters
    const params = new URLSearchParams({
      page: page,
      limit: limit,
      search: search,
      role: role,
      status: status,
      date_start: dateStart,
      date_end: dateEnd
    });
    
    // Get session token from localStorage
    const jwtToken = localStorage.getItem('jwt_token') || 
                     localStorage.getItem('sessionToken') || 
                     localStorage.getItem('session_token');
    
    const response = await fetch(`/api/admin/users?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // Map backend fields to UI fields
      usersData = (result.users || []).map(u => ({
        user_id: u.user_id,
        username: u.username,
        name: `${u.first_name} ${u.last_name}`.trim(),
        email: u.email,
        status: u.account_status,
        date_created: u.created_at,
        // Ensure we keep current category for edit modal
        tester_type_id: u.tester_type_id
      }));
      const pg = result.pagination || {};
      totalUserRecords = pg.total || 0;
      currentUserPage = pg.page || page;
      userRecordsPerPage = pg.limit || limit;
      
      // Update current filters from request (best-effort)
      currentUserFilters = {
        search: (new URLSearchParams(params)).get('search') || '',
        role: (new URLSearchParams(params)).get('role') || '',
        status: (new URLSearchParams(params)).get('status') || '',
        dateStart: (new URLSearchParams(params)).get('date_start') || '',
        dateEnd: (new URLSearchParams(params)).get('date_end') || ''
      };
      
      renderUserTable();
      renderUserPagination(totalUserRecords);
    } else {
      console.error('API Error:', result.error);
      usersData = [];
      totalUserRecords = 0;
      renderUserTable();
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    usersData = [];
    totalUserRecords = 0;
    renderUserTable();
  }
}

function computeUserFilterPeriod(selection, startFallback, endFallback){
  const today = new Date();
  switch (selection.range){
    case 'alltime':
      return { startDate: '', endDate: '' };
    case 'daily':
      return { startDate: toDateStr(today), endDate: toDateStr(today) };
    case 'weekly':{
      const val = selection.week;
      if (val){
        const [y,w]=val.split('-W');
        const s = getWeekStartFromWeekNumber(parseInt(y), parseInt(w));
        const e = getWeekEndFromWeekNumber(parseInt(y), parseInt(w));
        return { startDate: toDateStr(s), endDate: toDateStr(e) };
      }
      const s = getWeekStartFromWeekNumber(today.getFullYear(), getISOWeekNumber(today));
      const e = new Date(s); e.setDate(s.getDate()+6);
      return { startDate: toDateStr(s), endDate: toDateStr(e) };
    }
    case 'monthly':{
      const val = selection.month;
      if (val){
        const [y,m]=val.split('-');
        const s = new Date(parseInt(y), parseInt(m)-1, 1);
        const e = new Date(parseInt(y), parseInt(m), 0);
        return { startDate: toDateStr(s), endDate: toDateStr(e) };
      }
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth()+1, 0);
      return { startDate: toDateStr(s), endDate: toDateStr(e) };
    }
    case 'yearly':{
      const y = parseInt(selection.year || String(today.getFullYear()));
      const s = new Date(y,0,1);
      const e = new Date(y,11,31);
      return { startDate: toDateStr(s), endDate: toDateStr(e) };
    }
    case 'custom':
    default:
      return { startDate: startFallback || '', endDate: endFallback || '' };
  }
}

function toDateStr(d){ return d.toISOString().split('T')[0]; }
function getISOWeekNumber(date){
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  return 1 + Math.round(diff / 604800000);
}
function getWeekStartFromWeekNumber(year, week){
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = new Date(simple);
  const diff = (dow <= 4 ? 1 : 8) - dow;
  ISOweekStart.setDate(simple.getDate() + diff);
  return ISOweekStart;
}
function getWeekEndFromWeekNumber(year, week){
  const start = getWeekStartFromWeekNumber(year, week);
  const end = new Date(start);
  end.setDate(start.getDate()+6);
  return end;
}

function renderUserTable() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) {
    return;
  }
  
  if (usersData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">No Users Found</div>
        <div class="empty-state-desc">Try adjusting your filters or add a new user.</div>
      </div>
    </td></tr>`;
    return;
  }
  
  // Data is already paginated from the API
  tbody.innerHTML = usersData.map(user => {
    const isActive = user.status.toLowerCase() === 'active';
    const actionButtons = isActive 
      ? `<button class="action-btn edit" data-id="${user.user_id}">Edit</button>
         <button class="action-btn deactivate" data-id="${user.user_id}">Deactivate</button>`
      : `<button class="action-btn edit" data-id="${user.user_id}">Edit</button>
         <button class="action-btn reactivate" data-id="${user.user_id}">Reactivate</button>`;
    
    return `
    <tr>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${formatDate(user.date_created)}</td>
      <td><span class="status-badge status-${user.status.toLowerCase()}">${user.status}</span></td>
      <td>
        ${actionButtons}
      </td>
    </tr>
    `;
  }).join('');
}

function renderUserPagination(totalRecords) {
  const paginationDiv = document.getElementById('userPagination');
  if (!paginationDiv) return;
  // Show/hide container like other modules
  if (!totalRecords || totalRecords <= 0) {
    paginationDiv.style.display = 'none';
    paginationDiv.innerHTML = '';
    return;
  }

  paginationDiv.style.display = '';
  const totalPages = Math.ceil(totalRecords / userRecordsPerPage);
  
  let paginationHTML = '<div class="pagination-info">';
  paginationHTML += `Showing ${((currentUserPage - 1) * userRecordsPerPage) + 1} to ${Math.min(currentUserPage * userRecordsPerPage, totalRecords)} of ${totalRecords} users`;
  paginationHTML += '</div>';
  
  paginationHTML += '<div class="pagination-controls">';
  
  // Previous button
  if (currentUserPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="changeUserPage(${currentUserPage - 1})">‹ Previous</button>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentUserPage) {
      paginationHTML += `<button class="pagination-btn active">${i}</button>`;
    } else if (i === 1 || i === totalPages || (i >= currentUserPage - 2 && i <= currentUserPage + 2)) {
      paginationHTML += `<button class="pagination-btn" onclick="changeUserPage(${i})">${i}</button>`;
    } else if (i === currentUserPage - 3 || i === currentUserPage + 3) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  // Next button
  if (currentUserPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="changeUserPage(${currentUserPage + 1})">Next ›</button>`;
  }
  
  paginationHTML += '</div>';
  paginationDiv.innerHTML = paginationHTML;
}

function changeUserPage(page) {
  currentUserPage = page;
  fetchUsers(page, userRecordsPerPage);
}

function changeUserRecordsPerPage(recordsPerPage) {
  userRecordsPerPage = parseInt(recordsPerPage);
  currentUserPage = 1;
  fetchUsers(1, recordsPerPage);
}

function handleUserFilters() {
  currentUserPage = 1;
  fetchUsers(1, userRecordsPerPage);
}

// Add event listeners for filters
document.addEventListener('DOMContentLoaded', function() {
  // Add filter event listeners
  const searchInput = document.getElementById('userSearch');
  const statusFilter = document.getElementById('userStatusFilter');
  const roleFilter = document.getElementById('userRoleFilter');
  const dateStartInput = document.getElementById('userDateStart');
  const dateEndInput = document.getElementById('userDateEnd');
  
  if (searchInput) searchInput.addEventListener('input', debounce(handleUserFilters, 300));
  if (statusFilter) statusFilter.addEventListener('change', handleUserFilters);
  if (roleFilter) roleFilter.addEventListener('change', handleUserFilters);
  if (dateStartInput) dateStartInput.addEventListener('change', handleUserFilters);
  if (dateEndInput) dateEndInput.addEventListener('change', handleUserFilters);
});

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

// Function to format date for display (date only)
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  // Format date only (e.g., "Jan 15, 2024")
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Function to format date for input fields (YYYY-MM-DD format)
function formatDateForInput(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  // Format as YYYY-MM-DD for input fields
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Function to format date and time for display
function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
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

// Mock user data for editing (since we don't have full user details from the list API)
let editingUserId = null;

function openUserModal(editUser) {
  console.log('🔧 openUserModal called with:', editUser ? 'Edit mode' : 'Add mode');
  console.log('🔧 Edit user data:', editUser);
  
  // Check if we're on the users page and modal is loaded
  const mainContent = document.getElementById('main-content');
  
  if (!mainContent) {
    console.error('❌ Main content not found!');
    showToast('Please navigate to the Users page first.', 'error');
    return;
  }
  
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  
  if (!modal) {
    console.error('❌ User modal not found!');
    console.log('🔍 Available elements in main-content:', mainContent.querySelectorAll('*[id]'));
    showToast('User modal not found. Please navigate to the Users page first.', 'error');
    return;
  }
  
  if (!form) {
    console.error('❌ User form not found!');
    showToast('User form not found. Please refresh the page.', 'error');
    return;
  }
  
  // Clear any auto-filled values to prevent browser auto-fill
  console.log('🔧 Clearing auto-filled values...');
  const inputs = form.querySelectorAll('input[type="text"], input[type="email"]');
  inputs.forEach(input => {
    if (!input.hasAttribute('data-user-filled')) {
      input.value = '';
    }
  });
  
  console.log('🔧 Modal element found:', modal);
  console.log('🔧 Form element found:', form);
  
  document.getElementById('userModalTitle').textContent = editUser ? 'Edit User' : 'Add User';
  form.reset();
  editingUserId = null;
  
  // Show/hide password fields
  const passwordGroups = form.querySelectorAll('.password-group');
  const passwordInput = form.querySelector('#userPassword');
  
  if (editUser) {
    editingUserId = editUser.user_id;
    document.getElementById('userId').value = editUser.user_id;
    const [fn, ...lnParts] = (editUser.name || '').split(' ');
    document.getElementById('userFirstName').value = fn || '';
    document.getElementById('userLastName').value = lnParts.join(' ') || '';
    document.getElementById('userEmail').value = editUser.email;
    document.getElementById('userCategory').value = editUser.tester_type_id || '';
    document.getElementById('userStatus').value = editUser.status;
    document.getElementById('userDateCreated').value = formatDateForInput(editUser.date_created);
    
    // Show both password groups
    passwordGroups.forEach(g => g.style.display = '');
    if (passwordInput) passwordInput.required = false;
    

  } else {
    document.getElementById('userDateCreated').value = new Date().toISOString().slice(0, 10);
    
    // Only show new password group
    passwordGroups.forEach(g => g.style.display = '');
    if (passwordInput) passwordInput.required = true;
  }
  
  if (passwordInput) passwordInput.value = '';
  
  console.log('🔧 Setting modal display to flex...');
  modal.style.display = 'flex';
  
  // Force modal to be visible with important styles
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.zIndex = '10000';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  
  // Check if modal is actually visible
  setTimeout(() => {
    const computedStyle = window.getComputedStyle(modal);
    console.log('🔧 Modal display style:', computedStyle.display);
    console.log('🔧 Modal visibility:', computedStyle.visibility);
    console.log('🔧 Modal opacity:', computedStyle.opacity);
    console.log('🔧 Modal z-index:', computedStyle.zIndex);
    console.log('🔧 Modal position:', computedStyle.position);
    console.log('🔧 Modal is in viewport:', modal.offsetParent !== null);
  }, 100);
  
  // Focus on first input
  const firstInput = document.getElementById('userFirstName');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 200);
  }
}

function closeUserModal() {
  document.getElementById('userModal').style.display = 'none';
  editingUserId = null;
}

function handleUserFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const firstName = document.getElementById('userFirstName').value.trim();
  const lastName = document.getElementById('userLastName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const category = document.getElementById('userCategory').value;
  const status = document.getElementById('userStatus').value;
  const dateCreated = document.getElementById('userDateCreated').value;
  const passwordInput = document.getElementById('userPassword');
  const password = passwordInput ? passwordInput.value : '';
  
  // Create or update via Admin API
  const jwtToken = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
  if (!jwtToken) {
    showToast('Not authenticated. Please log in again.', 'error');
    return;
  }

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email,
    tester_type_id: category || null,
    account_status: status,
    password: password || undefined
  };

  const isEdit = Boolean(id);
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit ? `/api/admin/users/${id}` : '/api/admin/users';

  fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.message || `Request failed (${res.status})`);
    }
    return data;
  })
  .then(() => {
    closeUserModal();
    fetchUsers(currentUserPage, userRecordsPerPage);
    
    // Show success toast
    if (isEdit) {
      showToast('User updated successfully!', 'success');
    } else {
      showToast('User added successfully!', 'success');
    }
  })
  .catch(err => {
    console.error('Save user error:', err);
    showToast(err.message || 'Failed to save user', 'error');
  });
}

// Admin password functions using logged-in user's password
async function addUserWithAdminPass() {
  console.log('🔧 addUserWithAdminPass called');
  showAdminPasswordModal('add', () => {
    console.log('🔧 Password verified, navigating to users page...');
    // Navigate to users page first
    if (typeof switchPage === 'function') {
      switchPage('users');
    }
    // Wait for page to load, then open modal
    setTimeout(() => {
      console.log('🔧 Opening user modal...');
      openUserModal();
      const nameInput = document.getElementById('userFirstName');
      if (nameInput) {
        console.log('🔧 Focusing on first name input');
        nameInput.focus();
      } else {
        console.error('❌ userFirstName input not found');
      }
    }, 500);
  });
}

async function editUserWithAdminPass(user) {
  console.log('🔧 editUserWithAdminPass called for user:', user);
  showAdminPasswordModal('update', async () => {
    console.log('🔧 Password verified, navigating to users page...');
    // Navigate to users page first
    if (typeof switchPage === 'function') {
      switchPage('users');
    }
    
    // Wait for page to load, then fetch user details and open modal
    setTimeout(async () => {
      console.log('🔧 Fetching user details...');
      try {
        const jwtToken = localStorage.getItem('jwt_token') || 
                         localStorage.getItem('sessionToken') || 
                         localStorage.getItem('session_token');
        const response = await fetch(`/api/admin/users/${user.user_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Map to expected edit shape
            const u = result.user;
            openUserModal({
              user_id: u.user_id,
              name: `${u.first_name} ${u.last_name}`.trim(),
              email: u.email,
              tester_type_id: u.tester_type_id,
              status: u.account_status,
              date_created: u.created_at
            });
          } else {
            console.error('Error fetching user details:', result.error);
            openUserModal(user); // Fallback to basic user data
          }
        } else {
          console.error('Error fetching user details:', response.status);
          openUserModal(user); // Fallback to basic user data
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        openUserModal(user); // Fallback to basic user data
      }
      
      const nameInput = document.getElementById('userFirstName');
      if (nameInput) {
        console.log('🔧 Focusing on first name input for edit');
        nameInput.focus();
      } else {
        console.error('❌ userFirstName input not found for edit');
      }
    }, 500);
  });
}

async function deleteUserWithAdminPass(userId) {
  showAdminPasswordModal('delete', () => {
    showUserConfirmModal('Are you sure you want to delete this user? This action cannot be undone.', () => {
      // In a real implementation, you would make an API call to delete the user
      console.log('Deleting user:', userId);
      
      // Refresh the user list
      fetchUsers(currentUserPage, userRecordsPerPage);
    });
  });
}

// Admin Account Modal Functions
async function openAdminAccountModal() {
  const modal = document.getElementById('adminAccountModal');
  
  if (modal) {
    modal.style.display = 'flex';
    
    // Only load admin data if form is empty (prevent auto-fill on every open)
    const emailField = document.getElementById('adminEmail');
    if (!emailField || !emailField.value) {
      console.log('🔧 Loading admin data for first time...');
      await loadCurrentAdminData();
    } else {
      console.log('🔧 Admin data already loaded, skipping auto-fill...');
    }
    
    // Focus on first input
    const firstInput = document.getElementById('adminAccount');
    if (firstInput) firstInput.focus();
  } else {
    console.error('adminAccountModal element not found!');
  }
}

function closeAdminAccountModal() {
  const modal = document.getElementById('adminAccountModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function loadCurrentAdminData() {
  // Get current admin info from session
  let currentAdmin = getCurrentAdminInfo();

  // If cached admin is missing critical fields, force refresh from API
  const needsEnrichment = !currentAdmin || (!currentAdmin.contact_number && !currentAdmin.phone) || !(currentAdmin.created_at || currentAdmin.createdAt || currentAdmin.created || currentAdmin.createdDate);

  // If no admin data in localStorage OR needs enrichment, try to fetch from API using logged-in id
  if (needsEnrichment) {
    try {
      const jwtToken = localStorage.getItem('jwt_token') || 
                       localStorage.getItem('sessionToken') || 
                       localStorage.getItem('session_token');
      
      if (jwtToken) {
        // Try a profile endpoint first
        let response = await fetch('/api/admin/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          // Fallback to generic users/profile (some builds expose it here)
          response = await fetch('/api/users/profile', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json'
            }
          });
        }

        if (!response.ok) {
          // Final fallback: fetch by id
          const uid = getUserIdFromToken();
          if (uid) {
            response = await fetch(`/api/admin/users/${uid}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Content-Type': 'application/json'
              }
            });
          }
        }

        if (response && response.ok) {
          const result = await response.json();
          if (result.success) {
            // Different endpoints return different shapes
            currentAdmin = result.admin || result.user || result.data || result;
            // Store in localStorage for future use
            localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching admin profile:', error);
    }
  }
  
  if (currentAdmin) {
    console.log('Loading admin data:', currentAdmin);
    
    // Populate form fields with current admin data
    const emailField = document.getElementById('adminEmail');
    const usernameField = document.getElementById('adminUsername');
    const firstNameField = document.getElementById('adminFirstName');
    const lastNameField = document.getElementById('adminLastName');
    const phoneField = document.getElementById('adminPhone');
    const createdField = document.getElementById('adminCreated');
    
    if (emailField) emailField.value = currentAdmin.email || '';
    if (usernameField) usernameField.value = currentAdmin.username || '';
    if (firstNameField) firstNameField.value = currentAdmin.first_name || '';
    if (lastNameField) lastNameField.value = currentAdmin.last_name || '';
    
    if (phoneField) {
      phoneField.value = currentAdmin.contact_number || currentAdmin.phone || '';
    }
    
    if (createdField) {
      const rawCreated = currentAdmin.created_at || currentAdmin.createdAt || currentAdmin.created || currentAdmin.createdDate;
      if (rawCreated) {
        const createdDate = new Date(rawCreated).toISOString().split('T')[0];
        createdField.value = createdDate;
      } else {
        createdField.value = 'Not available';
      }
    }
    
    console.log('Admin data loaded successfully');
  } else {
    console.warn('No admin data found');
    // Set default values if no data available
    const emailField = document.getElementById('adminEmail');
    const usernameField = document.getElementById('adminUsername');
    const firstNameField = document.getElementById('adminFirstName');
    const lastNameField = document.getElementById('adminLastName');
    
    if (emailField) emailField.value = '';
    if (usernameField) usernameField.value = '';
    if (firstNameField) firstNameField.value = '';
    if (lastNameField) lastNameField.value = '';
  }
}

async function handleAdminAccountFormSubmit(e) {
  e.preventDefault();
  
  const account = document.getElementById('adminEmail').value.trim();
  const username = (document.getElementById('adminUsername').value || '').trim();
  const firstName = document.getElementById('adminFirstName').value.trim();
  const lastName = document.getElementById('adminLastName').value.trim();
  const password = document.getElementById('adminPassword').value;
  const phone = document.getElementById('adminPhone').value.trim();
  
  // Validate required fields (password optional)
  if (!account || !firstName || !lastName) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }
  
  try {
    const jwtToken = localStorage.getItem('jwt_token') || 
                     localStorage.getItem('sessionToken') || 
                     localStorage.getItem('session_token');
    
    if (!jwtToken) {
      alert('No authentication token found. Please log in again.');
      return;
    }

    // Debug token
    console.log('JWT Token found:', jwtToken.substring(0, 20) + '...');
    
    // Decode token to check if it's valid
    try {
      const parts = jwtToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        console.log('Token payload:', payload);
        console.log('Token expires:', new Date(payload.exp * 1000));
        console.log('Token user_id:', payload.user_id);
      }
    } catch (e) {
      console.error('Invalid JWT token format:', e);
      alert('Invalid authentication token. Please log in again.');
      return;
    }
    
    // Prepare update data
    const updateData = {
      email: account,
      username: username || undefined,
      first_name: firstName,
      last_name: lastName,
      contact_number: phone
    };
    if (password && password.trim() !== '') {
      updateData.password = password;
    }
    
    console.log('Updating admin account:', updateData);
    
    // Make API call to update admin profile
    const response = await fetch('/api/admin/update-profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        // Update localStorage with new data
        const currentAdmin = getCurrentAdminInfo();
        if (currentAdmin) {
          currentAdmin.email = account;
          if (username) currentAdmin.username = username;
          currentAdmin.first_name = updateData.first_name;
          currentAdmin.last_name = updateData.last_name;
          currentAdmin.contact_number = phone;
          localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
        }
        
        // Show success toast similar to logout
        (function showSuccessToast(message){
          var toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#4caf50;color:white;padding:15px 20px;border-radius:8px;z-index:10000;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
          toast.textContent = message;
          document.body.appendChild(toast);
          setTimeout(()=>{ if (toast.parentNode) toast.parentNode.removeChild(toast); }, 1200);
        })('Profile updated successfully');
        // Refresh latest profile and close modal
        await loadCurrentAdminData();
        closeAdminAccountModal();
      } else {
        alert(`Error updating account: ${result.error || result.message || 'Unknown error'}`);
      }
    } else {
      // Try to read server error body for details
      let message = 'Error updating account. Please try again.';
      try {
        const text = await response.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            message = json.error || json.message || text;
          } catch (_) {
            message = text;
          }
        }
      } catch (_) {}
      console.error('Update profile failed:', message);
      alert(message);
    }
  } catch (error) {
    console.error('Error updating admin account:', error);
    alert('Error updating account. Please try again.');
  }
}

function toggleAdminPasswordVisibility() {
  const passwordInput = document.getElementById('adminPassword');
  const toggleIcon = document.getElementById('toggleAdminPasswordIcon');
  
  if (passwordInput && toggleIcon) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleIcon.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleIcon.textContent = '👁️';
    }
  }
}

function initUserManager() {
  console.log('🔧 initUserManager called');
  
  // Check if already initialized to prevent duplicate initialization
  if (window.userManagerInitialized) {
    console.log('🔧 User manager already initialized, skipping...');
    return;
  }
  
  // Set up event listeners
  const addUserBtn = document.getElementById('addUserBtn');
  const cancelUserBtn = document.getElementById('cancelUserBtn');
  const userForm = document.getElementById('userForm');
  const userTableBody = document.getElementById('userTableBody');
  const userSearch = document.getElementById('userSearch');
  const userStatusFilter = document.getElementById('userStatusFilter');
  const userDateStart = document.getElementById('userDateStart');
  const userDateEnd = document.getElementById('userDateEnd');
  const userFilterBtn = document.getElementById('userFilterBtn');
  const userDateRangeFilter = document.getElementById('userDateRangeFilter');
  const userWeekPickerGroup = document.getElementById('userWeekPickerGroup');
  const userMonthPickerGroup = document.getElementById('userMonthPickerGroup');
  const userYearPickerGroup = document.getElementById('userYearPickerGroup');
  const userCustomDateGroup = document.getElementById('userCustomDateGroup');
  const userWeekPicker = document.getElementById('userWeekPicker');
  const userMonthPicker = document.getElementById('userMonthPicker');
  const userYearPicker = document.getElementById('userYearPicker');
  
  if (addUserBtn) {
    addUserBtn.onclick = addUserWithAdminPass;
  }
  
  if (cancelUserBtn) {
    cancelUserBtn.onclick = closeUserModal;
  }
  
  if (userForm) {
    userForm.onsubmit = handleUserFormSubmit;
  }
  
  if (userTableBody) {
    userTableBody.onclick = function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
      
      const id = btn.getAttribute('data-id');
    if (btn.classList.contains('edit')) {
        const user = usersData.find(u => u.user_id == id);
        if (user) {
      editUserWithAdminPass(user);
        }
      } else if (btn.classList.contains('deactivate')) {
        // Require admin password, then deactivate user via API
        const jwtToken = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
        if (!jwtToken) { 
          showToast('Not authenticated. Please log in.', 'error');
          return; 
        }
        
        showAdminPasswordModal('deactivate', () => {
          showUserConfirmModal('Are you sure you want to deactivate this user?', () => {
          // Use actual username from dataset (no hardcoded derivation)
          const row = usersData.find(u => u.user_id == id);
          const username = row && row.username ? row.username : null;
          const url = username ? `/api/admin/users/by-username/${encodeURIComponent(username)}/status` : `/api/admin/users/${id}/status`;
          return fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ account_status: 'inactive' })
          }).then(async (res) => {
            if (!res) return;
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) {
              throw new Error(data.error || data.message || `Deactivate failed (${res.status})`);
            }
            showToast('User deactivated successfully', 'success');
            fetchUsers(currentUserPage, userRecordsPerPage);
          }).catch(err => {
            if (!err) return;
            console.error('Deactivate user error:', err);
            showToast(err.message || 'Failed to deactivate user', 'error');
          });
          });
        });
      } else if (btn.classList.contains('reactivate')) {
        // Require admin password, then reactivate user via API
        const jwtToken = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
        if (!jwtToken) { 
          showToast('Not authenticated. Please log in.', 'error');
          return; 
        }
        
        showAdminPasswordModal('reactivate', () => {
          showUserConfirmModal('Are you sure you want to reactivate this user?', () => {
          // Use actual username from dataset (no hardcoded derivation)
          const row = usersData.find(u => u.user_id == id);
          const username = row && row.username ? row.username : null;
          const url = username ? `/api/admin/users/by-username/${encodeURIComponent(username)}/status` : `/api/admin/users/${id}/status`;
          return fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ account_status: 'active' })
          }).then(async (res) => {
            if (!res) return;
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) {
              throw new Error(data.error || data.message || `Reactivate failed (${res.status})`);
            }
            showToast('User reactivated successfully', 'success');
            fetchUsers(currentUserPage, userRecordsPerPage);
          }).catch(err => {
            if (!err) return;
            console.error('Reactivate user error:', err);
            showToast(err.message || 'Failed to reactivate user', 'error');
          });
          });
        });
      }
    };
  }
  
  // Filter event listeners
  // Filters should only apply when clicking the Filter button
  if (userSearch) {
    userSearch.oninput = null;
    // Aggressively prevent auto-fill on search input
    userSearch.addEventListener('focus', function() {
      console.log('🔍 Search input focused, clearing auto-fill...');
      if (this.value && !this.hasAttribute('data-user-typed')) {
        this.value = '';
      }
    });
    
    userSearch.addEventListener('input', function() {
      this.setAttribute('data-user-typed', 'true');
    });
    
    // Clear auto-fill immediately on page load and force dark styling
    setTimeout(() => {
      if (userSearch.value && !userSearch.hasAttribute('data-user-typed')) {
        console.log('🔍 Clearing auto-filled search input on page load...');
        userSearch.value = '';
      }
      // Force dark styling to prevent white background
      userSearch.style.backgroundColor = '#181f36';
      userSearch.style.background = '#181f36';
      userSearch.style.color = '#e0e6f6';
      userSearch.style.border = '1px solid #2a3b6d';
    }, 100);
    
    // Prevent password modal from affecting search input
    userSearch.addEventListener('blur', function() {
      setTimeout(() => {
        if (this.value && !this.hasAttribute('data-user-typed')) {
          console.log('🔍 Clearing search input after blur to prevent password conflict...');
          this.value = '';
        }
      }, 100);
    });
    
    // Additional protection: clear on any change
    userSearch.addEventListener('change', function() {
      if (this.value && !this.hasAttribute('data-user-typed')) {
        console.log('🔍 Clearing auto-filled search input on change...');
        this.value = '';
      }
      // Force dark styling
      this.style.backgroundColor = '#181f36';
      this.style.background = '#181f36';
      this.style.color = '#e0e6f6';
      this.style.border = '1px solid #2a3b6d';
    });
    
    // Mutation observer to detect styling changes and force dark theme
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          // Force dark styling if browser tries to change it
          userSearch.style.backgroundColor = '#181f36';
          userSearch.style.background = '#181f36';
          userSearch.style.color = '#e0e6f6';
          userSearch.style.border = '1px solid #2a3b6d';
        }
      });
    });
    
    // Start observing the search input for style changes
    observer.observe(userSearch, { attributes: true, attributeFilter: ['style'] });
    
    // Force dark styling on all input fields to prevent white background
    const allInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="date"], input[type="week"], input[type="month"], input[type="number"]');
    allInputs.forEach(input => {
      // Force dark styling immediately
      input.style.backgroundColor = '#181f36';
      input.style.background = '#181f36';
      input.style.color = '#e0e6f6';
      input.style.border = '1px solid #2a3b6d';
      
      // Add focus event to maintain dark styling
      input.addEventListener('focus', function() {
        this.style.backgroundColor = '#181f36';
        this.style.background = '#181f36';
        this.style.color = '#e0e6f6';
        this.style.border = '1px solid #4a9eff';
      });
      
      // Add blur event to maintain dark styling
      input.addEventListener('blur', function() {
        this.style.backgroundColor = '#181f36';
        this.style.background = '#181f36';
        this.style.color = '#e0e6f6';
        this.style.border = '1px solid #2a3b6d';
      });
      
      // Add input event to maintain dark styling while typing
      input.addEventListener('input', function() {
        this.style.backgroundColor = '#181f36';
        this.style.background = '#181f36';
        this.style.color = '#e0e6f6';
      });
    });
  }
  
  if (userStatusFilter) {
    userStatusFilter.onchange = null;
  }

  if (userFilterBtn){
    userFilterBtn.onclick = handleUserFilters;
  }
  
  // Date range handlers
  function toggleUserPickers(range){
    if (userWeekPickerGroup) userWeekPickerGroup.style.display = 'none';
    if (userMonthPickerGroup) userMonthPickerGroup.style.display = 'none';
    if (userYearPickerGroup) userYearPickerGroup.style.display = 'none';
    if (userCustomDateGroup) userCustomDateGroup.style.display = 'none';
    if (range === 'weekly' && userWeekPickerGroup) userWeekPickerGroup.style.display = 'block';
    if (range === 'monthly' && userMonthPickerGroup) userMonthPickerGroup.style.display = 'block';
    if (range === 'yearly' && userYearPickerGroup) userYearPickerGroup.style.display = 'block';
    if (range === 'custom' && userCustomDateGroup) userCustomDateGroup.style.display = 'flex';
    if (range === 'weekly' && userWeekPicker && !userWeekPicker.value) userWeekPicker.value = getCurrentISOWeek();
    if (range === 'monthly' && userMonthPicker && !userMonthPicker.value) userMonthPicker.value = getCurrentMonth();
    if (range === 'yearly' && userYearPicker && !userYearPicker.value) userYearPicker.value = String(new Date().getFullYear());
  }
  function getCurrentISOWeek(){ const t=new Date(); const w=getISOWeekNumber(t); return `${t.getFullYear()}-W${String(w).padStart(2,'0')}`; }
  function getCurrentMonth(){ const t=new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`; }

  if (userDateRangeFilter){
    userDateRangeFilter.onchange = function(){ toggleUserPickers(userDateRangeFilter.value); };
    toggleUserPickers(userDateRangeFilter.value);
  }
  if (userWeekPicker) userWeekPicker.onchange = null;
  if (userMonthPicker) userMonthPicker.onchange = null;
  if (userYearPicker) userYearPicker.onchange = null;

  if (userDateStart) {
    userDateStart.onchange = null;
  }
  
  if (userDateEnd) {
    userDateEnd.onchange = null;
  }
  
  // Close modal on outside click
  const userModal = document.getElementById('userModal');
  if (userModal) {
    userModal.onclick = e => {
      if (e.target === userModal) closeUserModal();
    };
  }

  // Bind admin account modal events
  bindAdminAccountModalEvents();
  
  // Show/hide password toggle for new password
  const toggleBtn = document.getElementById('toggleUserPassword');
  const passwordInput = document.getElementById('userPassword');
  const icon = document.getElementById('toggleUserPasswordIcon');
  
  if (toggleBtn && passwordInput && icon) {
    toggleBtn.onclick = function() {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = '\u{1F441}\u{FE0E}';
        toggleBtn.setAttribute('aria-label', 'Hide password');
      } else {
        passwordInput.type = 'password';
        icon.textContent = '\u{1F441}';
        toggleBtn.setAttribute('aria-label', 'Show password');
      }
    };
  }
  
  // Show/hide password toggle for current password
  const toggleCurrentBtn = document.getElementById('toggleCurrentUserPassword');
  const currentPasswordInput = document.getElementById('userCurrentPassword');
  const currentIcon = document.getElementById('toggleCurrentUserPasswordIcon');
  
  if (toggleCurrentBtn && currentPasswordInput && currentIcon) {
    toggleCurrentBtn.style.display = '';
    // For admin accounts, show current password by default
    toggleCurrentBtn.onclick = function() {
      if (currentPasswordInput.type === 'password') {
        currentPasswordInput.type = 'text';
        currentIcon.textContent = '\u{1F441}\u{FE0E}';
        toggleCurrentBtn.setAttribute('aria-label', 'Hide current password');
      } else {
        currentPasswordInput.type = 'password';
        currentIcon.textContent = '\u{1F441}';
        toggleCurrentBtn.setAttribute('aria-label', 'Show current password');
      }
    };
  }
  
  // Mark as initialized
  window.userManagerInitialized = true;
  
  // Always fetch users when page is loaded to ensure fresh data
  // This ensures data is refreshed when navigating from other sidebar pages
  console.log('🔧 Fetching users...');
  fetchUsers(1, userRecordsPerPage);
}

// Export functions and variables for global access
window.changeUserPage = changeUserPage;
window.changeUserRecordsPerPage = changeUserRecordsPerPage;
window.initUserManager = initUserManager;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
// Export variables for SPA navigation
window.usersData = usersData;
window.currentUserPage = currentUserPage;
window.userRecordsPerPage = userRecordsPerPage;
window.currentUserFilters = currentUserFilters;

// Test function to manually open user modal
window.testUserModal = function() {
  console.log('🧪 Testing user modal...');
  openUserModal();
};

// Test function to check if modal elements exist
window.checkUserModalElements = function() {
  console.log('🔍 Checking user modal elements...');
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  const firstName = document.getElementById('userFirstName');
  const lastName = document.getElementById('userLastName');
  const email = document.getElementById('userEmail');
  
  console.log('🔍 Modal elements found:', {
    modal: !!modal,
    form: !!form,
    firstName: !!firstName,
    lastName: !!lastName,
    email: !!email
  });
  
  if (modal) {
    console.log('🔍 Modal display style:', modal.style.display);
    console.log('🔍 Modal computed style:', window.getComputedStyle(modal).display);
    console.log('🔍 Modal position:', window.getComputedStyle(modal).position);
    console.log('🔍 Modal z-index:', window.getComputedStyle(modal).zIndex);
  }
  
  return { modal, form, firstName, lastName, email };
};

// Test function to force open modal
window.forceOpenUserModal = function() {
  console.log('🧪 Force opening user modal...');
  const modal = document.getElementById('userModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.zIndex = '10000';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    console.log('✅ Modal forced open');
  } else {
    console.error('❌ Modal not found');
  }
};

// Function to reset user manager (useful for debugging)
window.resetUserManager = function() {
  console.log('🔄 Resetting user manager...');
  window.userManagerInitialized = false;
  usersData = [];
  currentUserPage = 1;
  userRecordsPerPage = 25;
  console.log('✅ User manager reset');
};
// Admin Account Modal Event Binding Function
function bindAdminAccountModalEvents() {
  const adminAccountModal = document.getElementById('adminAccountModal');
  const adminAccountForm = document.getElementById('adminAccountForm');
  const cancelAdminAccountBtn = document.getElementById('cancelAdminAccountBtn');
  const closeAdminAccountBtn = document.getElementById('closeAdminAccountBtn');
  const toggleAdminPasswordBtn = document.getElementById('toggleAdminPassword');

  if (adminAccountModal) {
    adminAccountModal.onclick = e => {
      if (e.target === adminAccountModal) closeAdminAccountModal();
    };
  }

  if (adminAccountForm) {
    adminAccountForm.onsubmit = handleAdminAccountFormSubmit;
  }

  if (cancelAdminAccountBtn) {
    cancelAdminAccountBtn.onclick = closeAdminAccountModal;
  }

  if (closeAdminAccountBtn) {
    closeAdminAccountBtn.onclick = closeAdminAccountModal;
  }

  if (toggleAdminPasswordBtn) {
    toggleAdminPasswordBtn.onclick = toggleAdminPasswordVisibility;
  }
}

window.openAdminAccountModal = openAdminAccountModal;
window.closeAdminAccountModal = closeAdminAccountModal;
window.handleAdminAccountFormSubmit = handleAdminAccountFormSubmit;
window.toggleAdminPasswordVisibility = toggleAdminPasswordVisibility;
window.bindAdminAccountModalEvents = bindAdminAccountModalEvents; 