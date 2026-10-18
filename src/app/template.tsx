/** Se vuelve a montar en cada cambio de página: así cada pestaña entra con el mismo difuminado suave. */
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="pagina-entra">{children}</div>;
}
