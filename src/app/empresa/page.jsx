'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function EmpresaPage() {
  const empresas = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];
  
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [logoBase64, setLogoBase64] = useState('');

  useEffect(() => {
    if (empresas.length > 0) {
      const emp = empresas[0];
      setNome(emp.nome || '');
      setCnpj(emp.cnpj || '');
      setTelefone(emp.telefone || '');
      setEndereco(emp.endereco || '');
      setLogoBase64(emp.logoBase64 || '');
    }
  }, [empresas]);

  const handleSave = async (e) => {
    e.preventDefault();
    const id = empresas.length > 0 ? empresas[0].id : uuidv4();
    const emp = {
      id,
      nome,
      cnpj,
      telefone,
      endereco,
      logoBase64
    };

    await db.empresa.put(emp);
    // Usually company settings are updated, so we use upsert in backend, which translates to INSERT or UPDATE action
    await addToSyncQueue('empresa', 'UPDATE', emp);
    alert('Salvo com sucesso!');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Store className="text-amber-500 w-8 h-8" />
        <h1 className="text-2xl font-bold text-amber-500">Minha Empresa</h1>
      </div>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Dados do Estabelecimento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-20 w-20 bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-800">
                {logoBase64 ? (
                  <img src={logoBase64} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store size={32} className="text-zinc-700" />
                )}
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Logo da Empresa</label>
                <Input type="file" accept="image/*" onChange={handleLogoUpload} className="bg-zinc-900 border-zinc-800 cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Razão Social / Nome</label>
                <Input placeholder="Nome da Bodega" value={nome} onChange={e => setNome(e.target.value)} required className="bg-zinc-900 border-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">CNPJ</label>
                <Input placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} className="bg-zinc-900 border-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Telefone</label>
                <Input placeholder="(00) 00000-0000" value={telefone} onChange={e => setTelefone(e.target.value)} className="bg-zinc-900 border-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Endereço Completo</label>
                <Input placeholder="Rua X, Bairro Y" value={endereco} onChange={e => setEndereco(e.target.value)} className="bg-zinc-900 border-zinc-800" />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold">
                <Save className="mr-2 h-4 w-4" /> Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
