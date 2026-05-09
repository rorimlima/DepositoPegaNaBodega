export default function manifest() {
  return {
    name: 'SDO — Seu Depósito Online',
    short_name: 'SDO PDV',
    description: 'Sistema de Gestão e PDV Offline-First para Depósitos de Bebidas. Funciona sem internet.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#020617',
    theme_color: '#020617',
    categories: ['business', 'finance', 'productivity'],
    prefer_related_applications: false,
    icons: [
      { src: '/icon-48.png',  sizes: '48x48',   type: 'image/png' },
      { src: '/icon-72.png',  sizes: '72x72',   type: 'image/png' },
      { src: '/icon-96.png',  sizes: '96x96',   type: 'image/png' },
      { src: '/icon-144.png', sizes: '144x144', type: 'image/png' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Abrir PDV',
        short_name: 'PDV',
        url: '/pdv',
        icons: [{ src: '/icon-96.png', sizes: '96x96' }],
      },
      {
        name: 'Ver Produtos',
        short_name: 'Produtos',
        url: '/produtos',
        icons: [{ src: '/icon-96.png', sizes: '96x96' }],
      },
      {
        name: 'Ver Vendas',
        short_name: 'Vendas',
        url: '/vendas',
        icons: [{ src: '/icon-96.png', sizes: '96x96' }],
      },
    ],
  };
}
