// Parsers de resúmenes de tarjeta (PDF -> líneas de gasto + fechas de
// cierre/vencimiento). Derivados de resúmenes reales de BNA+, Bancor y BBVA.

export interface ParsedCharge {
  date: string; // YYYY-MM-DD
  rawDescription: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
  amountArs: number;
}

export interface ParsedStatement {
  charges: ParsedCharge[];
  nextClosingDay: number | null;
  nextDueDay: number | null;
}

const MONTHS: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

function twoDigitYear(yy: string) {
  const n = Number(yy);
  return n <= 79 ? 2000 + n : 1900 + n;
}

function parseAmount(raw: string): number {
  // "163.848,23" -> 163848.23 ; también soporta "163848,23-" (negativo)
  const negative = raw.trim().endsWith("-");
  const clean = raw.replace(/-$/, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return negative ? -n : n;
}

export async function extractPdfText(bytes: Uint8Array, password?: string): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    password: password || undefined,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  const lines: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    // Agrupa items por posición vertical (Y), tolerando pequeñas diferencias
    // de baseline dentro de una misma fila visual (ej. tablas en BBVA donde
    // la fecha y el resto del renglón no comparten exactamente el mismo Y).
    const items = (content.items as { str: string; transform: number[] }[])
      .map((item) => ({ x: item.transform[4], y: item.transform[5], str: item.str }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const Y_TOLERANCE = 2.5;
    const rows: { y: number; x: number; str: string }[][] = [];
    for (const item of items) {
      const lastRow = rows[rows.length - 1];
      if (lastRow && Math.abs(lastRow[0].y - item.y) <= Y_TOLERANCE) {
        lastRow.push(item);
      } else {
        rows.push([item]);
      }
    }

    for (const row of rows) {
      const line = row
        .sort((a, b) => a.x - b.x)
        .map((r) => r.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

// BNA+ y Bancor comparten el mismo layout de banco emisor:
// DD.MM.YY <comprobante>[*]  DESCRIPCION [Cuota|C.] NN/NN  monto[,dd]  [monto_usd]
export function parseBnaBancor(lines: string[]): ParsedStatement {
  const charges: ParsedCharge[] = [];
  const lineRegex =
    /^(\d{2})\.(\d{2})\.(\d{2})\s+(?:\d+\*?\s+)?(.+?)(?:\s+(?:Cuota|C\.)\s*(\d{1,2})\s*\/\s*(\d{1,2}))?\s+(-?[\d.]+,\d{2}-?)(?:\s+(-?[\d.]+,\d{2}))?$/;

  for (const line of lines) {
    if (/SALDO ANTERIOR|SU PAGO EN PESOS|IMPUESTO|INTERES|COMISI[ÓO]N|IVA|PUNIT|DB\.|IIBB/i.test(line)) {
      continue;
    }
    const m = line.match(lineRegex);
    if (!m) continue;

    const [, dd, mm, yy, description, instN, instT, amountStr] = m;
    const year = twoDigitYear(yy);
    charges.push({
      date: `${year}-${mm}-${dd}`,
      rawDescription: description.trim(),
      installmentNumber: instN ? Number(instN) : null,
      installmentTotal: instT ? Number(instT) : null,
      amountArs: parseAmount(amountStr),
    });
  }

  let nextClosingDay: number | null = null;
  let nextDueDay: number | null = null;
  for (const line of lines) {
    const closing = line.match(/PROXIMO CIERRE\s+(\d{2})\s+([A-Za-z]{3})/i);
    if (closing) nextClosingDay = Number(closing[1]);
    const due = line.match(/PROXIMO VTO\.?\s+(\d{2})\s+([A-Za-z]{3})/i);
    if (due) nextDueDay = Number(due[1]);
  }

  return { charges, nextClosingDay, nextDueDay };
}

// BBVA (Visa y Mastercard comparten formato):
// DD-Mon-YY  DESCRIPCION [C.NN/NN]  cupon  monto  [monto_usd]
export function parseBbva(lines: string[]): ParsedStatement {
  const charges: ParsedCharge[] = [];
  const monthPattern = Object.keys(MONTHS).join("|");
  const lineRegex = new RegExp(
    `^(\\d{2})-(${monthPattern})-(\\d{2})\\s+(.+?)(?:\\s+C\\.(\\d{1,2})\\/(\\d{1,2}))?\\s+(\\d+)\\s+(-?[\\d.]+,\\d{2})(?:\\s+(-?[\\d.]+,\\d{2}))?$`,
    "i",
  );

  for (const line of lines) {
    if (/SALDO ANTERIOR|SU PAGO EN PESOS|IMPUESTO|COMISI[ÓO]N|DB IVA|TOTAL CONSUMOS/i.test(line)) {
      continue;
    }
    const m = line.match(lineRegex);
    if (!m) continue;

    const [, dd, monName, yy, description, instN, instT, , amountStr] = m;
    const year = twoDigitYear(yy);
    const month = MONTHS[monName.toLowerCase()];
    charges.push({
      date: `${year}-${String(month).padStart(2, "0")}-${dd}`,
      rawDescription: description.trim(),
      installmentNumber: instN ? Number(instN) : null,
      installmentTotal: instT ? Number(instT) : null,
      amountArs: parseAmount(amountStr),
    });
  }

  let nextClosingDay: number | null = null;
  let nextDueDay: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (/PR[ÓO]XIMO CIERRE/i.test(lines[i]) && /PR[ÓO]XIMO VENCIMIENTO/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const dates = Array.from(lines[j].matchAll(/(\d{2})-([A-Za-z]{3})-(\d{2})/g));
        if (dates.length >= 4) {
          nextClosingDay = Number(dates[2][1]);
          nextDueDay = Number(dates[3][1]);
          break;
        }
      }
    }
  }

  return { charges, nextClosingDay, nextDueDay };
}

// Naranja X: DD/MM/YY <Naranja X|NX Visa> <cupon> DESCRIPCION [NN/NN|Zeta|Deb.Aut.|01] monto
export function parseNaranja(lines: string[]): ParsedStatement {
  const charges: ParsedCharge[] = [];
  const lineRegex =
    /^(\d{2})\/(\d{2})\/(\d{2})\s+(?:Naranja X|NX Visa)\s+\S+\s+(.+?)\s+(?:(\d{1,2})\/(\d{1,2})|Zeta|Deb\.Aut\.|01)\s+([\d.]+,\d{2})(?:\s+[\d.]+,\d{2})?$/;

  for (const line of lines) {
    if (/^\*|INTERES|COMISI[ÓO]N|IVA|PERCEP/i.test(line)) continue;
    const m = line.match(lineRegex);
    if (!m) continue;

    const [, dd, mm, yy, description, instN, instT, amountStr] = m;
    const year = twoDigitYear(yy);
    charges.push({
      date: `${year}-${mm}-${dd}`,
      rawDescription: description.trim(),
      installmentNumber: instN ? Number(instN) : null,
      installmentTotal: instT ? Number(instT) : null,
      amountArs: parseAmount(amountStr),
    });
  }

  let nextClosingDay: number | null = null;
  let nextDueDay: number | null = null;
  for (const line of lines) {
    const closing = line.match(/pr[óo]ximo resumen cierra el (\d{2})\/(\d{2})/i);
    if (closing) nextClosingDay = Number(closing[1]);
    const due = line.match(/\bvence el (\d{2})\/(\d{2})/i);
    if (due) nextDueDay = Number(due[1]);
  }

  return { charges, nextClosingDay, nextDueDay };
}

export function parseStatement(
  format: "bna_bancor" | "bbva" | "naranja",
  lines: string[],
): ParsedStatement {
  if (format === "bbva") return parseBbva(lines);
  if (format === "naranja") return parseNaranja(lines);
  return parseBnaBancor(lines);
}
