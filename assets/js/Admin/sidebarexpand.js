// js/sidebarexpand.js
// Handles sidebar expand/collapse and tooltip for truncated items.

document.addEventListener('DOMContentLoaded', () => {
  const sidebarLogo = document.getElementById('sidebarLogo');
  const sidebar = document.getElementById('sidebar');

  if (!sidebarLogo || !sidebar) {
    console.error("Sidebar elements not found. Make sure #sidebarLogo and #sidebar exist.");
    return;
  }

  function checkSidebarTextOverflow() {
    if (sidebar.classList.contains('collapsed')) {
      document.querySelectorAll('.nav-item.is-truncated').forEach(item => {
        item.classList.remove('is-truncated');
      });
      return;
    }

    document.querySelectorAll('.nav-text').forEach(el => {
      el.setAttribute('data-fulltext', el.textContent.trim());
      const isOverflowing = el.scrollWidth > el.clientWidth;
      const parentNavItem = el.closest('.nav-item');

      if (isOverflowing) {
        parentNavItem.classList.add('is-truncated');
      } else {
        parentNavItem.classList.remove('is-truncated');
      }
    });
  }

  sidebarLogo.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('expanded');
    setTimeout(checkSidebarTextOverflow, 300); 
  });

  // Initial checks
  setTimeout(checkSidebarTextOverflow, 100);
  window.addEventListener('resize', checkSidebarTextOverflow);
});
