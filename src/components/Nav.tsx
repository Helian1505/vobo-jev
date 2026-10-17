"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCola } from "@/lib/vobo/use-cola";

const ENLACES = [
  { href: "/", texto: "Demo" },
  { href: "/simulacion", texto: "Simulación" },
  { href: "/cola", texto: "Cola" },
  { href: "/resultados", texto: "Resultados" },
];

export function Nav() {
  const ruta = usePathname();
  const pendientes = useCola().filter((i) => i.estado === "pendiente").length;
  return (
    <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
      {ENLACES.map((e) => {
        const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${activo ? "bg-raised font-medium text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            {e.texto}
            {e.href === "/cola" && pendientes > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-on-accent">
                {pendientes}
                <span className="sr-only"> pendientes</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
