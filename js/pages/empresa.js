import { DB } from '../db.js';
import { Store } from '../store.js';
import { Router } from '../router.js';
import { SyncEngine } from '../syncEngine.js';
import { Toast } from '../toast.js';
import { supabase } from '../supabaseClient.js';

Router.register('empresa', async (container) => {
  const empresas = await DB.getAll('empresa');
  const e = empresas[0] || {};
  container.innerHTML = `<div class="page"><div class="card" style="max-width:600px">
    <div class="card-header"><h3 class="card-title">Dados da Empresa</h3></div>
    <div style="text-align:center;margin-bottom:20px">
      <div style="width:80px;height:80px;border-radius:var(--radius);background:var(--bg-input);display:flex;align-items:center;justify-content:center;margin:0 auto;overflow:hidden;border:2px dashed var(--border)">${e.logo_url?`<img src="${e.logo_url}" style="width:100%;height:100%;object-fit:cover">`:'<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>'}</div>
      <label class="btn btn-secondary btn-sm" style="margin-top:8px;cursor:pointer">Upload Logo<input type="file" accept="image/*" id="logo-up" style="display:none"></label>
    </div>
    <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="fe-n" value="${e.nome||''}"></div>
    <div class="form-row"><div class="form-group"><label class="form-label">CNPJ/CPF</label><input class="form-input" id="fe-c" value="${e.cnpj_cpf||''}"></div><div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="fe-t" value="${e.telefone||''}"></div></div>
    <div class="form-group"><label class="form-label">Endereço</label><textarea class="form-textarea" id="fe-e">${e.endereco||''}</textarea></div>
    <button class="btn btn-primary btn-block" id="btn-save-emp">Salvar</button>
  </div></div>`;

  document.getElementById('logo-up').onchange = async (ev) => {
    const file = ev.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async (r) => { e.logo_url = r.target.result; await SyncEngine.update('empresa', {...e, logo_url:e.logo_url}); Toast.success('Logo salva!'); Router.navigate('empresa'); };
    reader.readAsDataURL(file);
  };

  document.getElementById('btn-save-emp').onclick = async () => {
    const d = { id:e.id||Store.generateId(), nome:document.getElementById('fe-n').value.trim()||'DepostitoPegaNaBodega', cnpj_cpf:document.getElementById('fe-c').value.trim(), telefone:document.getElementById('fe-t').value.trim(), endereco:document.getElementById('fe-e').value.trim(), logo_url:e.logo_url||null, created_at:e.created_at||new Date().toISOString(), updated_at:new Date().toISOString() };
    await SyncEngine.update('empresa',d); Toast.success('Dados salvos!');
  };
});
