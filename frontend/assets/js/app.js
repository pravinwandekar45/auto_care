/**
 * AutoCare – Smart Vehicle Service & Maintenance Management
 * Core Application Framework & Global Utilities
 */

const AutoCareApp = (function () {
  // Toast Engine
  const Toast = {
    show: function (type, title, message, duration = 4000) {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `autocare-toast toast-${type}`;
      
      const icons = {
        success: 'fa-circle-check text-success',
        warning: 'fa-triangle-exclamation text-warning',
        danger: 'fa-circle-xmark text-danger',
        info: 'fa-circle-info text-info'
      };

      toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info} fa-lg mt-1"></i>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 0.88rem; color: #0D1B2A; margin-bottom: 2px;">${title}</div>
          <div style="font-size: 0.8rem; color: #607D8B;">${message}</div>
        </div>
        <button type="button" class="btn-close btn-close-sm" style="font-size: 0.65rem;" onclick="this.parentElement.remove()"></button>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'fadeOutRight 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  };

  // Formatters
  function formatCurrency(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Setup Sidebar Toggle for Mobile & Responsive
  function setupSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    let backdrop = document.querySelector('.sidebar-backdrop');

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.innerWidth < 992) {
          sidebar.classList.toggle('show');
          backdrop.classList.toggle('show');
        } else {
          sidebar.classList.toggle('collapsed');
        }
      });
    }

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('show');
      backdrop.classList.remove('show');
    });
  }

  // Setup Topbar Notifications Dropdown
  function setupNotifications() {
    const notifContainer = document.getElementById('topbar-notifications');
    const badge = document.getElementById('notification-badge');
    if (!notifContainer) return;

    const notifs = AutoCareData.getNotifications();
    const unreadCount = notifs.filter(n => n.unread).length;

    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    let html = `
      <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
        <h6 class="mb-0 fw-bold fs-7">Notifications (${unreadCount} Unread)</h6>
        <button class="btn btn-link btn-sm p-0 text-primary text-decoration-none" id="mark-all-read-btn">Mark all read</button>
      </div>
      <div class="list-group list-group-flush" style="max-height: 320px; overflow-y: auto;">
    `;

    if (notifs.length === 0) {
      html += `<div class="p-3 text-center text-muted small">No notifications</div>`;
    } else {
      notifs.forEach(n => {
        html += `
          <div class="list-group-item list-group-item-action p-3 d-flex gap-3 align-items-start ${n.unread ? 'bg-light-subtle' : ''}">
            <i class="fa-solid ${n.icon} ${n.color} mt-1 fs-5"></i>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-semibold text-dark small">${n.title}</span>
                <span class="text-muted" style="font-size: 0.7rem;">${n.time}</span>
              </div>
              <p class="text-secondary small mb-0 lh-sm">${n.message}</p>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    notifContainer.innerHTML = html;

    const markReadBtn = document.getElementById('mark-all-read-btn');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        AutoCareData.markNotificationsRead();
        setupNotifications();
        Toast.show('info', 'Notifications', 'All notifications marked as read.');
      });
    }
  }

  // Active Link Highlighter in Sidebar
  function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (currentPath.endsWith(href) || (currentPath.endsWith('/') && href.includes('dashboard.html')))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Export Table Data to CSV
  function exportTableToCSV(tableId, filename = 'AutoCare_Export.csv') {
    const table = document.getElementById(tableId);
    if (!table) {
      Toast.show('warning', 'Export', 'Table not found for export.');
      return;
    }

    let csv = [];
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      let rowData = [];
      const cols = row.querySelectorAll('th, td');
      cols.forEach(col => {
        // Exclude action buttons
        if (!col.classList.contains('no-export')) {
          let text = col.innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""').trim();
          rowData.push('"' + text + '"');
        }
      });
      csv.push(rowData.join(','));
    });

    const csvFile = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    Toast.show('success', 'Export Complete', `${filename} has been generated.`);
  }

  // Global Initialization
  function init() {
    setupSidebar();
    setupNotifications();
    highlightActiveNav();
  }

  return {
    init: init,
    Toast: Toast,
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    exportTableToCSV: exportTableToCSV
  };
})();


// Sign out from the PHP session without deleting any saved application data.
document.addEventListener('click', async (event) => {
  const link = event.target.closest('a[href$="login.html"]');
  if (!link || !/sign out|logout/i.test((link.textContent || '').trim())) return;
  event.preventDefault();
  try {
    const dataScript = document.querySelector('script[src*="data.js"]');
    const apiUrl = dataScript ? new URL('../../../backend/api/logout.php', dataScript.src).href : '../backend/api/logout.php';
    await fetch(apiUrl, { method: 'POST', credentials: 'same-origin' });
  } catch (_) {}
  localStorage.removeItem('AUTOCARE_AUTH_USER_V1');
  window.location.href = link.href;
});

document.addEventListener('DOMContentLoaded', () => {
  AutoCareApp.init();
});
