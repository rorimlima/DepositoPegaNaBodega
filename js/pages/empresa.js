// ========== Empresa Page ==========
Router.register('empresa', async (container) => {
  const empresas = await DB.getAll('empresa');
  const e = empresas[0] || {};

  container.innerHTML = `<div class="page">
    <div class="card" style="max-width:600px">
      <div class="card-header"><h3 class="card-title">Dados da Empresa</h3></div>
      <div style="text-align:center;margin-bottom:20px">
        <div style="width:80px;height:80px;border-radius:var(--radius);background:var(--bg-input);display:flex;align-items:center;justify-content:center;margin:0 auto;overflow:hidden;border:2px dashed var(--border)">
          ${e.logo_url ? `<img src="${e.logo_url}" style="width:100%;height:100%;object-fit:cover">` : '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>'}
        </div>
        <label class="btn btn-secondary btn-sm" style="margin-top:8px;cursor:pointer">
          Upload Logo
          <input type="file" accept="image/*" id="logo-upload" style="display:none">
        </label>
      </div>
      <div class="form-group"><label class="form-label">Nome da Empresa</label><input class="form-input" id="f-emp-nome" value="${e.nome || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">CNPJ/CPF</label><input class="form-input" id="f-emp-cnpj" value="${e.cnpj_cpf || ''}"></div>
        <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="f-emp-tel" value="${e.telefone || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Endereço</label><textarea class="form-textarea" id="f-emp-end">${e.endereco || ''}</textarea></div>
      <button class="btn btn-primary btn-block" id="btn-save-emp">Salvar Dados</button>
    </div>
  </div>`;

  // Logo upload
  document.getElementById('logo-upload').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const fileName = `logo_${Date.now()}.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) {
        // Try to create bucket and retry
        Toast.info('Salvando logo localmente...');
        const reader = new FileReader();
        reader.onload = async (ev2) => {
          e.logo_url = ev2.target.result;
          await SyncEngine.update('empresa', { ...e, logo_url: e.logo_url });
          Router.navigate('empresa');
        };
        reader.readAsDataURL(file);
        return;
      }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      e.logo_url = urlData.publicUrl;
      await SyncEngine.update('empresa', { ...e, logo_url: e.logo_url });
      Toast.success('Logo atualizada!');
      Router.navigate('empresa');
    } catch (err) {
      // Fallback: save as base64
      const reader = new FileReader();
      reader.onload = async (ev2) => {
        e.logo_url = ev2.target.result;
        await SyncEngine.update('empresa', { ...e, logo_url: e.logo_url });
        Toast.success('Logo salva localmente!');
        Router.navigate('empresa');
      };
      reader.readAsDataURL(file);
    }
  });

  // Save
  document.getElementById('btn-save-emp').addEventListener('click', async () => {
    const data = {
      id: e.id || Store.generateId(),
      nome: document.getElementById('f-emp-nome').value.trim() || 'DepostitoPegaNaBodega',
      cnpj_cpf: document.getElementById('f-emp-cnpj').value.trim(),
      telefone: document.getElementById('f-emp-tel').value.trim(),
      endereco: document.getElementById('f-emp-end').value.trim(),
      logo_url: e.logo_url || null,
      created_at: e.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await SyncEngine.update('empresa', data);
    Toast.success('Dados da empresa salvos!');
  });
});
