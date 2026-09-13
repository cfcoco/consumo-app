import type { Transaction } from "@/types/database";
import type { ParsedCharge } from "./parse";

export type MatchKind = "new" | "advance" | "exists";

export interface ReconciledCharge extends ParsedCharge {
  kind: MatchKind;
  matchedTransactionId: string | null;
}

const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeDescription(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function amountsClose(existing: number, parsed: number): boolean {
  // El usuario suele redondear sus montos manuales hacia arriba.
  if (existing >= parsed && existing - parsed <= Math.max(parsed * 0.05, 50)) return true;
  return Math.abs(existing - parsed) <= Math.max(parsed * 0.02, 20);
}

function descriptionsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function reconcile(
  charges: ParsedCharge[],
  existingTransactions: Transaction[],
): ReconciledCharge[] {
  const used = new Set<string>();

  return charges.map((charge) => {
    const normalizedParsed = normalizeDescription(charge.rawDescription);
    const isInstallment = charge.installmentNumber != null && charge.installmentTotal != null;

    const candidates = existingTransactions.filter((t) => {
      if (used.has(t.id)) return false;
      const normalizedExisting = normalizeDescription(t.raw_description || t.description);
      if (!descriptionsMatch(normalizedExisting, normalizedParsed)) return false;

      if (isInstallment) {
        // Misma serie de cuotas: mismo total y mismo número de cuota.
        // El monto puede variar un poco (redondeo), así que no se exige acá.
        return (
          t.installment_total === charge.installmentTotal &&
          t.installment_number === charge.installmentNumber
        );
      }
      // Gasto sin cuotas: la descripción + el monto son la única pista.
      return t.installment_total == null && amountsClose(Number(t.amount), charge.amountArs);
    });

    if (!candidates.length) {
      return { ...charge, kind: "new", matchedTransactionId: null };
    }

    const confirmedMatch = candidates.find((t) => t.status === "confirmed");
    if (confirmedMatch) {
      used.add(confirmedMatch.id);
      return { ...charge, kind: "exists", matchedTransactionId: confirmedMatch.id };
    }

    const projectedMatch = candidates.find((t) => t.status === "projected");
    if (projectedMatch) {
      used.add(projectedMatch.id);
      return { ...charge, kind: "advance", matchedTransactionId: projectedMatch.id };
    }

    return { ...charge, kind: "new", matchedTransactionId: null };
  });
}
