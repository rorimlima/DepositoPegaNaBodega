import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar, BottomNav } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { ClientProviders } from "@/components/ClientProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "PegaNaBodega PDV",
  description: "ERP e PDV Offline-First para Depósito de Bebidas",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 overflow-hidden`}>
        <ClientProviders>
          <div className="flex h-screen w-full">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <Header />
              <main className="flex-1 overflow-auto pb-16 md:pb-0 bg-zinc-900/50">
                {children}
              </main>
            </div>
            <BottomNav />
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
