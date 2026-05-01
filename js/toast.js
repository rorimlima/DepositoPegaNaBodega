export const Toast = {
  show(msg, type = 'info', dur = 3000) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };
    t.className = `toast ${type}`;
    t.innerHTML = `<span style="font-size:16px;font-weight:700">${icons[type]||'ℹ'}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, dur);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error', 4000); },
  warning(m) { this.show(m, 'warning'); },
  info(m) { this.show(m, 'info'); }
};
