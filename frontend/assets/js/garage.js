/**
 * AutoCare – Garage Staff Portal Scripts
 */

const AutoCareGarage = (function () {
  // --- Dashboard Controller ---
  function initDashboard() {
    let auth = null;
    try { auth = JSON.parse(localStorage.getItem('AUTOCARE_AUTH_USER_V1') || 'null'); } catch (e) {}
    if (!auth || String(auth.role || '').toLowerCase() !== 'garage') {
      window.location.replace('../login.html');
      return;
    }
    personalizeGarageDashboard(auth);
    renderDashboardStats();
    renderTodayScheduleTable();
    initGarageRevenueChart();
  }

  function personalizeGarageDashboard(auth) {
    const garage = (AutoCareData.getCurrentGarage && AutoCareData.getCurrentGarage()) || {};
    const garageName = auth.garageName || garage.name || ((auth.name || 'My') + ' Garage');
    const ownerName = auth.name || 'Garage Owner';
    const initials = ownerName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'GO';
    const sidebarName = document.getElementById('garage-sidebar-name');
    const sidebarRole = document.getElementById('garage-sidebar-role');
    const headerName = document.getElementById('garage-header-name');
    const welcome = document.getElementById('garage-welcome-title');
    if (sidebarName) sidebarName.textContent = ownerName;
    if (sidebarRole) sidebarRole.textContent = garageName;
    if (headerName) headerName.textContent = garageName;
    if (welcome) welcome.textContent = 'Welcome, ' + ownerName + ' 👋';
    document.querySelectorAll('.user-avatar-sm').forEach(el => { el.textContent = initials; });
    document.title = garageName + ' – Garage Dashboard | AutoCare';
  }

  function renderDashboardStats() {
    const bookings = AutoCareData.getBookings();

    const todayBookingsEl = document.getElementById('stat-today-bookings');
    const pendingServicesEl = document.getElementById('stat-pending-services');
    const completedServicesEl = document.getElementById('stat-completed-services');
    const todayRevenueEl = document.getElementById('stat-today-revenue');

    const today = new Date().toISOString().slice(0, 10);
    if (todayBookingsEl) todayBookingsEl.textContent = String(bookings.filter(b => String(b.date || '').slice(0, 10) === today).length);
    if (pendingServicesEl) pendingServicesEl.textContent = String(bookings.filter(b => !['Completed','Cancelled'].includes(b.status)).length);
    if (completedServicesEl) completedServicesEl.textContent = String(bookings.filter(b => b.status === 'Completed').length);
    if (todayRevenueEl) todayRevenueEl.textContent = '₹' + bookings.filter(b => b.status === 'Completed').reduce((sum, b) => sum + Number(b.totalCost || b.estimatedCost || 0), 0).toLocaleString('en-IN');
  }

  function renderTodayScheduleTable() {
    const tbody = document.getElementById('today-schedule-tbody');
    if (!tbody) return;

    const bookings = AutoCareData.getBookings();
    if (!bookings.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">No service bookings yet.</td></tr>'; return; }
    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td class="font-monospace fw-semibold text-primary"><i class="fa-regular fa-clock me-1 text-muted"></i>${b.time}</td>
        <td>
          <div class="fw-semibold text-dark">${b.vehicleName}</div>
          <small class="text-muted font-monospace">${b.regNumber}</small>
        </td>
        <td>
          <div class="fw-medium text-dark">${b.customerName}</div>
          <small class="text-secondary">${b.customerPhone}</small>
        </td>
        <td><span class="badge bg-light text-primary border">${b.serviceName}</span></td>
        <td><small class="text-dark"><i class="fa-solid fa-user-gear me-1 text-secondary"></i>${b.technician || 'Assigned'}</small></td>
        <td><span class="badge-status badge-${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="AutoCareGarage.openJobModal('${b.id}')" title="Quick Action">
              <i class="fa-solid fa-bolt"></i> Update
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function initGarageRevenueChart() {
    const canvas = document.getElementById('garageRevenueChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const bookings = AutoCareData.getBookings();
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const revenue = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    bookings.filter(b => b.status === 'Completed').forEach(b => {
      const d = new Date(String(b.date || '').slice(0, 10) + 'T00:00:00');
      const index = Math.floor((d - monday) / 86400000);
      if (index >= 0 && index < 7) revenue[index] += Number(b.totalCost || b.estimatedCost || 0);
    });
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Revenue (₹)',
          data: revenue,
          borderColor: '#1565C0',
          backgroundColor: 'rgba(21, 101, 192, 0.08)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#1565C0',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: '#ECEFF1' },
            ticks: {
              callback: function (val) { return '₹' + (val / 1000) + 'k'; }
            }
          }
        }
      }
    });
  }

  // --- Bookings Management ---
  function initBookingsPage() {
    renderBookingsTable();
    setupBookingsFilter();
  }

  function renderBookingsTable(filterStatus = 'all') {
    const tbody = document.getElementById('garage-bookings-tbody');
    if (!tbody) return;

    let bookings = AutoCareData.getBookings();
    if (filterStatus !== 'all') {
      bookings = bookings.filter(b => b.status.toLowerCase().replace(' ', '-') === filterStatus);
    }

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted p-4">No bookings found matching filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td><strong class="font-monospace text-primary">${b.id}</strong></td>
        <td>
          <div class="fw-semibold text-dark">${b.customerName}</div>
          <small class="text-muted">${b.customerPhone}</small>
        </td>
        <td>
          <div class="fw-medium text-dark">${b.vehicleName}</div>
          <small class="text-muted font-monospace">${b.regNumber}</small>
        </td>
        <td><span class="badge bg-light text-dark border">${b.serviceName}</span></td>
        <td><small class="text-dark">${AutoCareApp.formatDate(b.date)}</small></td>
        <td><small class="text-muted font-monospace">${b.time}</small></td>
        <td><small class="text-secondary">${b.technician || 'Not assigned'}</small></td>
        <td><span class="badge-status badge-${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span></td>
        <td class="no-export">
          <div class="dropdown">
            <button class="btn btn-light btn-sm border dropdown-toggle" type="button" data-bs-toggle="dropdown">
              Actions
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm">
              <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${b.id}', 'Confirmed', 'Confirmed'); return false;"><i class="fa-solid fa-check text-success me-2"></i>Accept & Confirm</a></li>
              <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${b.id}', 'Vehicle Received', 'Vehicle Received'); return false;"><i class="fa-solid fa-car text-info me-2"></i>Vehicle Received</a></li>
              <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${b.id}', 'In Progress', 'Service In Progress'); return false;"><i class="fa-solid fa-wrench text-warning me-2"></i>Start Service</a></li>
              <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${b.id}', 'Completed', 'Invoice Generated'); return false;"><i class="fa-solid fa-circle-check text-success me-2"></i>Mark Completed</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" href="#" onclick="AutoCareGarage.updateStatus('${b.id}', 'Cancelled', 'Cancelled'); return false;"><i class="fa-solid fa-ban me-2"></i>Reject / Cancel</a></li>
            </ul>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function setupBookingsFilter() {
    const select = document.getElementById('booking-filter-status');
    const search = document.getElementById('booking-search-input');

    if (select) {
      select.addEventListener('change', (e) => {
        renderBookingsTable(e.target.value);
      });
    }

    if (search) {
      search.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#garage-bookings-tbody tr');
        rows.forEach(r => {
          const text = r.innerText.toLowerCase();
          r.style.display = text.includes(query) ? '' : 'none';
        });
      });
    }
  }

  function updateStatus(bookingId, status, stage) {
    try {
      AutoCareData.updateBookingStatus(bookingId, status, stage);
      AutoCareApp.Toast.show('success', 'Status Updated', `Booking #${bookingId} status changed to ${status}.`);
      renderBookingsTable();
      renderServiceJobsKanban();
      renderDashboardStats();
    } catch (error) {
      AutoCareApp.Toast.show('danger', 'Update Failed', error.message || 'Booking status could not be updated.');
    }
  }

  // --- Visual Kanban Service Job Pipeline ---
  function initServiceJobsPage() {
    renderServiceJobsKanban();
  }

  function renderServiceJobsKanban() {
    const container = document.getElementById('service-kanban-board');
    if (!container) return;

    const bookings = AutoCareData.getBookings();

    const stages = [
      { id: 'Booked', title: 'Booked / Pending', badge: 'bg-secondary', statusKey: 'Pending' },
      { id: 'Confirmed', title: 'Confirmed', badge: 'bg-primary', statusKey: 'Confirmed' },
      { id: 'Vehicle Received', title: 'Vehicle Received', badge: 'bg-info', statusKey: 'Vehicle Received' },
      { id: 'Service In Progress', title: 'In Progress', badge: 'bg-warning text-dark', statusKey: 'In Progress' },
      { id: 'Completed', title: 'Quality Check', badge: 'bg-success', statusKey: 'Completed' },
      { id: 'Invoice Generated', title: 'Invoiced / Ready', badge: 'bg-dark', statusKey: 'Completed' }
    ];

    container.innerHTML = stages.map(stage => {
      const stageJobs = bookings.filter(b => b.workflowStage === stage.id || (!b.workflowStage && b.status === stage.statusKey));

      return `
        <div class="kanban-column">
          <div class="kanban-column-header">
            <div class="kanban-column-title">
              <span>${stage.title}</span>
              <span class="badge ${stage.badge} rounded-pill">${stageJobs.length}</span>
            </div>
          </div>
          <div class="kanban-cards-list" style="min-height: 200px;">
            ${stageJobs.length === 0 ? `<div class="text-center text-muted small p-3">No jobs</div>` : ''}
            ${stageJobs.map(job => `
              <div class="kanban-card">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="badge bg-light text-primary border font-monospace">${job.id}</span>
                  <small class="text-muted"><i class="fa-regular fa-clock me-1"></i>${job.time}</small>
                </div>
                <h6 class="fw-bold text-dark mb-1">${job.vehicleName}</h6>
                <div class="small text-muted font-monospace mb-2">${job.regNumber}</div>
                <div class="small text-secondary mb-2"><i class="fa-solid fa-wrench text-muted me-1"></i>${job.serviceName}</div>
                
                <div class="d-flex justify-content-between align-items-center pt-2 border-top small">
                  <span class="text-dark fw-medium"><i class="fa-solid fa-user-circle text-muted me-1"></i>${job.technician || 'Staff'}</span>
                  <div class="dropdown">
                    <button class="btn btn-link btn-sm p-0 text-primary" data-bs-toggle="dropdown">
                      <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                      <li><h6 class="dropdown-header">Move Job Stage</h6></li>
                      <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${job.id}', 'Confirmed', 'Confirmed'); return false;">→ Confirmed</a></li>
                      <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${job.id}', 'Vehicle Received', 'Vehicle Received'); return false;">→ Vehicle Received</a></li>
                      <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${job.id}', 'In Progress', 'Service In Progress'); return false;">→ In Progress</a></li>
                      <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${job.id}', 'Completed', 'Completed'); return false;">→ Quality Check</a></li>
                      <li><a class="dropdown-item" href="#" onclick="AutoCareGarage.updateStatus('${job.id}', 'Completed', 'Invoice Generated'); return false;">→ Invoiced</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Dynamic Live Invoice Generator ---
  let invoiceItems = [
    { desc: 'Synthetic 5W-30 Engine Oil (3.5L)', type: 'Parts', qty: 1, rate: 1850 },
    { desc: 'OEM Engine Oil Filter', type: 'Parts', qty: 1, rate: 350 },
    { desc: 'Comprehensive Periodic Labor Charge', type: 'Labor', qty: 1, rate: 800 }
  ];

  let invoiceCustomers = [];
  let invoiceVehicles = [];

  function initInvoiceGenerator() {
    renderInvoiceLineItems();
    populateInvoiceCustomers();
    setupInvoiceCalculator();
  }

  function populateInvoiceCustomers() {
    const customerSelect = document.getElementById('inv-customer-select');
    const vehicleSelect = document.getElementById('inv-vehicle-select');
    if (!customerSelect || !vehicleSelect) return;

    invoiceCustomers = AutoCareData.getRegisteredCustomers();
    customerSelect.innerHTML = '<option value="">Select registered customer</option>' + invoiceCustomers.map(c =>
      `<option value="${escapeInvoiceValue(c.email)}">${escapeInvoiceValue(c.name)}${c.phone ? ' (' + escapeInvoiceValue(c.phone) + ')' : ''}</option>`
    ).join('');
    vehicleSelect.innerHTML = '<option value="">Select a customer first</option>';
    vehicleSelect.disabled = true;

    customerSelect.addEventListener('change', function () {
      const customer = invoiceCustomers.find(c => c.email === this.value);
      invoiceVehicles = customer ? AutoCareData.getVehiclesForCustomer(customer.id, customer.email, customer.name) : [];
      if (!customer) {
        vehicleSelect.innerHTML = '<option value="">Select a customer first</option>';
        vehicleSelect.disabled = true;
        return;
      }
      vehicleSelect.disabled = false;
      vehicleSelect.innerHTML = '<option value="">Select customer vehicle</option>' + invoiceVehicles.map(v => {
        const label = `${v.name || [v.brand, v.model].filter(Boolean).join(' ')}${v.regNumber ? ' [' + v.regNumber + ']' : ''}`;
        return `<option value="${escapeInvoiceValue(v.id)}">${escapeInvoiceValue(label)}</option>`;
      }).join('');
      if (!invoiceVehicles.length) {
        vehicleSelect.innerHTML = '<option value="">No vehicle registered for this customer</option>';
        vehicleSelect.disabled = true;
        AutoCareApp.Toast.show('info', 'No vehicles found', 'This customer needs to register a vehicle before an invoice can be generated.');
      }
    });
  }

  function escapeInvoiceValue(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function renderInvoiceLineItems() {
    const tbody = document.getElementById('invoice-items-builder-tbody');
    if (!tbody) return;

    tbody.innerHTML = invoiceItems.map((item, idx) => `
      <tr>
        <td>
          <input type="text" class="form-control form-control-sm" value="${item.desc}" onchange="AutoCareGarage.updateItemField(${idx}, 'desc', this.value)">
        </td>
        <td>
          <select class="form-select form-select-sm" onchange="AutoCareGarage.updateItemField(${idx}, 'type', this.value)">
            <option value="Parts" ${item.type === 'Parts' ? 'selected' : ''}>Parts</option>
            <option value="Labor" ${item.type === 'Labor' ? 'selected' : ''}>Labor</option>
            <option value="Consumables" ${item.type === 'Consumables' ? 'selected' : ''}>Consumables</option>
          </select>
        </td>
        <td>
          <input type="number" class="form-control form-control-sm text-center" value="${item.qty}" min="1" onchange="AutoCareGarage.updateItemField(${idx}, 'qty', this.value)">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm text-end" value="${item.rate}" min="0" onchange="AutoCareGarage.updateItemField(${idx}, 'rate', this.value)">
        </td>
        <td class="text-end fw-semibold text-dark">
          ${AutoCareApp.formatCurrency(item.qty * item.rate)}
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm p-1" onclick="AutoCareGarage.removeInvoiceItem(${idx})">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join('');

    calculateInvoiceTotals();
  }

  function addInvoiceItem() {
    invoiceItems.push({ desc: 'New Service Item', type: 'Parts', qty: 1, rate: 500 });
    renderInvoiceLineItems();
  }

  function removeInvoiceItem(idx) {
    if (invoiceItems.length <= 1) {
      AutoCareApp.Toast.show('warning', 'Notice', 'Invoice must have at least one line item.');
      return;
    }
    invoiceItems.splice(idx, 1);
    renderInvoiceLineItems();
  }

  function updateItemField(idx, field, val) {
    if (field === 'qty') invoiceItems[idx].qty = parseInt(val, 10) || 1;
    else if (field === 'rate') invoiceItems[idx].rate = parseFloat(val) || 0;
    else invoiceItems[idx][field] = val;
    renderInvoiceLineItems();
  }

  function calculateInvoiceTotals() {
    const subtotal = invoiceItems.reduce((acc, curr) => acc + (curr.qty * curr.rate), 0);
    const taxRate = 18; // 18% GST
    const discountEl = document.getElementById('inv-calc-discount');
    const discount = discountEl ? (parseFloat(discountEl.value) || 0) : 0;
    const tax = Math.round(subtotal * (taxRate / 100));
    const total = Math.max(0, subtotal + tax - discount);

    const subtotalEl = document.getElementById('inv-calc-subtotal');
    const taxEl = document.getElementById('inv-calc-tax');
    const totalEl = document.getElementById('inv-calc-total');

    if (subtotalEl) subtotalEl.textContent = AutoCareApp.formatCurrency(subtotal);
    if (taxEl) taxEl.textContent = AutoCareApp.formatCurrency(tax);
    if (totalEl) totalEl.textContent = AutoCareApp.formatCurrency(total);
  }

  function setupInvoiceCalculator() {
    const discountEl = document.getElementById('inv-calc-discount');
    if (discountEl) {
      discountEl.addEventListener('input', calculateInvoiceTotals);
    }

    const genBtn = document.getElementById('btn-generate-invoice');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        const custSelect = document.getElementById('inv-customer-select');
        const vehSelect = document.getElementById('inv-vehicle-select');
        const customer = invoiceCustomers.find(c => c.email === (custSelect ? custSelect.value : ''));
        const vehicle = invoiceVehicles.find(v => String(v.id) === (vehSelect ? vehSelect.value : ''));
        if (!customer) {
          AutoCareApp.Toast.show('warning', 'Select customer', 'Choose a registered customer before generating an invoice.');
          return;
        }
        if (!vehicle) {
          AutoCareApp.Toast.show('warning', 'Select vehicle', 'Choose a vehicle registered to the selected customer.');
          return;
        }

        const subtotal = invoiceItems.reduce((acc, curr) => acc + (curr.qty * curr.rate), 0);
        const discount = parseFloat(document.getElementById('inv-calc-discount')?.value) || 0;
        const tax = Math.round(subtotal * 0.18);
        const total = Math.max(0, subtotal + tax - discount);

        const currentGarage = AutoCareData.getCurrentUser() || {};
        const matchingBooking = AutoCareData.getBookings().find(b => String(b.ownerId) === String(customer.id) && String(b.vehicleId) === String(vehicle.id) && String(b.status).toLowerCase() === 'completed');
        if (!matchingBooking) { AutoCareApp.Toast.show('warning', 'Completed booking required', 'This customer and vehicle do not have a completed database booking assigned to your garage.'); return; }
        let newInv;
        try { newInv = AutoCareData.addInvoice({
          bookingId: matchingBooking.id,
          ownerId: customer.id,
          ownerEmail: customer.email,
          ownerName: customer.name,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone || '',
          vehicleId: vehicle.id,
          vehicleName: vehicle.name || [vehicle.brand, vehicle.model].filter(Boolean).join(' '),
          regNumber: vehicle.regNumber || '',
          garageName: currentGarage.garageName || currentGarage.name || 'AutoCare Workshop',
          garageAddress: 'MIDC Andheri East, Mumbai',
          garageGST: '27AABCS1429B1Z8',
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date().toISOString().split('T')[0],
          status: 'Pending',
          items: invoiceItems.map(i => ({ description: i.desc, type: i.type, qty: i.qty, rate: i.rate, amount: i.qty * i.rate })),
          subtotal: subtotal,
          taxRate: 18,
          taxAmount: tax,
          discount: discount,
          total: total,
          paymentMethod: 'UPI (Awaiting Payment)'
        }); } catch (error) { AutoCareApp.Toast.show('danger', 'Invoice Failed', error.message || 'Could not save invoice.'); return; }

        AutoCareApp.Toast.show('success', 'Invoice Sent to Customer!', `Invoice #${newInv.id} for ${AutoCareApp.formatCurrency(total)} is now available in the car owner's app as Pending. The admin invoice ledger will reflect its payment status when updated.`);
      });
    }
  }

  function openJobModal(bookingId) {
    const booking = AutoCareData.getBookings().find(b => String(b.id) === String(bookingId));
    if (!booking) { AutoCareApp.Toast.show('warning', 'Booking not found', 'Refresh the page and try again.'); return; }
    const choices = ['Pending', 'Confirmed', 'Vehicle Received', 'In Progress', 'Completed', 'Cancelled'];
    const current = choices.includes(booking.status) ? booking.status : 'Confirmed';
    const selected = window.prompt('Update booking status:\n' + choices.map((x, i) => `${i + 1}. ${x}`).join('\n') + '\n\nEnter number (1-' + choices.length + ') or status name:', String(choices.indexOf(current) + 1));
    if (selected === null) return;
    const n = Number(selected);
    const status = Number.isInteger(n) && n >= 1 && n <= choices.length ? choices[n - 1] : choices.find(x => x.toLowerCase() === selected.trim().toLowerCase());
    if (!status) { AutoCareApp.Toast.show('warning', 'Invalid status', 'Choose one of the listed statuses.'); return; }
    const stageMap = { 'Pending': 'Booked', 'Confirmed': 'Confirmed', 'Vehicle Received': 'Vehicle Received', 'In Progress': 'Service In Progress', 'Completed': 'Invoice Generated', 'Cancelled': 'Cancelled' };
    updateStatus(booking.id, status, stageMap[status]);
    renderTodayScheduleTable();
    renderDashboardStats();
  }

  // --- Customer CRM ---
  function initCustomersPage() {
    renderCustomersTable();
    const form = document.getElementById('addCustForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        AutoCareApp.Toast.show('success', 'Customer Added', 'Registered customers will appear automatically here.');
        const modal = bootstrap.Modal.getInstance(document.getElementById('addCustomerModal'));
        if (modal) modal.hide();
        form.reset();
        renderCustomersTable();
      });
    }
  }

  function renderCustomersTable() {
    const tbody = document.querySelector('#customers-table tbody');
    if (!tbody) return;
    const customers = AutoCareData.getRegisteredCustomers();
    const vehicles = AutoCareData.getVehicles();
    const bookings = AutoCareData.getBookings();
    if (!customers.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">No registered customers found.</td></tr>'; return; }
    tbody.innerHTML = customers.map((c, i) => {
      const cv = AutoCareData.getVehiclesForCustomer(c.id, c.email, c.name);
      const visits = bookings.filter(b => String(b.customerEmail || '').toLowerCase() === c.email).length;
      const initials = (c.name || 'C').split(/\s+/).map(x => x[0] || '').join('').slice(0,2).toUpperCase();
      return `<tr><td><div class="d-flex align-items-center gap-2"><div class="user-avatar-sm" style="width:34px;height:34px;font-size:.8rem;background:#1565C0">${initials}</div><div><div class="fw-bold text-dark">${escapeHtml(c.name)}</div><small class="text-muted font-monospace">${escapeHtml(c.id || 'CUST-' + String(i+1).padStart(4,'0'))}</small></div></div></td><td><div class="small text-dark fw-medium">${escapeHtml(c.phone || '—')}</div><small class="text-secondary">${escapeHtml(c.email)}</small></td><td>${cv.length ? cv.map(v => `<span class="badge bg-light text-dark border me-1 mb-1">${escapeHtml(v.name || [v.brand,v.model].filter(Boolean).join(' '))}${v.regNumber ? ' (' + escapeHtml(v.regNumber) + ')' : ''}</span>`).join('') : '<span class="text-muted">No vehicles</span>'}</td><td class="text-center fw-bold text-primary">${visits}</td><td><small class="text-dark">${visits ? 'Recent booking' : '—'}</small></td><td><span class="badge-status badge-active">Active</span></td><td><div class="btn-group btn-group-sm"><a href="invoices.html" class="btn btn-outline-primary" title="Create Invoice"><i class="fa-solid fa-file-invoice"></i></a><a class="btn btn-outline-secondary" href="mailto:${encodeURIComponent(c.email)}" title="Email customer"><i class="fa-solid fa-envelope"></i></a></div></td></tr>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  // --- Slot Management Controller ---
  function initSlotsPage() {
    renderSlotsTable();
  }

  function renderSlotsTable() {
    const tbody = document.getElementById('slots-tbody');
    if (!tbody) return;
    const slots = AutoCareData.getSlots();
    tbody.innerHTML = slots.map((s, idx) => {
      const available = Math.max(0, Number(s.capacity) - Number(s.booked || 0));
      const status = s.enabled === false ? 'Unavailable' : (available === 0 ? 'Full' : (available <= 1 ? 'Filling Fast' : 'Available'));
      return `<tr>
        <td class="fw-bold font-monospace text-dark"><i class="fa-regular fa-clock me-1 text-primary"></i>${escapeHtml(s.time)}</td>
        <td class="text-center fw-semibold">${s.capacity} Bays</td><td class="text-center text-primary fw-bold">${Number(s.booked || 0)}</td>
        <td class="text-center text-success fw-bold">${s.enabled === false ? '—' : available}</td>
        <td><div class="progress" style="height:8px"><div class="progress-bar ${available === 0 ? 'bg-danger' : (available <= 1 ? 'bg-warning' : 'bg-success')}" style="width:${Math.min(100, Number(s.booked || 0) / Math.max(1, Number(s.capacity)) * 100)}%"></div></div></td>
        <td><span class="badge-status ${status === 'Full' || status === 'Unavailable' ? 'badge-cancelled' : (status === 'Filling Fast' ? 'badge-pending' : 'badge-completed')}">${status}</span></td>
        <td><div class="btn-group btn-group-sm"><button class="btn btn-outline-primary" onclick="AutoCareGarage.editSlot(${idx})" title="Edit slot"><i class="fa-regular fa-pen-to-square"></i> Edit</button><button class="btn btn-outline-secondary" onclick="AutoCareGarage.toggleSlot(${idx})" title="Toggle availability"><i class="fa-solid fa-power-off"></i> ${s.enabled === false ? 'Enable' : 'Disable'}</button></div></td>
      </tr>`;
    }).join('');
    const badge = document.querySelector('.sidebar-link[href="bookings.html"] .menu-badge');
    if (badge) badge.textContent = String(AutoCareData.getVehicles().length);
  }

  function editSlot(index) {
    const slot = AutoCareData.getSlots()[index];
    if (!slot) return;
    const time = window.prompt('Edit slot time (e.g. 09:00 AM):', slot.time);
    if (time === null) return;
    const capacityText = window.prompt('Edit bay/vehicle capacity:', String(slot.capacity));
    if (capacityText === null) return;
    const capacity = Number(capacityText);
    if (!time.trim() || !Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
      AutoCareApp.Toast.show('warning', 'Invalid slot details', 'Enter a valid time and capacity from 1 to 50.'); return;
    }
    AutoCareData.updateSlot(index, { time: time.trim(), capacity });
    renderSlotsTable();
    AutoCareApp.Toast.show('success', 'Slot Updated', 'Slot time and capacity have been saved.');
  }

  function toggleSlot(index) {
    const slot = AutoCareData.getSlots()[index];
    if (!slot) return;
    const enabling = slot.enabled === false;
    AutoCareData.updateSlot(index, { enabled: enabling });
    renderSlotsTable();
    AutoCareApp.Toast.show('success', 'Availability Updated', `Slot ${slot.time} is now ${enabling ? 'enabled' : 'disabled'}.`);
  }

  return {
    initDashboard: initDashboard,
    initBookingsPage: initBookingsPage,
    initServiceJobsPage: initServiceJobsPage,
    initInvoiceGenerator: initInvoiceGenerator,
    initSlotsPage: initSlotsPage,
    initCustomersPage: initCustomersPage,
    renderCustomersTable: renderCustomersTable,
    editSlot: editSlot,
    toggleSlot: toggleSlot,
    openJobModal: openJobModal,
    updateStatus: updateStatus,
    addInvoiceItem: addInvoiceItem,
    removeInvoiceItem: removeInvoiceItem,
    updateItemField: updateItemField
  };
})();
