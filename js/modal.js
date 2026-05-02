export const Modal = {
  open(title, bodyHTML, footerHTML = '', sizeClass = '') {
    const c = document.getElementById('modal-container');
    c.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal ${sizeClass}"><div class="modal-header"><h3 class="modal-title">${title}</h3><button class="modal-close" id="modal-close-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="modal-body">${bodyHTML}</div>${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}</div></div>`;
    document.getElementById('modal-close-btn').onclick = () => this.close();
    document.getElementById('modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') this.close(); });
  },
  close() { document.getElementById('modal-container').innerHTML = ''; }
};
