import { Outfit } from "next/font/google";
import "./globals.css";
import { Sidebar, BottomNav, RouteGuard } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { ClientProviders } from "@/components/ClientProviders";

const outfit = Outfit({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: {
    default: 'SDO — Seu Depósito Online',
    template: '%s — SDO',
  },
  description: 'Sistema de Gestão e PDV Offline-First para Depósito de Bebidas. Funciona sem internet.',
  applicationName: 'SDO PDV',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SDO PDV',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'SDO — Seu Depósito Online',
    description: 'Sistema de Gestão e PDV Offline-First para Depósito de Bebidas',
    siteName: 'SDO',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="dns-prefetch" href="https://bodnmvheuayaruvjjsyq.supabase.co" />
        <link rel="preconnect" href="https://bodnmvheuayaruvjjsyq.supabase.co" crossOrigin="anonymous" />
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className={`${outfit.className} bg-slate-950 dark:bg-slate-950 text-slate-900 dark:text-slate-100`}>
        <ClientProviders>
          <div className="flex h-[100dvh] w-full overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 bg-slate-100/50 dark:bg-slate-900/30">
                <RouteGuard>
                  <div className="animate-page-enter">
                    {children}
                  </div>
                </RouteGuard>
              </main>
            </div>
            <BottomNav />
          </div>
        </ClientProviders>

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    reg.addEventListener('updatefound', function() {
                      var newWorker = reg.installing;
                      if (newWorker) {
                        newWorker.addEventListener('statechange', function() {
                          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                            window.dispatchEvent(new CustomEvent('sw-updated'));
                          }
                        });
                      }
                    });
                  }).catch(function(err) {
                    console.warn('[SW] Registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
