import { createClient } from "@/lib/supabase/server";
import { confirmImport } from "../actions";
import type { ReconciledCharge } from "@/lib/statements/reconcile";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

const KIND_LABEL: Record<string, { label: string; color: string }> = {
  new: { label: "Nuevo", color: "text-emerald-700" },
  advance: { label: "Cuota que avanzó", color: "text-amber-700" },
  exists: { label: "Ya existe", color: "text-neutral-400" },
};

export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: importRow } = await supabase
    .from("statement_imports")
    .select("*, cards(name)")
    .eq("id", id)
    .single();

  if (!importRow) {
    return <p className="text-sm text-neutral-500">No se encontró la importación.</p>;
  }

  const result = importRow.parsed_result as {
    charges: ReconciledCharge[];
    nextClosingDay: number | null;
    nextDueDay: number | null;
  };

  const counts = { new: 0, advance: 0, exists: 0 };
  for (const c of result.charges) counts[c.kind]++;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">
          Revisión — {(importRow.cards as { name: string } | null)?.name}
        </h1>
        <p className="text-sm text-neutral-500">
          {counts.new} nuevos, {counts.advance} cuotas que avanzaron, {counts.exists} ya cargados.
          Desmarcá lo que no quieras importar y confirmá.
        </p>
        {(result.nextClosingDay || result.nextDueDay) && (
          <p className="text-xs text-neutral-500">
            Al confirmar se actualiza el día de cierre/vencimiento de la tarjeta a{" "}
            {result.nextClosingDay ?? "—"} / {result.nextDueDay ?? "—"}.
          </p>
        )}
      </div>

      <form action={confirmImport} className="space-y-4">
        <input type="hidden" name="import_id" value={importRow.id} />

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2" />
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2">Cuota</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {result.charges.map((c, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      name="include"
                      value={i}
                      defaultChecked={c.kind !== "exists"}
                    />
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{c.date}</td>
                  <td className="px-4 py-2">{c.rawDescription}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {c.installmentNumber ? `${c.installmentNumber}/${c.installmentTotal}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{money(c.amountArs)}</td>
                  <td className={`px-4 py-2 text-xs font-medium ${KIND_LABEL[c.kind].color}`}>
                    {KIND_LABEL[c.kind].label}
                  </td>
                </tr>
              ))}
              {!result.charges.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                    No se detectaron gastos en este PDF.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Confirmar importación
        </button>
      </form>
    </div>
  );
}
