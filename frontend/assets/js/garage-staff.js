(function () {
  'use strict';
  const API = new URL('../../../backend/api/garage_staff.php', document.currentScript.src).href;
  const $ = id => document.getElementById(id);
  let staff = [];
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function request(method, body) {
    const response = await fetch(API, { method, credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'Request failed. Check database connection.');
    return data;
  }
  function message(text, type='success') { const el=$('staff-form-message'); if(el){el.className='small mt-3 text-'+(type==='success'?'success':'danger');el.textContent=text;} }
  function resetForm() { $('garage-staff-form').reset(); $('staff-id').value=''; $('staff-form-title').textContent='Add New Staff Member'; $('save-staff-btn').innerHTML='<i class="fa-solid fa-floppy-disk me-2"></i>Save Staff Member'; message(''); }
  function openForm(row) {
    $('staff-form-section').hidden=false;
    if(row){ $('staff-id').value=row.id; $('staff-name').value=row.full_name; $('staff-email').value=row.email; $('staff-phone').value=row.phone; $('staff-designation').value=row.designation; $('staff-status').value=row.status; $('staff-form-title').textContent='Edit Staff Member'; $('save-staff-btn').innerHTML='<i class="fa-solid fa-check me-2"></i>Update Staff Member'; }
    else resetForm();
    $('staff-form-section').scrollIntoView({behavior:'smooth',block:'start'}); $('staff-name').focus();
  }
  function render() {
    const q=($('staff-search').value||'').trim().toLowerCase();
    const filtered=staff.filter(s=>[s.full_name,s.email,s.phone,s.designation,s.status].some(v=>String(v||'').toLowerCase().includes(q)));
    $('staff-count').textContent=staff.length;
    $('garage-staff-tbody').innerHTML=filtered.length?filtered.map(s=>{
      const initials=String(s.full_name||'S').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
      const date=s.created_at?new Date(String(s.created_at).replace(' ','T')).toLocaleDateString('en-IN'):'—';
      return `<tr><td><div class="d-flex align-items-center"><span class="staff-avatar">${escapeHtml(initials)}</span><span class="fw-semibold">${escapeHtml(s.full_name)}</span></div></td><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.phone)}</td><td>${escapeHtml(s.designation)}</td><td><span class="badge ${s.status==='Active'?'bg-success-subtle text-success':'bg-secondary-subtle text-secondary'}">${escapeHtml(s.status)}</span></td><td>${escapeHtml(date)}</td><td><div class="d-flex gap-1"><button class="btn btn-outline-primary btn-sm" data-edit="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="btn btn-outline-danger btn-sm" data-delete="${s.id}" title="Delete"><i class="fa-solid fa-trash"></i></button></div></td></tr>`;
    }).join(''):'<tr><td colspan="7" class="text-center text-muted py-4">'+(staff.length?'No matching staff members.':'No staff members added yet. Click “Add Staff Member” to begin.')+'</td></tr>';
  }
  async function load() { $('garage-staff-tbody').innerHTML='<tr><td colspan="7" class="text-center text-muted py-4">Loading staff members...</td></tr>'; try { const data=await request('GET'); staff=data.staff||[]; render(); } catch(e) { $('garage-staff-tbody').innerHTML=`<tr><td colspan="7" class="text-center text-danger py-4">${escapeHtml(e.message)}</td></tr>`; } }
  document.addEventListener('DOMContentLoaded',()=>{
    try { const auth=JSON.parse(localStorage.getItem('AUTOCARE_AUTH_USER_V1')||'null'); if(auth && auth.role==='garage'){ $('garage-sidebar-name').textContent=auth.name||'Garage Owner'; $('garage-sidebar-role').textContent=auth.garageName||'Workshop Owner'; $('staff-garage-name').textContent=auth.garageName||'Your Workshop'; } } catch(_){}
    $('show-staff-form').addEventListener('click',()=>openForm()); $('cancel-staff-form').addEventListener('click',()=>{$('staff-form-section').hidden=true;resetForm();}); $('reset-staff-form').addEventListener('click',resetForm); $('staff-search').addEventListener('input',render);
    $('garage-staff-form').addEventListener('submit',async e=>{e.preventDefault(); const btn=$('save-staff-btn'); btn.disabled=true; try { const payload={id:$('staff-id').value||null,full_name:$('staff-name').value.trim(),email:$('staff-email').value.trim(),phone:$('staff-phone').value.trim(),designation:$('staff-designation').value,status:$('staff-status').value}; const result=await request('POST',payload); message(result.message); await load(); resetForm(); $('staff-form-section').hidden=true; } catch(err){message(err.message,'error');} finally{btn.disabled=false;} });
    $('garage-staff-tbody').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]'); const del=e.target.closest('[data-delete]'); if(edit){const row=staff.find(x=>String(x.id)===edit.dataset.edit);if(row)openForm(row);} if(del){const row=staff.find(x=>String(x.id)===del.dataset.delete);if(!row)return;if(!confirm(`Delete ${row.full_name} from your staff list?`))return;try{await request('DELETE',{id:Number(row.id)});await load();}catch(err){alert(err.message);}} });
    load();
  });
})();