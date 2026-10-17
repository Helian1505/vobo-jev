import type { Metadata } from "next";
import localFont from "next/font/local";
import { Nav } from "@/components/Nav";
import "./globals.css";

// Fuentes auto-alojadas (licencia OFL), así no dependen de Google ni de la red al construir.
// Inter con eje de tamaño óptico (la variante grande equivale al Inter Display de 30x.com) y
// Playfair Display solo para el título de la página, como HackRadar.
const inter = localFont({
  src: "./fonts/inter-latin-opsz-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const playfair = localFont({
  src: "./fonts/playfair-display-latin-700-normal.woff2",
  variable: "--font-playfair",
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VoBo — el visto bueno antes de que un agente actúe",
  description:
    "Compuerta de políticas para agentes internos de 30X, construida con JEV (TypeSafe): permite, pide visto bueno humano o bloquea cada acción, con el porqué.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
        >
          Saltar al contenido
        </a>

        <div className="border-b border-line">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-xl font-bold tracking-tight text-fg">VoBo</span>
              <span className="hidden whitespace-nowrap text-sm text-fg-muted sm:inline">para 30X</span>
            </p>
            <div className="flex items-center gap-3">
              <Nav />
              <p className="hidden rounded-full border border-line px-3 py-1 text-xs text-fg-muted sm:block">Reto JEV · Hackathon 30X</p>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-[1200px] flex-col px-4 sm:px-6">
          <main id="contenido" className="flex-1 py-8 sm:py-12">
            {children}
          </main>
          <footer className="border-t border-line py-5 text-xs leading-relaxed text-fg-muted">
            Acciones de prueba sintéticas. Perfiles: muestra anónima compartida por 30X para el reto. Política de
            demostración (supuestos), no es la política real de 30X.
          </footer>
        </div>
      </body>
    </html>
  );
}
