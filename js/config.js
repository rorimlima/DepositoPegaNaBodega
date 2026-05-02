export const CONFIG = {
  SYNC_INTERVAL: 30000,        // Delta sync polling interval (30s)
  REALTIME_DEBOUNCE: 500,      // Debounce realtime events (ms)
  RETRY_BASE_DELAY: 1000,      // Exponential backoff base delay
  RETRY_MAX_DELAY: 60000,      // Max backoff delay (60s)
  RETRY_MAX_ATTEMPTS: 10,      // Max retry attempts per operation
  DB_NAME: 'pegabodega_db',
  DB_VERSION: 2,               // Bumped for new stores
  TABLES: ['empresa', 'clientes', 'produtos', 'vendas', 'itens_venda', 'pagamentos_venda'],
  FORMAS_PAGAMENTO: ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Fiado'],
  CATEGORIAS: ['Cerveja', 'Refrigerante', 'Água', 'Suco', 'Destilado', 'Vinho', 'Energético', 'Outros']
};
