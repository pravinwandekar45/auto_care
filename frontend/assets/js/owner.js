/**
 * AutoCare – Vehicle Owner Portal Scripts
 */

const AutoCareOwner = (function () {
  // Enforce portal separation: garage/admin accounts must never open owner pages.
  // Login API also validates roles; this protects direct links and dashboard navigation.
  (function enforceOwnerPortalRole() {
    let auth = null;
    try { auth = JSON.parse(localStorage.getItem('AUTOCARE_AUTH_USER_V1') || 'null'); } catch (_) {}
    if (!auth || String(auth.role || '').toLowerCase() !== 'owner') {
      window.location.replace('../login.html');
    }
  })();

  function getCurrentOwnerInvoices() {
    const current = AutoCareData.getCurrentUser() || {};
    let auth = {};
    try { auth = JSON.parse(localStorage.getItem('AUTOCARE_AUTH_USER_V1') || '{}'); } catch (_) {}
    const email = String(current.email || auth.email || '').toLowerCase();
    const id = String(current.id || auth.id || '');
    const name = String(current.name || auth.name || '').toLowerCase();
    return AutoCareData.getInvoices().filter(inv => {
      if (email && String(inv.ownerEmail || inv.customerEmail || '').toLowerCase() === email) return true;
      if (id && String(inv.ownerId || '') === id) return true;
      if (!inv.ownerEmail && !inv.customerEmail && !inv.ownerId && name && String(inv.customerName || '').toLowerCase() === name) return true;
      return false;
    });
  }

  let bookingState = {
    vehicleId: null,
    vehicleName: '',
    regNumber: '',
    serviceId: null,
    serviceName: '',
    servicePrice: 0,
    garageId: null,
    garageName: '',
    date: '',
    time: '',
    notes: ''
  };

  // --- Dashboard Controller ---
  function initDashboard() {
    renderDashboardStats();
    renderUpcomingServiceBanner();
    renderDashboardInvoices();
    renderRecentHistoryTable();
    initExpensesChart();
  }

  function renderDashboardStats() {
    const vehicles = AutoCareData.getVehicles();
    const bookings = AutoCareData.getBookings();
    const invoices = getCurrentOwnerInvoices();

    const totalVehiclesEl = document.getElementById('stat-total-vehicles');
    const upcomingServiceEl = document.getElementById('stat-upcoming-service');
    const activeBookingsEl = document.getElementById('stat-active-bookings');
    const pendingPaymentEl = document.getElementById('stat-pending-payment');

    if (totalVehiclesEl) totalVehiclesEl.textContent = `${vehicles.length} Vehicles`;
    if (upcomingServiceEl) upcomingServiceEl.textContent = '15 Sep 2026';
    if (activeBookingsEl) {
      const activeCount = bookings.filter(b => b.status === 'Confirmed' || b.status === 'In Progress' || b.status === 'Vehicle Received').length;
      activeBookingsEl.textContent = activeCount;
    }
    if (pendingPaymentEl) {
      const pendingTotal = invoices.filter(i => i.status === 'Pending').reduce((acc, curr) => acc + curr.total, 0);
      pendingPaymentEl.textContent = AutoCareApp.formatCurrency(pendingTotal);
    }
  }

  function renderDashboardInvoices() {
    const tbody = document.getElementById('owner-dashboard-invoices-tbody');
    if (!tbody) return;
    const invoices = getCurrentOwnerInvoices();
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No invoices generated for your account yet.</td></tr>';
      return;
    }
    tbody.innerHTML = invoices.slice(0, 5).map(inv => `
      <tr>
        <td><strong class="font-monospace text-primary">${inv.id}</strong></td>
        <td><div class="fw-semibold">${inv.vehicleName || 'Vehicle'}</div><small class="text-muted">${inv.regNumber || ''}</small></td>
        <td>${inv.garageName || 'AutoCare Workshop'}</td>
        <td>${AutoCareApp.formatDate(inv.date)}</td>
        <td class="fw-bold">${AutoCareApp.formatCurrency(inv.total)}</td>
        <td><span class="badge-status badge-${String(inv.status || 'Pending').toLowerCase()}">${inv.status || 'Pending'}</span></td>
        <td><div class="btn-group btn-group-sm">
          <a class="btn btn-outline-primary" href="invoices.html?view=${encodeURIComponent(inv.id)}"><i class="fa-regular fa-file-pdf"></i> View</a>
          ${inv.status === 'Pending' ? `<a class="btn btn-success" href="invoices.html?pay=${encodeURIComponent(inv.id)}"><i class="fa-solid fa-credit-card"></i> Pay Now</a>` : ''}
        </div></td>
      </tr>`).join('');
  }

  function renderUpcomingServiceBanner() {
    const container = document.getElementById('upcoming-service-card');
    if (!container) return;

    const bookings = AutoCareData.getBookings();
    const upcoming = bookings.find(b => b.status === 'Confirmed' || b.status === 'In Progress');

    if (upcoming) {
      container.innerHTML = `
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-3 p-3 bg-light-blue text-primary fs-3">
              <i class="fa-solid fa-car-side"></i>
            </div>
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <h5 class="mb-0 fw-bold">${upcoming.vehicleName}</h5>
                <span class="badge bg-light text-dark border font-monospace">${upcoming.regNumber}</span>
                <span class="badge-status badge-${upcoming.status.toLowerCase().replace(' ', '-')}">${upcoming.status}</span>
              </div>
              <p class="text-secondary small mb-0">
                <i class="fa-solid fa-wrench text-muted me-1"></i> <strong>${upcoming.serviceName}</strong> at 
                <i class="fa-solid fa-warehouse text-muted ms-2 me-1"></i> ${upcoming.garageName}
              </p>
            </div>
          </div>
          <div class="d-flex align-items-center gap-3 border-start-md ps-md-4">
            <div class="text-md-end">
              <div class="fw-bold text-dark"><i class="fa-regular fa-calendar text-primary me-1"></i> ${AutoCareApp.formatDate(upcoming.date)}</div>
              <div class="text-secondary small"><i class="fa-regular fa-clock text-muted me-1"></i> ${upcoming.time}</div>
            </div>
            <a href="book-service.html" class="btn btn-primary btn-sm">
              <i class="fa-solid fa-calendar-check me-1"></i> View Booking
            </a>
          </div>
        </div>
      `;
    }
  }

  function renderRecentHistoryTable() {
    const tbody = document.getElementById('recent-history-tbody');
    if (!tbody) return;

    const bookings = AutoCareData.getBookings().slice(0, 5);
    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">No recent service history.</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td>
          <div class="fw-semibold text-dark">${b.vehicleName}</div>
          <small class="text-muted font-monospace">${b.regNumber}</small>
        </td>
        <td><span class="badge bg-light text-primary border">${b.serviceName}</span></td>
        <td><small class="text-secondary"><i class="fa-solid fa-warehouse me-1 text-muted"></i>${b.garageName}</small></td>
        <td><small class="text-dark fw-medium">${AutoCareApp.formatDate(b.date)}</small></td>
        <td class="fw-bold text-dark">${AutoCareApp.formatCurrency(b.totalCost || b.estimatedCost)}</td>
        <td>
          <span class="badge-status badge-${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span>
        </td>
        <td>
          <button class="btn btn-outline-primary btn-sm" onclick="AutoCareOwner.viewInspectionDetails('${b.id}')">
            <i class="fa-regular fa-eye"></i> Details
          </button>
        </td>
      </tr>
    `).join('');
  }

  function initExpensesChart() {
    const canvas = document.getElementById('expensesChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep (Est)'],
        datasets: [{
          label: 'Service Expense (₹)',
          data: [2800, 1600, 2450, 1200, 3100, 2499, 1850, 2350, 2499],
          backgroundColor: '#1565C0',
          hoverBackgroundColor: '#0D47A1',
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return ' Expense: ₹' + context.raw.toLocaleString('en-IN');
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: '#ECEFF1' },
            ticks: {
              callback: function (val) { return '₹' + val; }
            }
          }
        }
      }
    });
  }

  // --- Vehicles Page Controller ---
  function initVehiclesPage() {
    renderVehicleCards();
    setupAddVehicleForm();
  }

  function renderVehicleCards() {
    const container = document.getElementById('vehicle-cards-container');
    if (!container) return;

    const vehicles = AutoCareData.getVehicles();
    if (vehicles.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="card-custom empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-car-side"></i></div>
            <div class="empty-state-title">No vehicles added yet.</div>
            <p class="empty-state-text">Add your car or motorcycle to schedule maintenance, track service logs, and get timely renewal alerts.</p>
            <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addVehicleModal">
              <i class="fa-solid fa-plus me-1"></i> + Add Vehicle
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = vehicles.map(v => `
      <div class="col-md-6 col-xl-4 mb-4">
        <div class="card-custom h-100 d-flex flex-column">
          <div class="d-flex align-items-start justify-content-between mb-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-card-icon icon-blue">
                <i class="fa-solid ${v.imageIcon || 'fa-car-side'}"></i>
              </div>
              <div>
                <h6 class="fw-bold mb-0 text-dark">${v.name}</h6>
                <span class="badge bg-light text-dark border font-monospace mt-1">${v.regNumber}</span>
              </div>
            </div>
            <span class="badge-status badge-${v.serviceStatus.toLowerCase().replace(' ', '-')}">${v.serviceStatus}</span>
          </div>

          <div class="bg-light rounded-3 p-3 mb-3 small flex-grow-1">
            <div class="row g-2">
              <div class="col-6 text-muted">Brand & Model:</div>
              <div class="col-6 text-end fw-semibold text-dark">${v.brand} ${v.year}</div>
              
              <div class="col-6 text-muted">Fuel & Type:</div>
              <div class="col-6 text-end fw-semibold text-dark">${v.fuel} • ${v.type}</div>

              <div class="col-6 text-muted">Mileage:</div>
              <div class="col-6 text-end fw-semibold text-dark">${v.mileage.toLocaleString()} km</div>

              <div class="col-6 text-muted">Last Service:</div>
              <div class="col-6 text-end text-dark">${AutoCareApp.formatDate(v.lastServiceDate)}</div>

              <div class="col-6 text-muted">Next Due:</div>
              <div class="col-6 text-end fw-bold text-primary">${AutoCareApp.formatDate(v.nextServiceDate)}</div>

              <div class="col-6 text-muted">Insurance Till:</div>
              <div class="col-6 text-end text-dark">${AutoCareApp.formatDate(v.insuranceExpiry)}</div>
            </div>
          </div>

          <div class="d-flex gap-2 pt-2 border-top">
            <a href="book-service.html?vehicleId=${v.id}" class="btn btn-primary btn-sm flex-fill">
              <i class="fa-solid fa-calendar-plus"></i> Book
            </a>
            <a href="service-history.html?vehicleId=${v.id}" class="btn btn-secondary-custom btn-sm flex-fill">
              <i class="fa-solid fa-clock-rotate-left"></i> History
            </a>
            <button class="btn btn-outline-danger btn-sm" onclick="AutoCareOwner.deleteVehicle('${v.id}')" title="Delete Vehicle">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function setupAddVehicleForm() {
    const form = document.getElementById('addVehicleForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const newVehicle = {
        name: document.getElementById('vehName').value,
        regNumber: document.getElementById('vehReg').value.toUpperCase(),
        brand: document.getElementById('vehBrand').value,
        model: document.getElementById('vehModel').value,
        year: parseInt(document.getElementById('vehYear').value, 10),
        fuel: document.getElementById('vehFuel').value,
        type: document.getElementById('vehType').value,
        mileage: parseInt(document.getElementById('vehMileage').value, 10) || 0,
        insuranceExpiry: document.getElementById('vehInsurance').value,
        lastServiceDate: document.getElementById('vehLastService').value,
        nextServiceDate: document.getElementById('vehNextService').value
      };

      try {
        const savedVehicle = AutoCareData.addVehicle(newVehicle);
        AutoCareApp.Toast.show('success', 'Vehicle Added', `${savedVehicle.name} (${savedVehicle.regNumber}) saved to the database successfully.`);
      } catch (error) {
        AutoCareApp.Toast.show('danger', 'Vehicle Not Saved', error.message || 'Vehicle could not be saved. Please check your database connection.');
        return;
      }
      
      const modalEl = document.getElementById('addVehicleModal');
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      form.reset();
      renderVehicleCards();
    });
  }

  function deleteVehicle(id) {
    if (confirm('Are you sure you want to remove this vehicle from your AutoCare garage?')) {
      try {
        AutoCareData.deleteVehicle(id);
        AutoCareApp.Toast.show('info', 'Vehicle Removed', 'Vehicle deleted from your profile and database.');
        renderVehicleCards();
      } catch (error) {
        AutoCareApp.Toast.show('danger', 'Delete Failed', error.message || 'Vehicle could not be deleted.');
      }
    }
  }

  // --- Book Service Multi-Step Wizard ---
  function initBookingWizard() {
    renderWizardVehicles();
    renderWizardServices();
    renderWizardGarages();
    setupWizardStepNavigation();
  }

  function renderWizardVehicles() {
    const container = document.getElementById('wizard-vehicles-container');
    if (!container) return;

    const vehicles = AutoCareData.getVehicles();
    container.innerHTML = vehicles.map((v, idx) => `
      <div class="col-md-4 mb-3">
        <div class="selection-card vehicle-select-card ${idx === 0 ? 'selected' : ''}" data-id="${v.id}" data-name="${v.name}" data-reg="${v.regNumber}">
          <div class="d-flex align-items-center gap-3">
            <div class="stat-card-icon icon-blue fs-4">
              <i class="fa-solid ${v.imageIcon || 'fa-car'}"></i>
            </div>
            <div>
              <h6 class="fw-bold mb-0 text-dark">${v.name}</h6>
              <span class="badge bg-light text-dark border font-monospace mt-1">${v.regNumber}</span>
              <div class="small text-muted mt-1">${v.fuel} • ${v.mileage.toLocaleString()} km</div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    if (vehicles.length > 0) {
      bookingState.vehicleId = vehicles[0].id;
      bookingState.vehicleName = vehicles[0].name;
      bookingState.regNumber = vehicles[0].regNumber;
    }

    document.querySelectorAll('.vehicle-select-card').forEach(card => {
      card.addEventListener('click', function () {
        document.querySelectorAll('.vehicle-select-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        bookingState.vehicleId = this.dataset.id;
        bookingState.vehicleName = this.dataset.name;
        bookingState.regNumber = this.dataset.reg;
      });
    });
  }

  function renderWizardServices() {
    const container = document.getElementById('wizard-services-container');
    if (!container) return;

    const services = AutoCareData.getServices();
    container.innerHTML = services.map((s, idx) => `
      <div class="col-md-6 col-lg-3 mb-3">
        <div class="selection-card service-select-card ${idx === 0 ? 'selected' : ''}" data-id="${s.id}" data-name="${s.name}" data-price="${s.price}">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="stat-card-icon icon-blue fs-5">
              <i class="fa-solid ${s.icon}"></i>
            </div>
            <span class="badge bg-light text-primary border fw-bold">${AutoCareApp.formatCurrency(s.price)}</span>
          </div>
          <h6 class="fw-bold text-dark mb-1">${s.name}</h6>
          <p class="small text-secondary mb-2 lh-sm">${s.description}</p>
          <div class="small text-muted"><i class="fa-regular fa-clock me-1"></i> ${s.duration}</div>
        </div>
      </div>
    `).join('');

    if (services.length > 0) {
      bookingState.serviceId = services[0].id;
      bookingState.serviceName = services[0].name;
      bookingState.servicePrice = services[0].price;
    }

    document.querySelectorAll('.service-select-card').forEach(card => {
      card.addEventListener('click', function () {
        document.querySelectorAll('.service-select-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        bookingState.serviceId = this.dataset.id;
        bookingState.serviceName = this.dataset.name;
        bookingState.servicePrice = parseInt(this.dataset.price, 10);
      });
    });
  }

  function renderWizardGarages() {
    const container = document.getElementById('wizard-garages-container');
    if (!container) return;

    const garages = AutoCareData.getGarages();
    container.innerHTML = garages.map((g, idx) => `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="selection-card garage-select-card ${idx === 0 ? 'selected' : ''}" data-id="${g.id}" data-name="${g.name}">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h6 class="fw-bold text-dark mb-0">${g.name}</h6>
            <span class="badge bg-success text-white"><i class="fa-solid fa-star me-1"></i>${g.rating}</span>
          </div>
          <p class="small text-secondary mb-2"><i class="fa-solid fa-location-dot text-danger me-1"></i> ${g.location} (${g.distance})</p>
          <div class="d-flex justify-content-between align-items-center small pt-2 border-top">
            <span class="text-success fw-semibold"><i class="fa-solid fa-circle-check me-1"></i> ${g.availableSlots} Slots Open</span>
            <span class="badge bg-light-subtle text-muted border">${g.completedJobs}+ Done</span>
          </div>
        </div>
      </div>
    `).join('');

    if (garages.length > 0) {
      bookingState.garageId = garages[0].id;
      bookingState.garageName = garages[0].name;
    }

    document.querySelectorAll('.garage-select-card').forEach(card => {
      card.addEventListener('click', function () {
        document.querySelectorAll('.garage-select-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        bookingState.garageId = this.dataset.id;
        bookingState.garageName = this.dataset.name;
      });
    });
  }

  function setupWizardStepNavigation() {
    let currentStep = 1;
    const totalSteps = 5;

    // Time Slot Pills
    document.querySelectorAll('.time-slot-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (this.classList.contains('disabled')) {
          AutoCareApp.Toast.show('warning', 'Slot Unavailable', 'This slot is fully booked. Please choose another time.');
          return;
        }
        document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        bookingState.time = this.dataset.time;
      });
    });

    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.min = today;
      dateInput.value = today;
      bookingState.date = today;
      dateInput.addEventListener('change', (e) => {
        bookingState.date = e.target.value;
      });
    }

    // Default time slot
    bookingState.time = '10:00 AM';

    function updateStepView() {
      for (let i = 1; i <= totalSteps; i++) {
        const stepView = document.getElementById(`step-content-${i}`);
        const stepHeader = document.getElementById(`wizard-step-header-${i}`);
        
        if (stepView) {
          stepView.style.display = i === currentStep ? 'block' : 'none';
        }
        if (stepHeader) {
          stepHeader.classList.remove('active', 'completed');
          if (i === currentStep) stepHeader.classList.add('active');
          if (i < currentStep) stepHeader.classList.add('completed');
        }
      }

      // If Step 5 (Summary), calculate and populate summary details
      if (currentStep === 5) {
        populateBookingSummary();
      }
    }

    const nextBtn = document.getElementById('wizard-next-btn');
    const prevBtn = document.getElementById('wizard-prev-btn');
    const confirmBtn = document.getElementById('wizard-confirm-btn');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentStep < totalSteps) {
          currentStep++;
          updateStepView();
          if (prevBtn) prevBtn.style.display = 'inline-flex';
          if (currentStep === totalSteps) {
            nextBtn.style.display = 'none';
            if (confirmBtn) confirmBtn.style.display = 'inline-flex';
          }
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
          currentStep--;
          updateStepView();
          if (nextBtn) nextBtn.style.display = 'inline-flex';
          if (confirmBtn) confirmBtn.style.display = 'none';
          if (currentStep === 1) prevBtn.style.display = 'none';
        }
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const notesEl = document.getElementById('bookingNotes');
        if (notesEl) bookingState.notes = notesEl.value;

        let newBooking;
        try { newBooking = AutoCareData.addBooking({
          vehicleId: bookingState.vehicleId,
          vehicleName: bookingState.vehicleName,
          regNumber: bookingState.regNumber,
          garageId: bookingState.garageId,
          garageName: bookingState.garageName,
          serviceId: bookingState.serviceId,
          serviceName: bookingState.serviceName,
          date: bookingState.date,
          time: bookingState.time,
          technician: 'Ramesh Sawant',
          estimatedCost: bookingState.servicePrice,
          totalCost: bookingState.servicePrice,
          notes: bookingState.notes || 'Standard booked service.'
        }); } catch (error) { AutoCareApp.Toast.show('danger', 'Booking Failed', error.message || 'Please try again.'); return; }

        // Show Success View
        document.getElementById('booking-wizard-card').style.display = 'none';
        const successCard = document.getElementById('booking-success-card');
        if (successCard) {
          successCard.style.display = 'block';
          document.getElementById('confirmed-booking-id').textContent = newBooking.id;
          document.getElementById('confirmed-vehicle').textContent = newBooking.vehicleName + ' (' + newBooking.regNumber + ')';
          document.getElementById('confirmed-garage').textContent = newBooking.garageName;
          document.getElementById('confirmed-datetime').textContent = `${AutoCareApp.formatDate(newBooking.date)} at ${newBooking.time}`;
          document.getElementById('confirmed-cost').textContent = AutoCareApp.formatCurrency(newBooking.estimatedCost);
        }

        AutoCareApp.Toast.show('success', 'Booking Confirmed!', `Booking #${newBooking.id} created successfully.`);
      });
    }

    updateStepView();
  }

  function populateBookingSummary() {
    const summaryVeh = document.getElementById('summary-vehicle');
    const summarySrv = document.getElementById('summary-service');
    const summaryGar = document.getElementById('summary-garage');
    const summaryDt = document.getElementById('summary-datetime');
    const summarySub = document.getElementById('summary-subtotal');
    const summaryTax = document.getElementById('summary-tax');
    const summaryTot = document.getElementById('summary-total');

    if (summaryVeh) summaryVeh.textContent = `${bookingState.vehicleName} (${bookingState.regNumber})`;
    if (summarySrv) summarySrv.textContent = bookingState.serviceName;
    if (summaryGar) summaryGar.textContent = bookingState.garageName;
    if (summaryDt) summaryDt.textContent = `${AutoCareApp.formatDate(bookingState.date)} at ${bookingState.time}`;

    const subtotal = bookingState.servicePrice;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax;

    if (summarySub) summarySub.textContent = AutoCareApp.formatCurrency(subtotal);
    if (summaryTax) summaryTax.textContent = AutoCareApp.formatCurrency(tax);
    if (summaryTot) summaryTot.textContent = AutoCareApp.formatCurrency(total);
  }

  // --- Detailed Inspection View Modal ---
  function viewInspectionDetails(bookingId) {
    const bookings = AutoCareData.getBookings();
    const b = bookings.find(item => item.id === bookingId) || bookings[0];

    const modalEl = document.getElementById('serviceDetailModal');
    if (!modalEl) return;

    document.getElementById('modal-service-id').textContent = b.id;
    document.getElementById('modal-vehicle-name').textContent = b.vehicleName + ' (' + b.regNumber + ')';
    document.getElementById('modal-service-name').textContent = b.serviceName;
    document.getElementById('modal-garage-name').textContent = b.garageName;
    document.getElementById('modal-service-date').textContent = AutoCareApp.formatDate(b.date);
    document.getElementById('modal-technician').textContent = b.technician || 'Chief Mechanic';
    document.getElementById('modal-service-status').innerHTML = `<span class="badge-status badge-${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span>`;
    document.getElementById('modal-total-cost').textContent = AutoCareApp.formatCurrency(b.totalCost || b.estimatedCost);

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  // --- Reminders Page Controller ---
  function initRemindersPage() {
    renderReminderCards();
    setupAddReminderForm();
  }

  function renderReminderCards() {
    const container = document.getElementById('reminders-container');
    if (!container) return;

    const reminders = AutoCareData.getReminders();
    if (reminders.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="card-custom empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-bell-slash"></i></div>
            <div class="empty-state-title">No reminders right now</div>
            <p class="empty-state-text">You're all caught up! AutoCare will alert you automatically when upcoming services or certificate renewals are due.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = reminders.map(r => `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card-custom h-100 border-start border-4 border-${r.colorClass || 'primary'} d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge-status ${r.badgeClass}">${r.status}</span>
            <small class="text-muted"><i class="fa-regular fa-calendar me-1"></i> ${AutoCareApp.formatDate(r.dueDate)}</small>
          </div>

          <div class="d-flex align-items-center gap-3 my-2">
            <div class="stat-card-icon icon-${r.colorClass || 'blue'} fs-4">
              <i class="fa-solid ${r.icon || 'fa-bell'}"></i>
            </div>
            <div>
              <h6 class="fw-bold mb-0 text-dark">${r.title}</h6>
              <small class="text-primary fw-medium">${r.vehicleName} (${r.regNumber})</small>
            </div>
          </div>

          <p class="small text-secondary flex-grow-1 my-2 lh-sm">${r.description}</p>

          <div class="d-flex gap-2 pt-3 border-top mt-auto">
            <a href="book-service.html" class="btn btn-primary btn-sm flex-fill">
              <i class="fa-solid fa-wrench"></i> ${r.actionLabel || 'Book Service'}
            </a>
            <button class="btn btn-outline-secondary btn-sm" onclick="AutoCareOwner.dismissReminder('${r.id}')">
              <i class="fa-solid fa-check"></i> Dismiss
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function dismissReminder(id) {
    AutoCareData.dismissReminder(id);
    AutoCareApp.Toast.show('info', 'Reminder Dismissed', 'Reminder marked as acknowledged.');
    renderReminderCards();
  }

  function setupAddReminderForm() {
    const form = document.getElementById('addReminderForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const vehSelect = document.getElementById('remVehicle');
      const vehOpt = vehSelect.options[vehSelect.selectedIndex];

      const newRem = {
        vehicleId: vehSelect.value,
        vehicleName: vehOpt.dataset.name,
        regNumber: vehOpt.dataset.reg,
        type: document.getElementById('remType').value,
        title: document.getElementById('remTitle').value,
        description: document.getElementById('remDesc').value,
        dueDate: document.getElementById('remDate').value,
        status: 'Upcoming',
        badgeClass: 'badge-upcoming',
        colorClass: 'info',
        icon: 'fa-bell',
        actionLabel: 'Schedule'
      };

      AutoCareData.addReminder(newRem);
      AutoCareApp.Toast.show('success', 'Reminder Set', 'Custom reminder created.');
      
      const modalEl = document.getElementById('addReminderModal');
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      form.reset();
      renderReminderCards();
    });
  }

  // --- Invoices Page Controller ---
  function initInvoicesPage() {
    renderInvoicesTable();
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    const payId = params.get('pay');
    if (viewId) viewInvoiceModal(viewId);
    if (payId) {
      const target = getCurrentOwnerInvoices().find(inv => inv.id === payId);
      if (target) openPaymentModal(target.id, Number(target.total));
    }
    // Demo cross-tab refresh: admin verification in another tab updates localStorage.
    let knownStatuses = {};
    AutoCareData.getInvoices().forEach(inv => { knownStatuses[inv.id] = inv.status; });
    const refreshPaymentStatuses = function () {
      const invoices = AutoCareData.getInvoices();
      invoices.forEach(inv => {
        if (knownStatuses[inv.id] === 'Pending Verification' && inv.status === 'Paid') {
          AutoCareApp.Toast.show('success', 'Payment Successful', `${inv.id} payment has been verified by the receiver.`);
        }
        knownStatuses[inv.id] = inv.status;
      });
      renderInvoicesTable();
    };
    window.addEventListener('storage', refreshPaymentStatuses);
    window.setInterval(refreshPaymentStatuses, 3000);
  }

  function renderInvoicesTable() {
    const tbody = document.getElementById('invoices-tbody');
    if (!tbody) return;

    const invoices = getCurrentOwnerInvoices();
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No invoices have been generated for your account yet.</td></tr>';
      return;
    }
    tbody.innerHTML = invoices.map(inv => `
      <tr>
        <td><strong class="font-monospace text-primary">${inv.id}</strong></td>
        <td>
          <div class="fw-semibold text-dark">${inv.vehicleName}</div>
          <small class="text-muted font-monospace">${inv.regNumber}</small>
        </td>
        <td><small class="text-secondary">${inv.garageName}</small></td>
        <td><small class="text-dark">${AutoCareApp.formatDate(inv.date)}</small></td>
        <td class="fw-bold text-dark">${AutoCareApp.formatCurrency(inv.total)}</td>
        <td>
          <span class="badge-status badge-${inv.status.toLowerCase()}">${inv.status}</span>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="AutoCareOwner.viewInvoiceModal('${inv.id}')" title="View & Print">
              <i class="fa-regular fa-file-pdf"></i> View
            </button>
            ${inv.status === 'Pending' ? `
              <button class="btn btn-success" onclick="AutoCareOwner.openPaymentModal('${inv.id}', ${inv.total})" title="Pay Online">
                <i class="fa-solid fa-credit-card"></i> Pay Now
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function viewInvoiceModal(invId) {
    const invoices = getCurrentOwnerInvoices();
    const inv = invoices.find(i => i.id === invId);
    if (!inv) {
      AutoCareApp.Toast.show('danger', 'Invoice not found', 'This invoice does not belong to the signed-in owner account.');
      return;
    }

    const modalEl = document.getElementById('invoiceViewerModal');
    if (!modalEl) return;

    document.getElementById('inv-print-number').textContent = inv.id;
    document.getElementById('inv-print-date').textContent = AutoCareApp.formatDate(inv.date);
    document.getElementById('inv-print-due').textContent = AutoCareApp.formatDate(inv.dueDate);
    document.getElementById('inv-print-garage-name').textContent = inv.garageName;
    document.getElementById('inv-print-garage-gst').textContent = 'GSTIN: ' + (inv.garageGST || '27AABCS1429B1Z8');
    document.getElementById('inv-print-customer-name').textContent = inv.customerName;
    document.getElementById('inv-print-customer-phone').textContent = inv.customerPhone;
    document.getElementById('inv-print-customer-address').textContent = inv.customerAddress || 'Mumbai, Maharashtra';
    document.getElementById('inv-print-vehicle').textContent = `${inv.vehicleName} (${inv.regNumber})`;
    document.getElementById('inv-print-status').innerHTML = `<span class="badge-status badge-${inv.status.toLowerCase()}">${inv.status}</span>`;

    const itemsTbody = document.getElementById('inv-print-items-tbody');
    if (itemsTbody) {
      itemsTbody.innerHTML = inv.items.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div class="fw-semibold text-dark">${item.description}</div>
            <small class="text-muted">${item.type}</small>
          </td>
          <td class="text-center">${item.qty}</td>
          <td class="text-end">${AutoCareApp.formatCurrency(item.rate)}</td>
          <td class="text-end fw-semibold">${AutoCareApp.formatCurrency(item.amount)}</td>
        </tr>
      `).join('');
    }

    document.getElementById('inv-print-subtotal').textContent = AutoCareApp.formatCurrency(inv.subtotal);
    document.getElementById('inv-print-tax').textContent = AutoCareApp.formatCurrency(inv.taxAmount);
    document.getElementById('inv-print-discount').textContent = '-' + AutoCareApp.formatCurrency(inv.discount);
    document.getElementById('inv-print-total').textContent = AutoCareApp.formatCurrency(inv.total);

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  let activePaymentInvoiceId = null;

  function openPaymentModal(invId, amount) {
    const modalEl = document.getElementById('paymentGatewayModal');
    if (!modalEl) return;

    const invoice = getCurrentOwnerInvoices().find(i => String(i.id) === String(invId));
    if (!invoice) {
      AutoCareApp.Toast.show('danger', 'Invoice not found', 'Please refresh and try again.');
      return;
    }
    if (String(invoice.status || '').toLowerCase() === 'paid') {
      AutoCareApp.Toast.show('info', 'Already paid', 'This invoice is already marked as paid.');
      return;
    }

    activePaymentInvoiceId = invoice.id;
    document.getElementById('pay-invoice-id').textContent = invoice.id;
    document.getElementById('pay-amount').textContent = AutoCareApp.formatCurrency(Number(amount || invoice.total));
    const status = document.getElementById('payment-submit-status');
    if (status) status.textContent = '';

    const continueButton = document.getElementById('continue-razorpay-payment');
    if (continueButton) {
      continueButton.onclick = function () {
        // Database invoice IDs are numeric. Never send demo/localStorage IDs to the payment API.
        if (!/^\d+$/.test(String(activePaymentInvoiceId))) {
          if (status) {
            status.className = 'small mt-3 text-danger';
            status.textContent = 'This invoice is not linked to a database invoice ID. Please generate/open the invoice from the live database before payment.';
          }
          return;
        }
        const checkoutUrl = new URL('../../backend/payment/checkout.php', window.location.href);
        checkoutUrl.searchParams.set('invoice_id', String(activePaymentInvoiceId));
        window.location.href = checkoutUrl.href;
      };
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  return {
    initDashboard: initDashboard,
    initVehiclesPage: initVehiclesPage,
    initBookingWizard: initBookingWizard,
    initRemindersPage: initRemindersPage,
    initInvoicesPage: initInvoicesPage,
    viewInspectionDetails: viewInspectionDetails,
    deleteVehicle: deleteVehicle,
    dismissReminder: dismissReminder,
    viewInvoiceModal: viewInvoiceModal,
    openPaymentModal: openPaymentModal
  };
})();
