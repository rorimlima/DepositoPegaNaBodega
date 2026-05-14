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

// ── v4: Adiciona tabela de comandas (mesas) + sync_meta ──────────────────────
// comandas: status 'aberta' | 'faturando' | 'concluida'
//   itens: array de { produto_id, nome, preco_centavos, qtde }
//   pagamentos: array de { metodo, valor (float R$), cliente_id? }
// sync_meta: armazena último timestamp de pull por tabela
db.version(4).stores({
  empresa: 'id',
  clientes: 'id, nome, telefone',
  produtos: 'id, codigo, nome, categoria',
  vendas: 'id, cliente_id, data_venda',
  sync_queue: '++id, table, action, timestamp',
  usuarios: 'id, login, role',
  comandas: 'id, mesa, status, aberta_em, concluida_em',
  sync_meta: 'table_name',
}).upgrade(tx => {
  // Adiciona updated_at em registros existentes que não tenham
  const now = new Date().toISOString();
  const tables = ['empresa', 'clientes', 'produtos', 'vendas', 'usuarios'];
  return Promise.all(tables.map(tableName =>
    tx.table(tableName).toCollection().modify(record => {
      if (!record.updated_at) {
        record.updated_at = now;
      }
    })
  ));
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
        updated_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('Seed de usuário ignorado (DB pode estar inicializando):', e);
  }
});

/**
 * Adiciona uma operação à fila de sincronização.
 * Automaticamente injeta updated_at nos dados.
 */
export async function addToSyncQueue(table, action, data) {
  const enriched = { ...data, updated_at: new Date().toISOString() };

  // Atualiza o registro local com updated_at também
  if (action !== 'DELETE' && db[table]) {
    try {
      await db[table].update(data.id, { updated_at: enriched.updated_at });
    } catch (_) {
      // ignora se o registro não existe localmente
    }
  }

  await db.sync_queue.add({
    table,
    action,
    data: enriched,
    timestamp: Date.now(),
    retries: 0,
  });
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
