/**
 * Admin UPI reference review for the local demo.
 * Always verify the transaction in the bank/UPI app before approving.
 */
(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function render() {
    const tbody = document.getElementById('upi-payment-verification-body');
    if (!tbody || !window.AutoCareData) return;
    const invoices = AutoCareData.getInvoices().filter(i => i.paymentReference || i.status === 'Pending Verification');
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">No submitted UPI payment references yet.</td></tr>';
      return;
    }
    tbody.innerHTML = invoices.map(inv => {
      const pending = inv.status === 'Pending Verification';
      const actions = pending
        ? `<button class="btn btn-success btn-sm me-1" data-action="verify" data-id="${escapeHtml(inv.id)}">Verify & Mark Paid</button><button class="btn btn-outline-danger btn-sm" data-action="reject" data-id="${escapeHtml(inv.id)}">Reject</button>`
        : '<span class="text-muted small">No action needed</span>';
      return `<tr>
        <td class="font-monospace fw-semibold">${escapeHtml(inv.id)}</td>
        <td>${escapeHtml(inv.customerName)}</td>
        <td class="fw-bold">₹${Number(inv.total || 0).toLocaleString('en-IN')}</td>
        <td class="font-monospace">${escapeHtml(inv.paymentReference || '—')}</td>
        <td><span class="badge ${inv.status === 'Paid' ? 'bg-success' : pending ? 'bg-warning text-dark' : 'bg-secondary'}">${escapeHtml(inv.status)}</span></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    const tbody = document.getElementById('upi-payment-verification-body');
    const refresh = document.getElementById('refresh-upi-payments');
    if (refresh) refresh.addEventListener('click', render);
    if (tbody) tbody.addEventListener('click', function (event) {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'verify') {
        if (!window.confirm('Have you confirmed this exact amount and UTR in your bank/UPI app? Only approve after verification.')) return;
        AutoCareData.verifyInvoicePayment(id, true);
        if (window.AutoCareApp) AutoCareApp.Toast.show('success', 'Payment verified', id + ' marked as Paid in this browser demo.');
      } else if (btn.dataset.action === 'reject') {
        if (!window.confirm('Reject this payment reference and return invoice to Pending?')) return;
        AutoCareData.verifyInvoicePayment(id, false);
        if (window.AutoCareApp) AutoCareApp.Toast.show('info', 'Reference rejected', id + ' returned to Pending.');
      }
      render();
    });
  });
})();
