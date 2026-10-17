import type { Metadata } from "next";
import { Cola } from "@/components/Cola";

export const metadata: Metadata = {
  title: "Cola de VoBo humano — VoBo",
  description: "Las acciones que quedaron en PEDIR VOBO esperan aquí a que una persona las apruebe o las rechace (demostración, estado solo en el navegador).",
};

export default function PaginaCola() {
  return <Cola />;
}
