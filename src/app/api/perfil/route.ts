import { NextResponse } from "next/server";
import { perfilPorId } from "@/lib/vobo/perfiles";

export const runtime = "nodejs";

/** GET /api/perfil?id=P-298 → la tarjeta del perfil (solo categorías de la muestra anónima de 30X). */
export function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const perfil = /^P-\d{1,5}$/.test(id) ? perfilPorId(id) : undefined;
  if (!perfil) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
  return NextResponse.json(perfil);
}
