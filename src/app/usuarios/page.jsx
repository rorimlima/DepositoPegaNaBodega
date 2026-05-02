'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/lib/AuthContext';
import { UserCog, Plus, Edit, Trash2, ShieldCheck, User, Eye, EyeOff, X, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function UsuariosPage() {
  const { isAdmin } = useAuth();
  const usuarios = useLiveQuery(() => db?.usuarios?.toArray() || [], []) || [];

  const [nome,     setNome]     = useState('');
  const [login,    setLogin]    = useState('');
  const [senha,    setSenha]    = useState('');
  const [role,     setRole]     = useState('operador');
  const [ativo,    setAtivo]    = useState(true);
  const [editId,   setEditId]   = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [erro,     setErro]     = useState('');

  if (!isAdmin) {
    return <div className="p-8 text-center text-slate-500">Acesso restrito a administradores.</div>;
  }

  const resetForm = () => {
    setNome(''); setLogin(''); setSenha(''); setRole('operador'); setAtivo(true);
    setEditId(null); setFormOpen(false); setErro('');
  };

  const startEdit = (u) => {
    setEditId(u.id); setNome(u.nome); setLogin(u.login);
    setSenha(u.senha); setRole(u.role); setAtivo(u.ativo !== false);
    setFormOpen(true); setErro('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!nome || !login || !senha) return setErro('Preencha todos os campos obrigatórios.');

    const loginLower = login.toLowerCase().trim();

    // Verificar login duplicado
    const existing = await db.usuarios.where('login').equals(loginLower).first();
    if (existing && existing.id !== editId) {
      return setErro('Já existe um usuário com esse login.');
    }

    if (editId) {
      await db.usuarios.update(editId, { nome, login: loginLower, senha, role, ativo });
    } else {
      await db.usuarios.add({
        id: uuidv4(), nome, login: loginLower, senha, role, ativo,
        criado_em: new Date().toISOString(),
      });
    }
    resetForm();
  };

  const handleToggleAtivo = async (u) => {
    if (u.login === 'master') return alert('O usuário master não pode ser desativado.');
    await db.usuarios.update(u.id, { ativo: !u.ativo });
  };

  const handleDelete = async (u) => {
    if (u.login === 'master') return alert('O usuário master não pode ser excluído.');
    if (!confirm(`Excluir o usuário "${u.nome}"?`)) return;
    await db.usuarios.delete(u.id);
  };

  const FormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Nome Completo *</label>
        <Input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: João Operador"
          className="bg-slate-900 border-slate-800 h-12" />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Login * (sem espaços)</label>
        <Input value={login} onChange={e => setLogin(e.target.value.replace(/\s/g,''))} required placeholder="joao.operador"
          autoCapitalize="none" className="bg-slate-900 border-slate-800 h-12" />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Senha *</label>
        <div className="relative">
          <Input value={senha} onChange={e => setSenha(e.target.value)} required placeholder="••••••••"
            type={showPass ? 'text' : 'password'} className="bg-slate-900 border-slate-800 h-12 pr-12" />
          <button type="button" onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Perfil de Acesso</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: 'admin',    label: 'Administrador', icon: ShieldCheck, desc: 'Acesso total' },
            { val: 'operador', label: 'Operador',      icon: User,        desc: 'Somente PDV' },
          ].map(({ val, label, icon: Icon, desc }) => (
            <button key={val} type="button" onClick={() => setRole(val)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${role === val ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-700'}`}
            >
              <Icon size={20} />
              <span className="text-xs font-bold">{label}</span>
              <span className="text-[10px] opacity-70">{desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setAtivo(v => !v)}
          className={`w-11 h-6 rounded-full transition-all relative ${ativo ? 'bg-blue-600' : 'bg-slate-700'}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ativo ? 'left-5' : 'left-0.5'}`} />
        </button>
        <span className="text-sm text-slate-400">{ativo ? 'Usuário ativo' : 'Usuário inativo'}</span>
      </div>
      {erro && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{erro}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 active:bg-blue-700 transition-all">
          {editId ? <><Save size={16} /> Salvar</> : <><Plus size={16} /> Cadastrar</>}
        </button>
        <button type="button" onClick={resetForm} className="w-12 h-12 rounded-xl border border-slate-800 text-slate-500 flex items-center justify-center">
          <X size={16} />
        </button>
      </div>
    </form>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={20} className="text-blue-500" />
          <h1 className="text-xl font-bold text-blue-500">Usuários</h1>
        </div>
        <button
          onClick={() => { resetForm(); setFormOpen(true); }}
          className="md:hidden flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl active:bg-blue-700"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Desktop: form lateral */}
        <div className="hidden lg:block w-[340px] shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-slate-800">
              <h2 className="font-bold text-slate-100">{editId ? '✏️ Editar Usuário' : '👤 Novo Usuário'}</h2>
            </div>
            <FormContent />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {usuarios.map(u => (
              <div key={u.id} className={`bg-slate-950 border rounded-2xl p-4 transition-colors ${u.ativo !== false ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${u.role === 'admin' ? 'bg-blue-500/15' : 'bg-slate-800'}`}>
                    {u.role === 'admin' ? <ShieldCheck size={20} className="text-blue-400" /> : <User size={20} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-100 truncate">{u.nome}</h3>
                    <p className="text-xs text-slate-500">@{u.login}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                        {u.role === 'admin' ? '🛡️ Admin' : '👤 Operador'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.ativo !== false ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {u.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-1">
                    <button onClick={() => startEdit(u)} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 active:bg-slate-700">
                      <Edit size={13} />
                    </button>
                    <button onClick={() => handleToggleAtivo(u)} className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${u.ativo !== false ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}`}>
                      {u.ativo !== false ? '⏸' : '▶'}
                    </button>
                    <button onClick={() => handleDelete(u)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {formOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
          <div className="w-full bg-slate-950 border-t border-slate-800 rounded-t-3xl overflow-hidden relative" style={{ maxHeight: '95dvh' }}>
            <div className="w-10 h-1 bg-slate-700 rounded-full absolute left-1/2 -translate-x-1/2 top-3" />
            <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-slate-800">
              <h2 className="font-bold text-slate-100">{editId ? '✏️ Editar Usuário' : '👤 Novo Usuário'}</h2>
              <button onClick={resetForm} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(95dvh - 64px)' }}>
              <FormContent />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
