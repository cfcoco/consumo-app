import { createClient } from "@/lib/supabase/server";
import type { Card, InstallmentSeries, Person, Transaction } from "@/types/database";
import { formatMonthLabel } from "@/lib/date";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function monthLabel(month: string) {
  return formatMonthLabel(month, { month: "short", year: "2-digit" });
}

export default async function CuotasPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: series }, { data: cards }, { data: people }, { data: futureTx }] =
    await Promise.all([
      supabase.from("installment_series").select("*").order("start_month", { ascending: false }),
      supabase.from("cards").select("*"),
      supabase.from("people").select("*"),
      supabase
        .from("transactions")
        .select("*")
        .eq("status", "projected")
        .gte("transaction_date", today)
        .order("statement_month", { ascending: true }),
    ]);

  const cardsById = new Map(((cards as Card[] | null) ?? []).map((c) => [c.id, c]));
  const peopleById = new Map(((people as Person[] | null) ?? []).map((p) => [p.id, p]));

  const remainingBySeries = new Map<string, number>();
  for (const t of (futureTx as Transaction[] | null) ?? []) {
    if (!t.series_id) continue;
    remainingBySeries.set(t.series_id, (remainingBySeries.get(t.series_id) ?? 0) + 1);
  }

  const byMonth = new Map<string, number>();
  for (const t of (futureTx as Transaction[] | null) ?? []) {
    const key = t.statement_month.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount));
  }
  const months = Array.from(byMonth.keys()).sort();

  const activeSeries = ((series as InstallmentSeries[] | null) ?? []).filter(
    (s) => (remainingBySeries.get(s.id) ?? 0) > 0,
  );
  const installmentSeries = activeSeries.filter((s) => !s.is_fixed);
  const fixedSeries = activeSeries.filter((s) => s.is_fixed);
  const fixedMonthlyTotal = fixedSeries.reduce((sum, s) => sum + Number(s.installment_amount), 0);

  const ownerLabel = (s: InstallmentSeries) =>
    s.owner_type === "mine"
      ? "Mío"
      : s.owner_type === "shared"
        ? "Compartido"
        : (peopleById.get(s.person_id ?? "")?.name ?? "Persona");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Cuotas</h1>
        <p className="text-sm text-neutral-500">
          Compras en cuotas activas y cuánto vas a necesitar en los próximos meses.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Proyección de próximos meses</h2>
        {months.length ? (
          <div className="flex flex-wrap gap-4">
            {months.map((m) => (
              <div key={m} className="min-w-[100px]">
                <p className="text-xs uppercase text-neutral-400">{monthLabel(m)}</p>
                <p className="text-base font-semibold">{money(byMonth.get(m) ?? 0)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">No hay cuotas pendientes a futuro.</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Compras en cuotas</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Tarjeta</th>
              <th className="px-4 py-2">De quién</th>
              <th className="px-4 py-2 text-right">Monto/cuota</th>
              <th className="px-4 py-2 text-right">Restantes</th>
              <th className="px-4 py-2 text-right">Total restante</th>
            </tr>
          </thead>
          <tbody>
            {installmentSeries.map((s) => {
              const remaining = remainingBySeries.get(s.id) ?? 0;
              return (
                <tr key={s.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-medium">{s.description}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {s.card_id ? (cardsById.get(s.card_id)?.name ?? "—") : "Otro gasto"}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{ownerLabel(s)}</td>
                  <td className="px-4 py-2 text-right">{money(Number(s.installment_amount))}</td>
                  <td className="px-4 py-2 text-right">
                    {remaining}/{s.total_installments}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {money(remaining * Number(s.installment_amount))}
                  </td>
                </tr>
              );
            })}
            {!installmentSeries.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  No tenés compras en cuotas activas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Gastos fijos</h2>
          {!!fixedSeries.length && (
            <p className="text-sm text-neutral-500">
              {money(fixedMonthlyTotal)} por mes
            </p>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2">Tarjeta</th>
                <th className="px-4 py-2">De quién</th>
                <th className="px-4 py-2 text-right">Monto mensual</th>
                <th className="px-4 py-2 text-right">Proyectado hasta</th>
              </tr>
            </thead>
            <tbody>
              {fixedSeries.map((s) => {
                const remaining = remainingBySeries.get(s.id) ?? 0;
                return (
                  <tr key={s.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 font-medium">{s.description}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {s.card_id ? (cardsById.get(s.card_id)?.name ?? "—") : "Otro gasto"}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{ownerLabel(s)}</td>
                    <td className="px-4 py-2 text-right">{money(Number(s.installment_amount))}</td>
                    <td className="px-4 py-2 text-right text-neutral-500">
                      {remaining} mes{remaining !== 1 ? "es" : ""} más
                    </td>
                  </tr>
                );
              })}
              {!fixedSeries.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                    No tenés gastos fijos cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
