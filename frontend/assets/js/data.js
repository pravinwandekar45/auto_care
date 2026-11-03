/**
 * AutoCare – Smart Vehicle Service & Maintenance Management
 * Central data layer backed by MySQL portal_state API, with localStorage fallback.
 */

// Enforce Owner / Garage / Admin portal separation on EVERY protected page.
// This runs as soon as data.js loads, including on dashboard sub-pages.
(function enforcePortalRole() {
  const path = String(window.location.pathname || '').toLowerCase();
  const match = path.match(/\/(owner|garage|admin)\//);
  if (!match) return; // Login, registration and public pages remain accessible.

  let auth = null;
  try { auth = JSON.parse(localStorage.getItem('AUTOCARE_AUTH_USER_V1') || 'null'); }
  catch (_) { auth = null; }

  const requiredRole = match[1];
  const actualRole = String(auth && auth.role || '').trim().toLowerCase();
  if (!auth || actualRole !== requiredRole) {
    // Keep a valid account intact; the user can sign in with the correct portal.
    window.location.replace('../login.html');
  }
})();

const AutoCareData = (function () {
  const STORAGE_KEY = 'AUTOCARE_PORTAL_DATA_V1';
  const DATA_SCRIPT_URL = document.currentScript ? document.currentScript.src : window.location.href;
  const PORTAL_API_URL = new URL('../../../backend/api/portal_data.php', DATA_SCRIPT_URL).href;
  const VEHICLES_API_URL = new URL('../../../backend/api/vehicles.php', DATA_SCRIPT_URL).href;
  const BOOKINGS_API_URL = new URL('../../../backend/api/bookings.php', DATA_SCRIPT_URL).href;
  const INVOICES_API_URL = new URL('../../../backend/api/invoices.php', DATA_SCRIPT_URL).href;

  function vehicleApiRequest(method, payload, id) {
    try {
      const xhr = new XMLHttpRequest();
      const url = id ? VEHICLES_API_URL + '?id=' + encodeURIComponent(id) : VEHICLES_API_URL;
      xhr.open(method, url, false);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload ? JSON.stringify(payload) : null);
      const body = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300 && body.success !== false) return body;
      return { success: false, error: body.error || 'Vehicle database request failed.' };
    } catch (e) {
      console.error('Vehicle database request failed:', e);
      return { success: false, error: 'Could not connect to the vehicle database. Start Apache/MySQL and check the database configuration.' };
    }
  }

  function businessApiRequest(url, method, payload, id) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url + (id ? '?id=' + encodeURIComponent(id) : ''), false);
      xhr.withCredentials = true; xhr.setRequestHeader('Content-Type','application/json');
      xhr.send(payload ? JSON.stringify(payload) : null);
      const body = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300 && body.success !== false) return body;
      throw new Error(body.error || 'Database request failed.');
    } catch (e) { throw new Error(e.message || 'Could not connect to AutoCare Pro database.'); }
  }

  function currentAuthUser() {
    try { return JSON.parse(localStorage.getItem('AUTOCARE_AUTH_USER_V1') || 'null'); } catch (_) { return null; }
  }

  function apiRequest(method, payload) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, PORTAL_API_URL, false); // Keep the existing synchronous data-layer API compatible.
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload ? JSON.stringify(payload) : null);
      if (xhr.status >= 200 && xhr.status < 300) return JSON.parse(xhr.responseText || '{}');
    } catch (e) { console.warn('MySQL API is unavailable; using local fallback.', e); }
    return null;
  }

  function freshData() {
    return {
      currentUser: null, vehicles: [], bookings: [], invoices: [], reminders: [],
      notifications: [], serviceHistory: [], slots: [], users: [], customers: [],
      garages: [], services: []
    };
  }

  const defaultData = {
    currentUser: null,
    vehicles: [], bookings: [], invoices: [], reminders: [], notifications: [],
    serviceHistory: [], slots: [], users: [], customers: [], garages: [], services: []
  };

  function getData() {
    const auth = currentAuthUser();
    if (auth) {
      const response = apiRequest('GET');
      if (response && response.success) {
        const data = response.state && typeof response.state === 'object' ? response.state : freshData();
        data.currentUser = {
          ...auth,
          role: String(auth.role || 'owner').toLowerCase(),
          address: auth.city || auth.address || '',
          avatar: (auth.name || 'U').split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase()
        };
        if (data.currentUser.role === 'garage') data.currentGarageId = auth.garageId || auth.id;
        if (!response.state) setData(data);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
        return data;
      }
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const auth = currentAuthUser();
        if (auth) {
          data.currentUser = { ...auth, role: String(auth.role || 'owner').toLowerCase(), address: auth.city || auth.address || '' };
          if (data.currentUser.role === 'garage') data.currentGarageId = auth.garageId || auth.id;
        }
        return data;
      }
    } catch (e) { console.warn('LocalStorage read failed:', e); }
    const data = auth ? freshData() : JSON.parse(JSON.stringify(defaultData));
    if (auth) data.currentUser = auth;
    setData(data);
    return data;
  }

  function setData(data) {
    const snapshot = JSON.parse(JSON.stringify(data || {}));
    delete snapshot.currentUser;
    delete snapshot.currentGarageId;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch (e) { console.error('Local cache save failed:', e); }
    if (currentAuthUser()) {
      const response = apiRequest('POST', { state: snapshot });
      if (!response || !response.success) console.error('Could not save to MySQL. Check XAMPP, database schema, and login session.');
    }
  }

  return {
    init: function () {
      if (!localStorage.getItem(STORAGE_KEY)) setData(freshData());
    },

    reset: function () {
      const clean = freshData();
      setData(clean);
      return clean;
    },

    getCurrentUser: function () {
      return getData().currentUser;
    },

    setAuthenticatedUser: function (user, isNewAccount = false) {
      const data = getData();
      const role = String(user.role || 'owner').toLowerCase();
      const userId = String(user.id || ('usr-' + btoa(user.email || user.name || 'user').replace(/[^a-z0-9]/gi, '').slice(0, 18)));
      const garageName = user.garageName || (role === 'garage' ? (user.name || 'My') + ' Garage' : '');
      data.currentUser = {
        id: userId, role, name: user.name || 'User', email: String(user.email || '').toLowerCase(),
        phone: user.phone || '', garageName, city: user.city || '',
        avatar: (user.name || 'U').split(/\s+/).filter(Boolean).map(part => part[0] || '').join('').slice(0, 2).toUpperCase(),
        address: user.city || '', memberSince: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), licenseNo: ''
      };
      data.users = data.users || [];
      const userRoleLabel = role === 'garage' ? 'Garage Staff' : (role === 'admin' ? 'Admin' : 'Vehicle Owner');
      let storedUser = data.users.find(u => String(u.id) === userId || String(u.email || '').toLowerCase() === data.currentUser.email);
      if (!storedUser) {
        storedUser = { id: userId, name: data.currentUser.name, email: data.currentUser.email, phone: data.currentUser.phone, role: userRoleLabel, status: 'Active', garage: garageName, createdDate: new Date().toISOString().slice(0, 10) };
        data.users.push(storedUser);
      } else {
        Object.assign(storedUser, { name: data.currentUser.name, email: data.currentUser.email, phone: data.currentUser.phone, role: userRoleLabel, garage: garageName || storedUser.garage });
      }
      if (role === 'garage') {
        data.currentGarageId = String(user.garageId || userId);
        data.garages = data.garages || [];
        let garage = data.garages.find(g => String(g.id) === data.currentGarageId || String(g.email || '').toLowerCase() === data.currentUser.email);
        if (!garage) {
          garage = { id: data.currentGarageId, name: garageName || (user.name + ' Garage'), owner: user.name || '', email: data.currentUser.email, phone: user.phone || '', location: user.city || '', address: user.city || '', rating: 0, reviewsCount: 0, distance: '', bays: 1, availableSlots: 0, isOpen: true, status: 'Active', servicesCount: 0, completedJobs: 0 };
          data.garages.push(garage);
        } else Object.assign(garage, { name: garageName || garage.name, owner: user.name || garage.owner, email: data.currentUser.email, phone: user.phone || garage.phone, location: user.city || garage.location });
      }
      setData(data);
    },

    setCurrentRole: function (role) {
      const data = getData();
      // Change only the role label; never replace the signed-in account with demo identity.
      data.currentUser.role = role;
      const name = data.currentUser.name || 'User';
      data.currentUser.avatar = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
      setData(data);
    },

    getRegisteredCustomers: function () {
      const data = getData();
      const customers = [];
      const addCustomer = (u) => {
        if (!u || (u.role && !['owner', 'Vehicle Owner', 'vehicle_owner'].includes(u.role))) return;
        const email = String(u.email || '').toLowerCase();
        if (!email || customers.some(c => c.email === email)) return;
        customers.push({ id: String(u.id || ''), name: u.name || 'Customer', email, phone: u.phone || '', role: 'owner' });
      };
      (data.users || []).forEach(addCustomer);
      const current = data.currentUser || {};
      if (current.email && (!current.role || current.role === 'owner' || current.role === 'Vehicle Owner')) addCustomer(current);
      return customers;
    },

    getVehicles: function () {
      const data = getData();
      const response = vehicleApiRequest('GET');
      if (response && response.success && Array.isArray(response.vehicles)) {
        // The vehicles table is the source of truth. Sync it into the shared dashboard cache
        // so the Garage and Admin screens can also display newly registered vehicles.
        data.vehicles = response.vehicles;
        const user = data.currentUser || {};
        if (String(user.role || '').toLowerCase() === 'owner') return response.vehicles;
        return response.vehicles;
      }
      const user = data.currentUser || {};
      const all = data.vehicles || [];
      if (String(user.role || '').toLowerCase() !== 'owner') return all;
      return all.filter(v => String(v.ownerId || '') === String(user.id || '') || String(v.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase());
    },

    getVehiclesForCustomer: function (customerId, customerEmail, customerName) {
      const vehicles = this.getVehicles();
      const email = String(customerEmail || '').toLowerCase();
      return vehicles.filter(v =>
        (customerId && String(v.ownerId || '') === String(customerId)) ||
        (email && String(v.ownerEmail || '').toLowerCase() === email) ||
        (customerName && String(v.ownerName || '').toLowerCase() === String(customerName).toLowerCase())
      );
    },

    addVehicle: function (vehicle) {
      const data = getData();
      const owner = data.currentUser || {};
      if (String(owner.role || '').toLowerCase() !== 'owner') throw new Error('Only a signed-in car owner can register a vehicle.');
      const response = vehicleApiRequest('POST', vehicle);
      if (!response || !response.success || !response.vehicle) throw new Error((response && response.error) || 'Vehicle was not saved to the database.');
      const savedVehicle = response.vehicle;
      data.vehicles = (data.vehicles || []).filter(v => String(v.id) !== String(savedVehicle.id));
      data.vehicles.unshift(savedVehicle);
      setData(data);
      return savedVehicle;
    },

    deleteVehicle: function (id) {
      const response = vehicleApiRequest('DELETE', null, id);
      if (!response || !response.success) throw new Error((response && response.error) || 'Vehicle could not be deleted from the database.');
      const data = getData();
      data.vehicles = (data.vehicles || []).filter(v => String(v.id) !== String(id));
      setData(data);
      return true;
    },

    getServices: function () {
      return getData().services;
    },

    getGarages: function () {
      const data = getData();
      const user = data.currentUser || {};
      if (String(user.role || '').toLowerCase() === 'garage' && data.currentGarageId && !['gar-001', 'gar-002'].includes(String(data.currentGarageId))) {
        return (data.garages || []).filter(g => String(g.id) === String(data.currentGarageId));
      }
      return data.garages || [];
    },

    getCurrentGarage: function () {
      const data = getData();
      const user = data.currentUser || {};
      const id = data.currentGarageId || user.garageId || user.id;
      return (data.garages || []).find(g => String(g.id) === String(id)) || {
        id, name: user.garageName || (user.name ? user.name + ' Garage' : 'My Garage'),
        owner: user.name || '', email: user.email || '', phone: user.phone || '', location: user.address || ''
      };
    },

    updateGarageStatus: function (id, status) {
      const data = getData();
      const g = data.garages.find(gar => gar.id === id);
      if (g) {
        g.status = status;
        setData(data);
      }
    },

    getBookings: function () {
      const response = businessApiRequest(BOOKINGS_API_URL, 'GET');
      const rows = response.bookings || [];
      return rows.map(b => ({...b, id:String(b.id), vehicleId:String(b.vehicle_id), ownerId:String(b.owner_id), garageId:String(b.garage_id || ''), serviceId:b.service_id || '', serviceName:b.service_name || b.service_package || 'General Service', workflowStage:b.workflow_stage || '', date:String(b.slot_datetime || '').slice(0,10), time:String(b.slot_datetime || '').slice(11,16), vehicleName:[b.make,b.model].filter(Boolean).join(' ') || b.nickname || 'Vehicle', regNumber:b.reg_number || '', garageName:b.garage_name || 'AutoCare Garage', customerName:b.owner_name || '', customerPhone:b.owner_phone || '', ownerEmail:b.owner_email || '', status:String(b.status || 'pending').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), notes:b.notes || ''}));
    },

    addBooking: function (booking) {
      const dt = String(booking.date || '') + ' ' + (String(booking.time || '10:00').match(/^\d{2}:\d{2}$/) ? booking.time : '10:00') + ':00';
      const response = businessApiRequest(BOOKINGS_API_URL, 'POST', {vehicle_id:Number(booking.vehicleId), garage_id:Number(booking.garageId), service_id:booking.serviceId || null, service_name:booking.serviceName || 'General Service', slot_datetime:dt, notes:booking.notes || ''});
      const row = response.booking;
      return {...booking, id:String(row.id), ownerId:String(row.owner_id), garageId:String(row.garage_id), serviceName:row.service_name || booking.serviceName || 'General Service', status:'Pending'};
    },

    updateBookingStatus: function (id, status, stage) {
      const apiStatus = String(status || '').toLowerCase().replace(/\\s+/g, '_');
      businessApiRequest(BOOKINGS_API_URL, 'PUT', {status:apiStatus, workflow_stage:stage || ''}, id);
      return this.getBookings().find(b => String(b.id) === String(id)) || null;
    },

    getInvoices: function () {
      const response = businessApiRequest(INVOICES_API_URL, 'GET');
      return (response.invoices || []).map(i => ({...i, id:String(i.id), bookingId:String(i.booking_id), ownerId:String(i.owner_id), garageId:String(i.garage_id || ''), ownerEmail:i.owner_email || '', ownerName:i.owner_name || '', vehicleName:[i.make,i.model].filter(Boolean).join(' ') || i.nickname || 'Vehicle', regNumber:i.reg_number || '', garageName:i.garage_name || 'AutoCare Garage', date:i.slot_datetime, total:Number(i.amount), amount:Number(i.amount), status:String(i.payment_status || 'pending').replace(/^./,c=>c.toUpperCase())}));
    },

    addInvoice: function (invoice) {
      const response = businessApiRequest(INVOICES_API_URL, 'POST', {booking_id:Number(invoice.bookingId), amount:Number(invoice.total || invoice.amount), items:invoice.items || []});
      return {...invoice, id:String(response.invoice.id), bookingId:String(response.invoice.booking_id), status:'Pending'};
    },

    payInvoice: function (id, method) {
      const data = getData();
      const inv = data.invoices.find(i => i.id === id);
      if (inv) {
        inv.status = 'Paid';
        inv.paymentMethod = method || 'UPI Sandbox Payment';
        setData(data);
      }
      return inv;
    },
    submitPaymentReference: function (id, utr, method) {
      const data = getData();
      const inv = data.invoices.find(i => i.id === id);
      if (!inv || inv.status === 'Paid') return null;
      inv.status = 'Pending Verification';
      inv.paymentMethod = method || 'UPI QR';
      inv.paymentReference = String(utr || '').trim();
      inv.paymentSubmittedAt = new Date().toISOString();
      setData(data);
      return inv;
    },

    verifyInvoicePayment: function (id, verified) {
      const data = getData();
      const inv = data.invoices.find(i => i.id === id);
      if (!inv) return null;
      if (verified) {
        inv.status = 'Paid';
        inv.paymentVerifiedAt = new Date().toISOString();
      } else {
        inv.status = 'Pending';
      }
      setData(data);
      return inv;
    },

    getReminders: function () {
      const data = getData();
      const user = data.currentUser || {};
      const reminders = data.reminders || [];
      if (String(user.role || '').toLowerCase() !== 'owner') return reminders;
      const vehicleIds = new Set((data.vehicles || []).filter(v => String(v.ownerId || '') === String(user.id || '') || String(v.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase()).map(v => String(v.id)));
      return reminders.filter(r => vehicleIds.has(String(r.vehicleId)) || String(r.ownerId || '') === String(user.id || ''));
    },

    dismissReminder: function (id) {
      const data = getData();
      data.reminders = data.reminders.filter(r => r.id !== id);
      setData(data);
    },

    addReminder: function (reminder) {
      const data = getData();
      reminder.id = 'rem-' + Date.now();
      data.reminders.unshift(reminder);
      setData(data);
      return reminder;
    },

    getSlots: function () {
      const data = getData();
      const user = data.currentUser || {};
      const slots = data.slots || [];
      if (String(user.role || '').toLowerCase() !== 'garage') return slots;
      const garageId = String(data.currentGarageId || user.garageId || user.id || '');
      return slots.filter(s => !s.garageId || String(s.garageId) === garageId);
    },

    updateSlot: function (index, updates) {
      const data = getData();
      const visible = this.getSlots();
      const selected = visible[index];
      if (!selected) return null;
      const slot = (data.slots || []).find(item => (selected.id && String(item.id) === String(selected.id)) || (String(item.time) === String(selected.time) && String(item.garageId || '') === String(selected.garageId || '')));
      if (!slot) return null;
      if (updates.time !== undefined) slot.time = updates.time;
      if (updates.capacity !== undefined) slot.capacity = Math.max(1, Number(updates.capacity) || 1);
      if (updates.enabled !== undefined) slot.enabled = !!updates.enabled;
      slot.available = Math.max(0, slot.capacity - (Number(slot.booked) || 0));
      slot.status = slot.enabled === false ? 'Unavailable' : (slot.available === 0 ? 'Full' : (slot.available <= 1 ? 'Filling Fast' : 'Available'));
      setData(data);
      return slot;
    },

    addSlot: function (slot) {
      const data = getData();
      const user = data.currentUser || {};
      data.slots = data.slots || [];
      const capacity = Math.max(1, Number(slot.capacity) || 1);
      const garageId = String(data.currentGarageId || user.garageId || user.id || '');
      data.slots.push({ ...slot, time: String(slot.time || '').trim(), capacity, booked: 0, available: capacity, status: 'Available', enabled: true, garageId });
      setData(data);
      return data.slots[data.slots.length - 1];
    },

    getUsers: function () {
      return getData().users;
    },

    addUser: function (user) {
      const data = getData();
      data.users = data.users || [];
      data.users.unshift(user);
      setData(data);
      return user;
    },

    updateUserStatus: function (id, status) {
      const data = getData();
      const u = data.users.find(usr => usr.id === id);
      if (u) {
        u.status = status;
        setData(data);
      }
    },

    deleteUser: function (id) {
      const data = getData();
      data.users = data.users.filter(u => u.id !== id);
      setData(data);
    },

    getNotifications: function () {
      return getData().notifications;
    },

    markNotificationsRead: function () {
      const data = getData();
      data.notifications.forEach(n => n.unread = false);
      setData(data);
    }
  };
})();

// Auto-initialize on load and restore the signed-in account without demo identity.
AutoCareData.init();
try {
  const signedInUser = JSON.parse(localStorage.getItem('AUTOCARE_AUTH_USER_V1') || 'null');
  if (signedInUser) AutoCareData.setAuthenticatedUser(signedInUser, false);
} catch (e) {
  console.warn('Could not restore AutoCare session.', e);
}
