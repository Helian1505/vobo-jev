import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoBo — el visto bueno antes de que un agente actúe",
  description:
    "Compuerta de políticas para agentes internos de 30X, construida con JEV (TypeSafe).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
          <main className="flex-1 py-10">{children}</main>
          <footer className="border-t border-slate-200 py-4 text-xs text-slate-600">
            Acciones de prueba sintéticas. Perfiles: muestra anónima compartida por 30X para el
            reto. Política de demostración (supuestos), no es la política real de 30X.
          </footer>
        </div>
      </body>
    </html>
  );
}
