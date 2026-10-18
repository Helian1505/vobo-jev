import type { CSSProperties } from "react";

/*
 * Figuras pequeñas detrás de todo el contenido, moviéndose muy despacio (40–80 s por ciclo) y casi transparentes.
 * Son decoración: no reciben clics y los lectores de pantalla las ignoran. Con «reducir movimiento» se quedan quietas.
 */
type Forma = "anillo" | "cruz" | "cuadro" | "punto" | "triangulo";

const FIGURAS: { forma: Forma; x: string; y: string; t: number; dur: number; retraso: number; tipo: "a" | "b"; lima?: boolean }[] = [
  { forma: "anillo", x: "6%", y: "18%", t: 18, dur: 64, retraso: -8, tipo: "a" },
  { forma: "cruz", x: "18%", y: "72%", t: 14, dur: 52, retraso: -20, tipo: "b" },
  { forma: "cuadro", x: "31%", y: "34%", t: 12, dur: 70, retraso: -35, tipo: "a" },
  { forma: "punto", x: "44%", y: "86%", t: 6, dur: 46, retraso: -12, tipo: "b", lima: true },
  { forma: "triangulo", x: "57%", y: "12%", t: 16, dur: 78, retraso: -40, tipo: "b" },
  { forma: "anillo", x: "68%", y: "58%", t: 10, dur: 58, retraso: -5, tipo: "a", lima: true },
  { forma: "cruz", x: "82%", y: "24%", t: 12, dur: 66, retraso: -28, tipo: "a" },
  { forma: "cuadro", x: "91%", y: "78%", t: 14, dur: 74, retraso: -50, tipo: "b" },
  { forma: "punto", x: "12%", y: "46%", t: 5, dur: 40, retraso: -18, tipo: "a" },
  { forma: "triangulo", x: "76%", y: "92%", t: 12, dur: 62, retraso: -9, tipo: "a" },
];

function Figura({ forma }: { forma: Forma }) {
  switch (forma) {
    case "anillo":
      return <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />;
    case "cruz":
      return <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />;
    case "cuadro":
      return <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />;
    case "punto":
      return <circle cx="12" cy="12" r="6" fill="currentColor" />;
    case "triangulo":
      return <path d="M12 4l8 15H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />;
  }
}

export function FondoFiguras() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {FIGURAS.map((f, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={f.t * 1.6}
          height={f.t * 1.6}
          className={`absolute ${f.tipo === "a" ? "figura-a" : "figura-b"} ${f.lima ? "text-accent opacity-[0.12]" : "text-fg-faint opacity-[0.16]"}`}
          style={{ left: f.x, top: f.y, "--duracion": `${f.dur}s`, animationDelay: `${f.retraso}s` } as CSSProperties}
        >
          <Figura forma={f.forma} />
        </svg>
      ))}
    </div>
  );
}
