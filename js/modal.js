// ========== Modal System ==========
const Modal = {
  open(title, bodyHTML, footerHTML = '') {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="Modal.close()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body">${bodyHTML}</div>
          ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
        </div>
      </div>`;
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') Modal.close();
    });
  },
  close() {
    document.getElementById('modal-container').innerHTML = '';
  }
};
