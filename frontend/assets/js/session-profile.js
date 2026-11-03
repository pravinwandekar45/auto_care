/* Keep dashboard header and profile page synchronized with the signed-in account. */
(function () {
  const KEY = 'AUTOCARE_AUTH_USER_V1';
  function readUser() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
  }
  function saveUser(user) { try { localStorage.setItem(KEY, JSON.stringify(user)); } catch (_) {} }
  function initials(name) {
    return String(name || 'User').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase() || 'U';
  }
  function applyProfile() {
    const user = readUser();
    if (!user) return;
    const name = String(user.name || user.full_name || user.username || 'User').trim();
    const email = String(user.email || '');
    const phone = String(user.phone || '');
    const avatar = initials(name);
    const role = String(user.role || 'owner').toLowerCase();

    document.querySelectorAll('.sidebar-user-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.sidebar-footer .user-avatar-sm').forEach(el => el.textContent = avatar);
    document.querySelectorAll('[data-current-user-name]').forEach(el => el.textContent = name);
    document.querySelectorAll('[data-current-user-email]').forEach(el => el.textContent = email);

    const topbar = document.querySelector('.app-topbar');
    if (topbar) {
      const nameEl = topbar.querySelector('.fw-semibold.small.text-dark.lh-1');
      if (nameEl) nameEl.textContent = name;
      const avatarEl = topbar.querySelector('.user-avatar-sm');
      if (avatarEl) avatarEl.textContent = avatar;
      const roleEl = topbar.querySelector('.text-muted[style*="font-size"]');
      if (roleEl) roleEl.textContent = role === 'garage' ? 'Garage Owner' : role === 'admin' ? 'Administrator' : 'Vehicle Owner';
    }
    document.querySelectorAll('.welcome-title').forEach(el => {
      el.innerHTML = el.innerHTML.replace(/(Good Morning|Good Afternoon|Good Evening),\s*.*?(?=\s*👋)/, '$1, ' + name);
    });

    // Owner profile summary card (previously hard-coded demo values).
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      const fields = profileForm.querySelectorAll('input, textarea');
      if (fields[0]) fields[0].value = name;
      if (fields[1]) fields[1].value = email;
      if (fields[2] && phone) fields[2].value = phone;
      const card = profileForm.closest('.card-custom');
      const page = document.querySelector('main') || document.body;
      const summary = page.querySelector('.col-lg-4 .card-custom, .col-lg-4 .text-center');
      if (summary) {
        const heading = summary.querySelector('h5'); if (heading) heading.textContent = name;
        const emailEl = summary.querySelector('p'); if (emailEl) emailEl.textContent = email;
        const avatarEl = summary.querySelector('.rounded-circle.bg-primary'); if (avatarEl) avatarEl.textContent = avatar;
      }
    }
  }
  function bindProfileForm() {
    const form = document.getElementById('profileForm');
    if (!form || form.dataset.userProfileBound === '1') return;
    form.dataset.userProfileBound = '1';
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const fields = form.querySelectorAll('input, textarea');
      const user = readUser() || {};
      if (fields[0]) user.name = fields[0].value.trim();
      if (fields[1]) user.email = fields[1].value.trim();
      if (fields[2]) user.phone = fields[2].value.trim();
      saveUser(user);
      applyProfile();
      if (window.AutoCareApp && AutoCareApp.Toast) AutoCareApp.Toast.show('success', 'Profile Updated', 'Your profile details have been saved on this browser.');
    });
  }
  function init() { applyProfile(); bindProfileForm(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
