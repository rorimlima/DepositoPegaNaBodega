import Dexie from 'dexie';

export const db = new Dexie('SDODatabase');

db.version(1).stores({
  empresa: 'id', // only one record usually
  clientes: 'id, nome, telefone', // id is string (UUID)
  produtos: 'id, codigo, nome, categoria', // preco_centavos, foto
  vendas: 'id, cliente_id, data_venda', 
  sync_queue: '++id, table, action, timestamp' // action: 'INSERT', 'UPDATE', 'DELETE'
});

db.version(2).stores({
  empresa: 'id',
  clientes: 'id, nome, telefone', // + endereco (not indexed)
  produtos: 'id, codigo, nome, categoria', // + quantidade, custo_centavos
  vendas: 'id, cliente_id, data_venda', 
  sync_queue: '++id, table, action, timestamp'
});

export async function addToSyncQueue(table, action, data) {
  await db.sync_queue.add({
    table,
    action,
    data,
    timestamp: new Date().getTime(),
  });
}

// Standard beverage depot categories
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
