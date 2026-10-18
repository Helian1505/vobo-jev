import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { FondoFiguras } from "@/components/FondoFiguras";
import { ScrollArriba } from "@/components/ScrollArriba";
import { Nav } from "@/components/Nav";
import "./globals.css";

// Fuente auto-alojada (licencia OFL), así no depende de Google ni de la red al construir.
// Inter con eje de tamaño óptico: la variante grande equivale al Inter Display de 30x.com.
const inter = localFont({
  src: "./fonts/inter-latin-opsz-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VoBo — la puerta de salida de los agentes de 30X",
  description:
    "Cada acción que un agente de 30X quiere hacer hacia afuera pasa por VoBo: en milisegundos, reglas en código y JEV (TypeSafe) la revisan; lo seguro sale solo, lo dudoso llega a una persona con su porqué y lo indebido no sale.",
};

const REPO = "https://github.com/Helian1505/vobo-jev";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} data-scroll-behavior="smooth">
      <head>
        <noscript>
          <style>{`.revelar{opacity:1!important;transform:none!important;filter:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-screen">
        <ScrollArriba />
        <FondoFiguras />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
        >
          Saltar al contenido
        </a>

        <header className="nav-glass sticky top-0 z-40 border-b border-line">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link scroll={false} href="/" className="flex items-center gap-3" aria-label="VoBo, inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marca/logo.png" alt="VoBo" width={1200} height={303} className="h-7 w-auto" />
              <span className="hidden whitespace-nowrap text-sm text-fg-faint sm:inline">para 30X</span>
            </Link>
            <Nav />
          </div>
        </header>

        <div className="relative z-[1] mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1200px] flex-col px-4 sm:px-6">
          <main id="contenido" className="flex-1 py-8 sm:py-12">
            {children}
          </main>
          <footer className="mt-14 border-t border-line py-10 text-sm">
            <div className="grid gap-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marca/logo.png" alt="VoBo" width={1200} height={303} className="h-8 w-auto" />
                <p className="mt-2 max-w-md leading-relaxed text-fg-muted">
                  La puerta de salida de los agentes de 30X. Equipo VoBo · Reto JEV · Hackathon 30X, 16–18 oct 2026.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">Producto</p>
                <ul className="mt-3 space-y-2 text-fg-soft">
                  <li><Link scroll={false} className="hover:text-fg" href="/demo">Demo</Link></li>
                  <li><Link scroll={false} className="hover:text-fg" href="/simulacion">Simulación</Link></li>
                  <li><Link scroll={false} className="hover:text-fg" href="/cola">Cola de VoBo humano</Link></li>
                  <li><Link scroll={false} className="hover:text-fg" href="/resultados">Resultados del banco</Link></li>
                  <li><Link scroll={false} className="hover:text-fg" href="/integracion">Integración</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">Código</p>
                <ul className="mt-3 space-y-2 text-fg-soft">
                  <li><a className="hover:text-fg" href={REPO}>Repositorio</a></li>
                  <li><a className="hover:text-fg" href={`${REPO}/blob/main/docs/INTEGRACION.md`}>Cómo integrarlo</a></li>
                  <li><a className="hover:text-fg" href={`${REPO}/tree/main/integraciones/mcp`}>Puerta de salida MCP</a></li>
                </ul>
              </div>
            </div>
            <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-fg-faint">
              Acciones de prueba sintéticas. Perfiles: muestra de perfiles de ejemplo compartida para el reto (anónima, solo categorías).
              Política de demostración (supuestos), no es la política real de 30X.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
