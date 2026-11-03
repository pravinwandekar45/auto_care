/**
 * AutoCare – Platform Admin Portal Scripts
 */

const AutoCareAdmin = (function () {
  // --- Dashboard Controller ---
  function initDashboard() {
    renderDashboardStats();
    initAdminBookingChart();
    initAdminRevenueChart();
    renderRecentUsersTable();
    renderRecentBookingsTable();
  }

  function renderDashboardStats() {
    const data = AutoCareData;
    const users = data.getUsers() || [];
    const owners = users.filter(u => /vehicle owner|owner/i.test(String(u.role || ''))).length;
    const garageStaff = users.filter(u => /garage staff|garage owner|garage/i.test(String(u.role || ''))).length;
    const vehicles = (data.getVehicles() || []).length;
    const bookings = data.getBookings() || [];
    const activeBookings = bookings.filter(b => !/completed|cancelled|rejected/i.test(String(b.status || ''))).length;
    const invoices = data.getInvoices() || [];
    const revenue = invoices.filter(i => /paid|success|completed/i.test(String(i.status || i.paymentStatus || '')))
      .reduce((sum, i) => sum + Number(i.amount || i.total || i.grandTotal || 0), 0);
    const put = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = Number(value).toLocaleString('en-IN'); };
    put('admin-stat-users', users.length); put('admin-stat-owners', owners); put('admin-stat-garages', garageStaff);
    put('admin-stat-vehicles', vehicles); put('admin-stat-bookings', activeBookings);
    const revenueEl = document.getElementById('admin-stat-revenue');
    if (revenueEl) revenueEl.textContent = '₹' + revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    document.querySelectorAll('.garage-count-badge').forEach(el => el.textContent = garageStaff.toLocaleString('en-IN'));
  }

  function initInvoiceLedger() {
    const tbody = document.querySelector('#admin-master-invoices-table tbody');
    if (!tbody) return;
    const invoices = AutoCareData.getInvoices() || [];
    tbody.innerHTML = invoices.map(inv => {
      const amount = Number(inv.amount || inv.total || inv.grandTotal || 0);
      const status = String(inv.status || inv.paymentStatus || 'Pending');
      const dateValue = inv.createdAt || inv.date || '';
      let date = '—'; try { if (dateValue) date = AutoCareApp.formatDate(dateValue); } catch (_) {}
      const vehicle = inv.vehicleName || inv.vehicle || inv.vehicleModel || '—';
      const customer = inv.customerName || inv.ownerName || inv.ownerEmail || '—';
      const garage = inv.garageName || inv.workshopName || '—';
      return `<tr><td><strong class="font-monospace text-primary">${escapeHtml(inv.id || '—')}</strong></td><td>${escapeHtml(customer)}</td><td>${escapeHtml(garage)}</td><td>${escapeHtml(vehicle)}</td><td>${escapeHtml(date)}</td><td class="fw-bold">₹${amount.toLocaleString('en-IN')}</td><td class="text-success">₹${(amount * .15).toLocaleString('en-IN',{maximumFractionDigits:2})}</td><td><span class="badge-status badge-${/paid|success|completed/i.test(status)?'paid':'pending'}">${escapeHtml(status)}</span></td></tr>`;
    }).join('');
    if (!invoices.length) tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No invoices found in the current database.</td></tr>';
  }

  function initGarageStaffPage() {
    const table = document.querySelector('#admin-staff-table tbody');
    if (!table) return;
    const render = () => {
      const users = AutoCareData.getUsers().filter(u => /garage staff|garage owner/i.test(String(u.role || '')));
      table.innerHTML = users.map(u => `<tr><td><div class="fw-bold">${escapeHtml(u.name || 'Unnamed')}</div><small class="text-muted">${escapeHtml(u.id || '')}</small></td><td>${escapeHtml(u.garage || 'Not assigned')}</td><td>${escapeHtml(u.email || '—')}</td><td>${escapeHtml(u.phone || '—')}</td><td><span class="badge bg-light text-dark border">${escapeHtml(u.role || 'Garage Staff')}</span></td><td><span class="badge-status badge-${String(u.status || 'Active').toLowerCase()}">${escapeHtml(u.status || 'Active')}</span></td><td><button class="btn btn-outline-primary btn-sm" onclick="AutoCareApp.Toast.show('info','Staff details','${String(u.name || '').replace(/'/g, '')}')"><i class="fa-regular fa-eye"></i></button></td></tr>`).join('');
      const count = document.getElementById('admin-staff-count'); if (count) count.textContent = users.length.toLocaleString('en-IN');
    };
    const addBtn = document.getElementById('admin-add-staff-btn');
    if (addBtn) addBtn.addEventListener('click', () => {
      const name = prompt('Enter staff full name:'); if (!name || !name.trim()) return;
      const email = prompt('Enter staff email:'); if (!email || !email.trim()) return;
      const phone = prompt('Enter staff phone number:') || '';
      const garage = prompt('Enter assigned garage name:') || '';
      const users = AutoCareData.getUsers();
      if (users.some(u => String(u.email || '').toLowerCase() === email.trim().toLowerCase())) { AutoCareApp.Toast.show('error','Duplicate email','This email is already registered.'); return; }
      users.push({ id: 'STF-' + Date.now().toString().slice(-7), name: name.trim(), email: email.trim(), phone: phone.trim(), garage: garage.trim(), role: 'Garage Staff', status: 'Active', createdDate: new Date().toISOString().slice(0,10) });
      AutoCareData.addUser(users[users.length - 1]);
      AutoCareApp.Toast.show('success','Staff added','New garage staff has been added to the user directory.'); render(); renderDashboardStats();
    });
    render();
  }
  // Sort IDs naturally in ascending order (e.g. USR-2 before USR-10).
  function sortUsersById(users) {
    return [...users].sort((a, b) => {
      const aid = String(a.id || ''), bid = String(b.id || '');
      const an = aid.match(/\d+/), bn = bid.match(/\d+/);
      if (an && bn && Number(an[0]) !== Number(bn[0])) return Number(an[0]) - Number(bn[0]);
      return aid.localeCompare(bid, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function normalizeRole(role) {
    const r = String(role || '').toLowerCase().replace(/[_\s]+/g, '-');
    if (r.includes('owner')) return 'vehicle-owner';
    if (r.includes('garage') || r.includes('staff')) return 'garage-staff';
    if (r.includes('admin')) return 'admin';
    return r;
  }

  // Vehicle Owners directory always reflects currently saved registered owner accounts.
  function initVehicleOwnersPage() {
    const tbody = document.getElementById('admin-owners-tbody');
    if (!tbody) return;
    const users = sortUsersById(AutoCareData.getUsers() || []).filter(u => /vehicle owner|owner/i.test(String(u.role || '')));
    const vehicles = AutoCareData.getVehicles() || [];
    const bookings = AutoCareData.getBookings() || [];
    const heading = document.querySelector('.app-content h3 + p');
    if (heading) heading.textContent = `Showing ${users.length.toLocaleString('en-IN')} registered vehicle owners from current saved data.`;
    tbody.innerHTML = users.map(u => {
      const id = String(u.id || '');
      const ownedVehicles = vehicles.filter(v => String(v.ownerId || v.userId || '') === id || String(v.ownerEmail || '').toLowerCase() === String(u.email || '').toLowerCase());
      const ownerBookings = bookings.filter(b => String(b.ownerId || b.userId || '') === id || String(b.customerEmail || b.ownerEmail || '').toLowerCase() === String(u.email || '').toLowerCase());
      const date = u.createdDate || u.createdAt || u.joinedDate || '';
      const status = u.status || 'Active';
      const initials = String(u.name || 'U').split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase();
      return `<tr>
        <td><div class="d-flex align-items-center gap-2"><div class="user-avatar-sm" style="width:34px;height:34px;font-size:.8rem;background:#1565C0;">${escapeHtml(initials)}</div><div><div class="fw-bold text-dark">${escapeHtml(u.name || 'Unnamed')}</div><small class="text-muted font-monospace">${escapeHtml(id)}</small></div></div></td>
        <td><small class="text-secondary">${escapeHtml(u.email || '—')}</small></td>
        <td><small class="text-dark fw-medium">${escapeHtml(u.phone || '—')}</small></td>
        <td class="text-center fw-bold text-primary">${ownedVehicles.length}</td>
        <td class="text-center fw-bold text-success">${ownerBookings.filter(b => /completed/i.test(String(b.status || ''))).length}</td>
        <td><small class="text-muted">${escapeHtml(date ? (typeof AutoCareApp !== 'undefined' ? AutoCareApp.formatDate(date) : date) : '—')}</small></td>
        <td><span class="badge-status badge-${escapeHtml(String(status).toLowerCase())}">${escapeHtml(status)}</span></td>
        <td><div class="btn-group btn-group-sm"><button class="btn btn-outline-primary" title="View owner" onclick="AutoCareApp.Toast.show('info','Owner Details','${String(u.name || 'Owner').replace(/['\\]/g, '')}')"><i class="fa-solid fa-eye"></i></button><button class="btn btn-outline-warning" title="Suspend" onclick="AutoCareAdmin.toggleUserStatus('${String(id).replace(/['\\]/g, '')}','Inactive')"><i class="fa-solid fa-ban"></i></button></div></td>
      </tr>`;
    }).join('');
    if (!users.length) tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-4">No registered vehicle owners found in saved data.</td></tr>';
  }

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function initAdminBookingChart() {
    const canvas = document.getElementById('adminBookingChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Completed (68%)', 'In Progress (15%)', 'Pending (12%)', 'Cancelled (5%)'],
        datasets: [{
          data: [68, 15, 12, 5],
          backgroundColor: ['#2E7D32', '#1565C0', '#F9A825', '#D32F2F'],
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        cutout: '70%'
      }
    });
  }

  function initAdminRevenueChart() {
    const canvas = document.getElementById('adminRevenueChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
        datasets: [
          {
            label: 'Platform Gross GMV (₹ Lakhs)',
            data: [6.2, 7.1, 7.8, 8.0, 8.2, 8.5],
            backgroundColor: '#1565C0',
            borderRadius: 6
          },
          {
            label: 'Net Platform Commission (₹ Lakhs)',
            data: [0.93, 1.06, 1.17, 1.20, 1.23, 1.27],
            backgroundColor: '#2E7D32',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            grid: { color: '#ECEFF1' },
            ticks: {
              callback: function (v) { return '₹' + v + 'L'; }
            }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderRecentUsersTable() {
    const tbody = document.getElementById('admin-recent-users-tbody');
    if (!tbody) return;

    const users = sortUsersById(AutoCareData.getUsers() || []).slice(0, 5);
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div class="fw-semibold text-dark">${u.name}</div>
          <small class="text-muted font-monospace">${u.id}</small>
        </td>
        <td><small class="text-secondary">${u.email}</small></td>
        <td><span class="badge ${u.role === 'Admin' ? 'bg-dark' : (u.role === 'Garage Staff' ? 'bg-warning text-dark' : 'bg-primary')}">${u.role}</span></td>
        <td><small class="text-muted">${AutoCareApp.formatDate(u.createdDate)}</small></td>
        <td><span class="badge-status badge-${u.status.toLowerCase()}">${u.status}</span></td>
        <td>
          <button class="btn btn-outline-primary btn-sm p-1" onclick="AutoCareApp.Toast.show('info', 'User Profile', 'Viewing profile for ${u.name}.')"><i class="fa-regular fa-eye"></i></button>
        </td>
      </tr>
    `).join('');
  }

  function renderRecentBookingsTable() {
    const tbody = document.getElementById('admin-recent-bookings-tbody');
    if (!tbody) return;

    const bookings = AutoCareData.getBookings().slice(0, 5);
    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td><strong class="font-monospace text-primary">${b.id}</strong></td>
        <td><div class="fw-medium text-dark">${b.customerName}</div></td>
        <td><small class="text-secondary">${b.garageName}</small></td>
        <td>
          <div class="fw-medium text-dark">${b.vehicleName}</div>
          <small class="text-muted font-monospace">${b.regNumber}</small>
        </td>
        <td><span class="badge bg-light text-dark border">${b.serviceName}</span></td>
        <td><small class="text-dark">${AutoCareApp.formatDate(b.date)}</small></td>
        <td><span class="badge-status badge-${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span></td>
      </tr>
    `).join('');
  }

  // --- Users Management Page ---
  function initUsersPage() {
    renderUsersTable();
    setupUserTabs();
  }

  function renderUsersTable(filterRole = 'all') {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    let users = sortUsersById(AutoCareData.getUsers() || []);
    const ownersCount = users.filter(u => /vehicle owner|owner/i.test(String(u.role || ''))).length;
    const staffCount = users.filter(u => /garage staff|garage owner|garage/i.test(String(u.role || ''))).length;
    const countAll = document.getElementById('users-count-all'); if (countAll) countAll.textContent = users.length.toLocaleString('en-IN');
    const countOwners = document.getElementById('users-count-owners'); if (countOwners) countOwners.textContent = ownersCount.toLocaleString('en-IN');
    const countStaff = document.getElementById('users-count-staff'); if (countStaff) countStaff.textContent = staffCount.toLocaleString('en-IN');
    if (filterRole !== 'all') {
      users = users.filter(u => normalizeRole(u.role) === filterRole);
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong class="font-monospace text-primary">${u.id}</strong></td>
        <td>
          <div class="fw-semibold text-dark">${u.name}</div>
        </td>
        <td><small class="text-secondary">${u.email}</small></td>
        <td><small class="text-muted">${u.phone}</small></td>
        <td><span class="badge ${u.role === 'Admin' ? 'bg-dark' : (u.role === 'Garage Staff' ? 'bg-warning text-dark' : 'bg-primary')}">${u.role}</span></td>
        <td><span class="badge-status badge-${u.status.toLowerCase()}">${u.status}</span></td>
        <td><small class="text-muted">${AutoCareApp.formatDate(u.createdDate)}</small></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" title="Edit User" onclick="AutoCareApp.Toast.show('info', 'Edit User', 'Editing ${u.name}')"><i class="fa-regular fa-pen-to-square"></i></button>
            <button class="btn btn-outline-${u.status === 'Active' ? 'warning' : 'success'}" title="${u.status === 'Active' ? 'Deactivate' : 'Activate'}" onclick="AutoCareAdmin.toggleUserStatus('${u.id}', '${u.status === 'Active' ? 'Inactive' : 'Active'}')">
              <i class="fa-solid fa-power-off"></i>
            </button>
            <button class="btn btn-outline-danger" title="Delete User" onclick="AutoCareAdmin.deleteUser('${u.id}', '${u.name}')">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function setupUserTabs() {
    document.querySelectorAll('.user-role-tab').forEach(tab => {
      tab.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.user-role-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        renderUsersTable(this.dataset.role);
      });
    });
  }

  function toggleUserStatus(id, newStatus) {
    AutoCareData.updateUserStatus(id, newStatus);
    AutoCareApp.Toast.show('success', 'User Updated', `User status set to ${newStatus}.`);
    renderUsersTable();
  }

  function deleteUser(id, name) {
    if (confirm(`Are you sure you want to permanently delete user "${name}"?`)) {
      AutoCareData.deleteUser(id);
      AutoCareApp.Toast.show('info', 'User Deleted', `User ${name} has been removed.`);
      renderUsersTable();
    }
  }

  // --- Garages Management ---
  function initGaragesPage() {
    renderGaragesTable();
  }

  function renderGaragesTable() {
    const tbody = document.getElementById('admin-garages-tbody');
    if (!tbody) return;

    const garages = AutoCareData.getGarages();
    tbody.innerHTML = garages.map(g => `
      <tr>
        <td>
          <div class="fw-bold text-dark">${g.name}</div>
          <small class="text-muted"><i class="fa-solid fa-location-dot text-danger me-1"></i>${g.location}</small>
        </td>
        <td><div class="text-dark fw-medium">${g.owner}</div><small class="text-muted">${g.phone}</small></td>
        <td><small class="text-secondary">${g.address}</small></td>
        <td class="text-center fw-bold text-primary">${g.completedJobs}</td>
        <td><span class="badge bg-success text-white"><i class="fa-solid fa-star me-1"></i>${g.rating}</span></td>
        <td><span class="badge-status badge-${g.status.toLowerCase()}">${g.status}</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-success" title="Approve" onclick="AutoCareAdmin.updateGarage('${g.id}', 'Active')"><i class="fa-solid fa-check"></i></button>
            <button class="btn btn-outline-warning" title="Suspend" onclick="AutoCareAdmin.updateGarage('${g.id}', 'Suspended')"><i class="fa-solid fa-ban"></i></button>
            <button class="btn btn-outline-primary" title="Edit" onclick="AutoCareApp.Toast.show('info', 'Garage Config', 'Viewing details for ${g.name}')"><i class="fa-regular fa-pen-to-square"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function updateGarage(id, status) {
    AutoCareData.updateGarageStatus(id, status);
    AutoCareApp.Toast.show('success', 'Garage Updated', `Garage status updated to ${status}.`);
    renderGaragesTable();
  }

  return {
    initDashboard: initDashboard,
    initGarageStaffPage: initGarageStaffPage,
    initInvoiceLedger: initInvoiceLedger,
    initUsersPage: initUsersPage,
    initGaragesPage: initGaragesPage,
    initVehicleOwnersPage: initVehicleOwnersPage,
    toggleUserStatus: toggleUserStatus,
    deleteUser: deleteUser,
    updateGarage: updateGarage
  };
})();


document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('admin-staff-table')) AutoCareAdmin.initGarageStaffPage();
  if (document.getElementById('admin-stat-users')) AutoCareAdmin.initDashboard();
  if (document.getElementById('admin-master-invoices-table')) AutoCareAdmin.initInvoiceLedger();
  if (document.getElementById('admin-owners-tbody')) AutoCareAdmin.initVehicleOwnersPage();
});
