import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export const db = new Dexie('SDODatabase');

db.version(1).stores({
  empresa: 'id',
  clientes: 'id, nome, telefone',
  produtos: 'id, codigo, nome, categoria',
  vendas: 'id, cliente_id, data_venda',
  sync_queue: '++id, table, action, timestamp'
});

db.version(2).stores({
  empresa: 'id',
  clientes: 'id, nome, telefone',
  produtos: 'id, codigo, nome, categoria',
  vendas: 'id, cliente_id, data_venda',
  sync_queue: '++id, table, action, timestamp'
});

// ── v3: Adiciona tabela de usuários ──────────────────────────────────────────
db.version(3).stores({
  empresa: 'id',
  clientes: 'id, nome, telefone',
  produtos: 'id, codigo, nome, categoria',
  vendas: 'id, cliente_id, data_venda',
  sync_queue: '++id, table, action, timestamp',
  usuarios: 'id, login, role' // role: 'admin' | 'operador'
});

// Seed: cria o usuário master se não existir
db.on('ready', async () => {
  try {
    const existing = await db.usuarios.where('login').equals('master').first();
    if (!existing) {
      await db.usuarios.add({
        id: uuidv4(),
        nome: 'Administrador Master',
        login: 'master',
        senha: '123456', // Em produção real: usar hash. Aqui: simplicidade offline.
        role: 'admin',
        ativo: true,
        criado_em: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('Seed de usuário ignorado (DB pode estar inicializando):', e);
  }
});

export async function addToSyncQueue(table, action, data) {
  await db.sync_queue.add({ table, action, data, timestamp: new Date().getTime() });
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
export async function autenticarUsuario(login, senha) {
  const usuario = await db.usuarios.where('login').equals(login.toLowerCase().trim()).first();
  if (!usuario) return null;
  if (usuario.senha !== senha) return null;
  if (!usuario.ativo) return null;
  return usuario;
}

export const CATEGORIAS_DEPOSITO = [
  'Cervejas',
  'Refrigerantes',
  'Água Mineral',
  'Sucos',
  'Energéticos',
  'Destilados',
  'Vinhos',
  'Espumantes',
  'Whisky',
  'Vodka',
  'Licores',
  'Isotônicos',
  'Chás',
  'Gelo',
  'Descartáveis',
  'Petiscos e Snacks',
  'Cigarros',
  'Carvão e Acessórios',
  'Outros',
];
