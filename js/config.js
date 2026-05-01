// ========== CONFIG ==========
const CONFIG = {
  SUPABASE_URL: 'https://bodnmvheuayaruvjjsyq.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvZG5tdmhldWF5YXJ1dmpqc3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTU0NzUsImV4cCI6MjA5MzIzMTQ3NX0._9qcnuU1peElcFpJ_0B51eS9l6-jexTLZgaAtZ2DD14',
  SYNC_INTERVAL: 30000, // 30 seconds
  DB_NAME: 'pegabodega_db',
  DB_VERSION: 1,
  TABLES: ['empresa', 'clientes', 'produtos', 'vendas', 'itens_venda', 'pagamentos_venda'],
  FORMAS_PAGAMENTO: ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Fiado'],
  CATEGORIAS: ['Cerveja', 'Refrigerante', 'Água', 'Suco', 'Destilado', 'Vinho', 'Energético', 'Outros']
};
