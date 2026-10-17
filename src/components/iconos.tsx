import type { Decision } from "@/lib/vobo/types";

/** Íconos de trazo uniforme (2 px, extremos redondeados). Decorativos: el texto de al lado dice lo mismo. */
function Base({ children, tamano = 16 }: { children: React.ReactNode; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconoPermitir({ tamano }: { tamano?: number }) {
  return (
    <Base tamano={tamano}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Base>
  );
}

export function IconoVobo({ tamano }: { tamano?: number }) {
  return (
    <Base tamano={tamano}>
      <path d="M12 4.5v9" />
      <path d="M12 19.2v.01" />
    </Base>
  );
}

export function IconoBloquear({ tamano }: { tamano?: number }) {
  return (
    <Base tamano={tamano}>
      <path d="M6.5 6.5l11 11" />
      <path d="M17.5 6.5l-11 11" />
    </Base>
  );
}

export function IconoDecision({ decision, tamano }: { decision: Decision; tamano?: number }) {
  if (decision === "ALLOW") return <IconoPermitir tamano={tamano} />;
  if (decision === "REVIEW") return <IconoVobo tamano={tamano} />;
  return <IconoBloquear tamano={tamano} />;
}
