"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCola } from "@/lib/vobo/use-cola";

interface Enlace {
  href: string;
  texto: string;
  /** Si el enlace apunta a una sección de la página de inicio, su id (para resaltarla al hacer scroll). */
  seccion?: string;
}

const ENLACES: Enlace[] = [
  { href: "/#como-funciona", texto: "Cómo funciona", seccion: "como-funciona" },
  { href: "/#demo", texto: "Demo", seccion: "demo" },
  { href: "/simulacion", texto: "Simulación" },
  { href: "/cola", texto: "Cola" },
  { href: "/resultados", texto: "Resultados" },
  { href: "/#integracion", texto: "Integración", seccion: "integracion" },
];

const SECCIONES = ENLACES.flatMap((e) => (e.seccion ? [e.seccion] : []));

/** Resalta la sección visible de la página de inicio mientras se hace scroll. */
function useSeccionVisible(activo: boolean): string {
  const [visible, setVisible] = useState("");
  useEffect(() => {
    if (!activo || typeof IntersectionObserver === "undefined") {
      setVisible("");
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) setVisible(entrada.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of SECCIONES) {
      const el = document.getElementById(id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, [activo]);
  return visible;
}

export function Nav() {
  const ruta = usePathname();
  const pendientes = useCola().filter((i) => i.estado === "pendiente").length;
  const [abierto, setAbierto] = useState(false);
  const enInicio = ruta === "/";
  const seccionVisible = useSeccionVisible(enInicio);

  // Al cambiar de página se cierra el menú móvil.
  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  const esActivo = (e: Enlace) => (e.seccion ? enInicio && seccionVisible === e.seccion : ruta.startsWith(e.href));

  const enlaces = (movil: boolean) =>
    ENLACES.map((e) => {
      const activo = esActivo(e);
      return (
        <Link
          key={e.href}
          href={e.href}
          onClick={() => setAbierto(false)}
          aria-current={activo ? "page" : undefined}
          className={
            movil
              ? `flex items-center justify-between rounded-field px-3 py-2.5 text-[15px] ${activo ? "bg-raised text-fg" : "text-fg-soft hover:bg-raised hover:text-fg"}`
              : `relative px-2.5 py-2 text-sm font-medium tracking-[-0.01em] transition-colors ${
                  activo ? "text-fg" : "text-fg-muted hover:text-fg"
                }`
          }
        >
          {e.texto}
          {e.href === "/cola" && pendientes > 0 && (
            <span className="tabular ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-on-accent">
              {pendientes}
              <span className="sr-only"> pendientes</span>
            </span>
          )}
          {!movil && activo && <span aria-hidden="true" className="absolute inset-x-2.5 -bottom-[13px] h-0.5 rounded-full bg-accent" />}
        </Link>
      );
    });

  return (
    <>
      <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
        {enlaces(false)}
      </nav>
      <div className="flex items-center gap-2">
        <Link
          href="/#demo"
          className="hidden rounded-field bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:brightness-105 sm:inline-block"
        >
          Probar la demo
        </Link>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-field border border-line text-fg-soft hover:border-line-strong hover:text-fg lg:hidden"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          aria-label={abierto ? "Cerrar el menú" : "Abrir el menú"}
          onClick={() => setAbierto((a) => !a)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            {abierto ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </>
            )}
          </svg>
        </button>
      </div>
      {abierto && (
        <nav
          id="menu-movil"
          aria-label="Principal (móvil)"
          className="nav-glass absolute inset-x-0 top-16 border-b border-line px-4 pb-4 pt-2 lg:hidden"
        >
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1">
            {enlaces(true)}
            <Link
              href="/#demo"
              onClick={() => setAbierto(false)}
              className="mt-2 rounded-field bg-accent px-4 py-2.5 text-center text-[15px] font-semibold text-on-accent sm:hidden"
            >
              Probar la demo
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}
