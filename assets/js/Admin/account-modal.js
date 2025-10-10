// js/account-modal.js - Handles admin account modal open/close and form

document.addEventListener('DOMContentLoaded', function() {
  // Admin account data (demo)
  let adminAccount = {
    username: 'admin@example.com',
    name: 'Mark',
    password: '••••••••',
    role: 'Admin',
    phone: '+1 555-123-4567',
    created: '2024-01-01'
  };

  const modal = document.getElementById('accountModal');
  const openBtn = document.getElementById('sidebarAccountBtn');
  const closeBtn = document.getElementById('accountModalClose');
  const cancelBtn = document.getElementById('accountModalCancel');
  const form = document.getElementById('accountModalForm');

  function fillModalFields() {
    document.getElementById('account-username').value = adminAccount.username;
    document.getElementById('account-name').value = adminAccount.name;
    document.getElementById('account-password').value = adminAccount.password;
    document.getElementById('account-role').value = adminAccount.role;
    document.getElementById('account-phone').value = adminAccount.phone;
    document.getElementById('account-created').value = adminAccount.created;
  }

  function updateAccountFromFields() {
    adminAccount.username = document.getElementById('account-username').value;
    adminAccount.name = document.getElementById('account-name').value;
    adminAccount.password = document.getElementById('account-password').value;
    adminAccount.role = document.getElementById('account-role').value;
    adminAccount.phone = document.getElementById('account-phone').value;
    adminAccount.created = document.getElementById('account-created').value;
  }

  if (openBtn) {
    openBtn.addEventListener('click', function() {
      modal.style.display = 'flex';
      fillModalFields();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      updateAccountFromFields();
      // Save logic here (optional: persist to backend)
      modal.style.display = 'none';
    });
  }

  // Close modal on overlay click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}); 