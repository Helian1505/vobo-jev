/** Lector CSV mínimo (RFC 4180): comillas, comillas dobles escapadas, saltos de línea dentro de celdas, BOM. */
export function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  const src = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;

  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string;
    if (entreComillas) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      fila.push(celda);
      celda = "";
      filas.push(fila);
      fila = [];
    } else {
      celda += c;
    }
  }
  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

/** CSV con encabezado → lista de objetos columna → valor. Ignora filas vacías. */
export function parseCsvConEncabezado(texto: string): Record<string, string>[] {
  const [encabezado, ...resto] = parseCsv(texto);
  if (!encabezado) return [];
  return resto
    .filter((f) => !(f.length === 1 && f[0] === ""))
    .map((f) => Object.fromEntries(encabezado.map((col, i) => [col, f[i] ?? ""])));
}
