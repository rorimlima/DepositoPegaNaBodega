'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Users, Package } from 'lucide-react';

export default function Dashboard() {
  const vendas = useLiveQuery(() => db?.vendas?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.count() || 0, []) || 0;
  const produtos = useLiveQuery(() => db?.produtos?.count() || 0, []) || 0;

  const totalFaturamento = vendas.reduce((acc, venda) => acc + venda.total_centavos, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-amber-500">Dashboard</h1>
        <p className="text-zinc-400">Resumo em tempo real (Offline-First)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Faturamento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">R$ {(totalFaturamento / 100).toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Vendas Realizadas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{vendas.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Clientes</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{clientes}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Produtos</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{produtos}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Últimas Vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vendas.slice(-5).reverse().map(v => (
              <div key={v.id} className="flex justify-between items-center border-b border-zinc-800 pb-2 last:border-0">
                <div>
                  <p className="font-medium text-zinc-200">Venda #{v.id.substring(0, 8)}</p>
                  <p className="text-xs text-zinc-500">{new Date(v.data_venda).toLocaleString()}</p>
                </div>
                <div className="font-bold text-amber-500">
                  R$ {(v.total_centavos / 100).toFixed(2)}
                </div>
              </div>
            ))}
            {vendas.length === 0 && <p className="text-zinc-500 text-sm">Nenhuma venda realizada.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
