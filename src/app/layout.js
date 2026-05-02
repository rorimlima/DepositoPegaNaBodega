import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar, BottomNav, RouteGuard } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { ClientProviders } from "@/components/ClientProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "SDO Seu Deposito Online",
  description: "ERP e PDV Offline-First para Depósito de Bebidas",
  manifest: "/manifest.json",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#020617',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100`}>
        <ClientProviders>
          <div className="flex h-[100dvh] w-full overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 bg-slate-900/30">
                <RouteGuard>{children}</RouteGuard>
              </main>
            </div>
            <BottomNav />
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
