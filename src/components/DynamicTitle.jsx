'use client';

import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

/**
 * Atualiza o <title> da aba dinamicamente com o nome da empresa cadastrada.
 * Fallback: "Sistema PDV — SDO"
 */
export function DynamicTitle() {
  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];
  const nomeEmpresa = empresa[0]?.nome || '';

  useEffect(() => {
    document.title = nomeEmpresa
      ? `${nomeEmpresa} — Sistema PDV SDO`
      : 'Sistema PDV — SDO Seu Deposito Online';
  }, [nomeEmpresa]);

  return null; // Não renderiza nenhum elemento visual
}
