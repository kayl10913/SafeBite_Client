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
  return null;
}

// Function to prompt for admin password using the logged-in user's info
function promptForAdminPassword(action) {
  const adminInfo = getCurrentAdminInfo();
  if (!adminInfo) {
    alert('Admin session not found. Please log in again.');
    return null;
  }
  
  const promptMessage = `Enter password for ${adminInfo.username || 'admin'} to ${action}:`;
  return window.prompt(promptMessage);
}

// Function to verify admin password
async function verifyAdminPassword(password) {
  if (!password) return false;
  
  try {
    const jwtToken = localStorage.getItem('jwt_token') || 
                     localStorage.getItem('sessionToken') || 
                     localStorage.getItem('session_token');
    const response = await fetch('/api/admin/verify-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: password })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.success === true;
    }
  } catch (error) {
    console.error('Error verifying password:', error);
  }
  
  return false;
}

// Function to fetch users from API
async function fetchUsers(page = 1, limit = 25) {
  try {
    // Get current filters
    const search = document.getElementById('userSearch')?.value || '';
    const role = document.getElementById('userRoleFilter')?.value || '';
    const status = document.getElementById('userStatusFilter')?.value || '';
    const dateStart = document.getElementById('userDateStart')?.value || '';
    const dateEnd = document.getElementById('userDateEnd')?.value || '';
    
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
        name: `${u.first_name} ${u.last_name}`.trim(),
        email: u.email,
        status: u.account_status,
        date_created: u.created_at
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
  tbody.innerHTML = usersData.map(user => `
    <tr>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${formatDate(user.date_created)}</td>
      <td><span class="status-badge status-${user.status.toLowerCase()}">${user.status}</span></td>
      <td>
        <button class="action-btn edit" data-id="${user.user_id}">Edit</button>
        <button class="action-btn delete" data-id="${user.user_id}">Delete</button>
        </td>
      </tr>
    `).join('');
}

function renderUserPagination(totalRecords) {
  const paginationDiv = document.getElementById('userPagination');
  if (!paginationDiv) return;
  
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

// Function to format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Mock user data for editing (since we don't have full user details from the list API)
let editingUserId = null;

function openUserModal(editUser) {
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  document.getElementById('userModalTitle').textContent = editUser ? 'Edit User' : 'Add User';
  form.reset();
  editingUserId = null;
  
  // Show/hide password fields
  const passwordGroups = form.querySelectorAll('.password-group');
  const passwordInput = form.querySelector('#userPassword');
  
  if (editUser) {
    editingUserId = editUser.user_id;
    document.getElementById('userId').value = editUser.user_id;
    document.getElementById('userName').value = editUser.name;
    document.getElementById('userEmail').value = editUser.email;
    document.getElementById('userStatus').value = editUser.status;
    document.getElementById('userDateCreated').value = editUser.date_created;
    
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
  modal.style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('userModal').style.display = 'none';
  editingUserId = null;
}

function handleUserFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const status = document.getElementById('userStatus').value;
  const dateCreated = document.getElementById('userDateCreated').value;
  const passwordInput = document.getElementById('userPassword');
  const password = passwordInput ? passwordInput.value : '';
  
  // For now, just close the modal and refresh the data
  // In a real implementation, you would make an API call to create/update the user
  console.log('User form submitted:', { id, name, email, status, dateCreated, password });
  
  closeUserModal();
  
  // Refresh the user list
  fetchUsers(currentUserPage, userRecordsPerPage);
}

// Admin password functions using logged-in user's password
async function addUserWithAdminPass() {
  const password = promptForAdminPassword('add a new user');
  if (password === null) return; // User cancelled
  
  const isValid = await verifyAdminPassword(password);
  if (isValid) {
    openUserModal();
    const nameInput = document.getElementById('userName');
    if (nameInput) nameInput.focus();
  } else {
    alert('Incorrect password.');
  }
}

async function editUserWithAdminPass(user) {
  const password = promptForAdminPassword('edit this user');
  if (password === null) return; // User cancelled
  
  const isValid = await verifyAdminPassword(password);
  if (isValid) {
    // Fetch full user details including password
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
    
    const nameInput = document.getElementById('userName');
    if (nameInput) nameInput.focus();
  } else {
    alert('Incorrect password.');
  }
}

async function deleteUserWithAdminPass(userId) {
  const password = promptForAdminPassword('delete this user');
  if (password === null) return; // User cancelled
  
  const isValid = await verifyAdminPassword(password);
  if (isValid) {
    if (confirm('Delete this user?')) {
      // In a real implementation, you would make an API call to delete the user
      console.log('Deleting user:', userId);
      
      // Refresh the user list
      fetchUsers(currentUserPage, userRecordsPerPage);
    }
  } else {
    alert('Incorrect password.');
  }
}

function initUserManager() {
  // Set up event listeners
  const addUserBtn = document.getElementById('addUserBtn');
  const cancelUserBtn = document.getElementById('cancelUserBtn');
  const userForm = document.getElementById('userForm');
  const userTableBody = document.getElementById('userTableBody');
  const userSearch = document.getElementById('userSearch');
  const userStatusFilter = document.getElementById('userStatusFilter');
  const userDateStart = document.getElementById('userDateStart');
  const userDateEnd = document.getElementById('userDateEnd');
  
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
      } else if (btn.classList.contains('delete')) {
        deleteUserWithAdminPass(id);
      }
    };
  }
  
  // Filter event listeners
  if (userSearch) {
    userSearch.oninput = handleUserFilters;
  }
  
  if (userStatusFilter) {
    userStatusFilter.onchange = handleUserFilters;
  }
  
  if (userDateStart) {
    userDateStart.onchange = handleUserFilters;
  }
  
  if (userDateEnd) {
    userDateEnd.onchange = handleUserFilters;
  }
  
  // Close modal on outside click
  const userModal = document.getElementById('userModal');
  if (userModal) {
    userModal.onclick = e => {
      if (e.target === userModal) closeUserModal();
    };
  }
  
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
  
  // Initial fetch from API
  fetchUsers(1, userRecordsPerPage);
}

// Export functions for global access
window.changeUserPage = changeUserPage;
window.changeUserRecordsPerPage = changeUserRecordsPerPage;
window.initUserManager = initUserManager; 