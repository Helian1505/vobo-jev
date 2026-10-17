"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", texto: "Demo" },
  { href: "/resultados", texto: "Resultados" },
];

export function Nav() {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="flex items-center gap-1">
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
          </Link>
        );
      })}
    </nav>
  );
}
