import { createClient } from "@/lib/supabase/server";
import type { Card, Category, Person, Transaction } from "@/types/database";
import { formatDate, formatMonthLabel } from "@/lib/date";
import { GastoForm } from "./GastoForm";
import { TransactionActions } from "./TransactionActions";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type SearchParams = {
  month?: string;
  q?: string;
  person?: string;
  min?: string;
  max?: string;
  cuotas?: string;
};

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonth();
  const statementMonth = `${month}-01`;

  const supabase = await createClient();

  const [{ data: cards }, { data: people }, { data: categories }] = await Promise.all([
    supabase.from("cards").select("*").order("name"),
    supabase.from("people").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("statement_month", statementMonth)
    .order("transaction_date", { ascending: false });

  if (params.q) {
    query = query.or(`description.ilike.%${params.q}%,raw_description.ilike.%${params.q}%`);
  }
  if (params.person) {
    query = query.eq("person_id", params.person);
  }
  if (params.min) {
    query = query.gte("amount", Number(params.min));
  }
  if (params.max) {
    query = query.lte("amount", Number(params.max));
  }
  if (params.cuotas === "1") {
    query = query.not("installment_total", "is", null);
  }

  const { data: transactions } = await query;
  const txIds = ((transactions as Transaction[] | null) ?? []).map((t) => t.id);

  const { data: sharedReceivables } = txIds.length
    ? await supabase
        .from("receivables")
        .select("source_transaction_id, person_id")
        .in("source_transaction_id", txIds)
    : { data: [] as { source_transaction_id: string; person_id: string }[] };

  const sharedByTransaction = new Map<string, string[]>();
  for (const r of (sharedReceivables as { source_transaction_id: string; person_id: string }[]) ?? []) {
    const list = sharedByTransaction.get(r.source_transaction_id) ?? [];
    list.push(r.person_id);
    sharedByTransaction.set(r.source_transaction_id, list);
  }

  const cardsById = new Map(((cards as Card[] | null) ?? []).map((c) => [c.id, c]));
  const categoriesById = new Map(((categories as Category[] | null) ?? []).map((c) => [c.id, c]));
  const peopleList = (people as Person[] | null) ?? [];
  const total = ((transactions as Transaction[] | null) ?? []).reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );

  const hasFilters = params.q || params.person || params.min || params.max || params.cuotas;
  const baseParams = new URLSearchParams();
  if (params.q) baseParams.set("q", params.q);
  if (params.person) baseParams.set("person", params.person);
  if (params.min) baseParams.set("min", params.min);
  if (params.max) baseParams.set("max", params.max);
  if (params.cuotas) baseParams.set("cuotas", params.cuotas);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Gastos</h1>
          <p className="text-sm text-neutral-500 capitalize">{formatMonthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a
            href={`/gastos?month=${shiftMonth(month, -1)}&${baseParams.toString()}`}
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
          >
            ← Anterior
          </a>
          <a
            href={`/gastos?month=${shiftMonth(month, 1)}&${baseParams.toString()}`}
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
          >
            Siguiente →
          </a>
        </div>
      </div>

      <GastoForm
        cards={(cards as Card[] | null) ?? []}
        people={peopleList}
        categoryNames={((categories as Category[] | null) ?? []).map((c) => c.name)}
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <input type="hidden" name="month" value={month} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Buscar</label>
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Descripción..."
            className="w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Persona</label>
          <select
            name="person"
            defaultValue={params.person ?? ""}
            className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {peopleList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Monto mín.</label>
          <input
            name="min"
            type="number"
            defaultValue={params.min}
            className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Monto máx.</label>
          <input
            name="max"
            type="number"
            defaultValue={params.max}
            className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs font-medium text-neutral-600">
          <input type="checkbox" name="cuotas" value="1" defaultChecked={params.cuotas === "1"} />
          Solo en cuotas
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Filtrar
        </button>
        {hasFilters && (
          <a href={`/gastos?month=${month}`} className="text-xs text-neutral-500 hover:underline">
            Limpiar filtros
          </a>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Tarjeta</th>
              <th className="px-4 py-2">Categoría</th>
              <th className="px-4 py-2">De quién</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {((transactions as Transaction[] | null) ?? []).map((t) => (
              <tr key={t.id} className="border-t border-neutral-100 align-top">
                <td className="px-4 py-2 text-neutral-500">{formatDate(t.transaction_date)}</td>
                <td className="px-4 py-2 font-medium">
                  {t.description}
                  {t.installment_number && t.installment_total && (
                    <span className="ml-1 text-xs font-normal text-neutral-400">
                      {t.installment_number}/{t.installment_total}
                    </span>
                  )}
                  {t.raw_description && (
                    <p className="text-xs font-normal text-neutral-400">{t.raw_description}</p>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {t.card_id ? (cardsById.get(t.card_id)?.name ?? "—") : "Otro gasto"}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {t.category_id ? (categoriesById.get(t.category_id)?.name ?? "—") : "—"}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {t.owner_type === "mine" ? "Mío" : t.owner_type === "shared" ? "Compartido" : "Persona"}
                </td>
                <td className="px-4 py-2 text-right">{money(Number(t.amount))}</td>
                <td className="px-4 py-2 text-right">
                  <TransactionActions
                    transaction={t}
                    people={peopleList}
                    sharedWith={sharedByTransaction.get(t.id) ?? []}
                  />
                </td>
              </tr>
            ))}
            {!transactions?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
                  Sin gastos para este filtro.
                </td>
              </tr>
            )}
          </tbody>
          {!!transactions?.length && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-medium">
                <td className="px-4 py-2" colSpan={5}>
                  Total
                </td>
                <td className="px-4 py-2 text-right">{money(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
