import { createClient } from "@/lib/supabase/server";
import type { Card, Category, Person, Transaction } from "@/types/database";
import { formatDate } from "@/lib/date";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

type SearchParams = {
  q?: string;
  person?: string;
  card?: string;
  min?: string;
  max?: string;
  cuotas?: string;
};

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: cards }, { data: people }, { data: categories }, { data: imports }] =
    await Promise.all([
      supabase.from("cards").select("*").order("name"),
      supabase.from("people").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("statement_imports")
        .select("*, cards(name)")
        .eq("status", "applied")
        .order("statement_month", { ascending: false }),
    ]);

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("status", "confirmed")
    .order("transaction_date", { ascending: false })
    .limit(500);

  if (params.q) {
    query = query.or(`description.ilike.%${params.q}%,raw_description.ilike.%${params.q}%`);
  }
  if (params.person) query = query.eq("person_id", params.person);
  if (params.card) query = query.eq("card_id", params.card);
  if (params.min) query = query.gte("amount", Number(params.min));
  if (params.max) query = query.lte("amount", Number(params.max));
  if (params.cuotas === "1") query = query.not("installment_total", "is", null);

  const { data: transactions } = await query;

  const cardsById = new Map(((cards as Card[] | null) ?? []).map((c) => [c.id, c]));
  const categoriesById = new Map(((categories as Category[] | null) ?? []).map((c) => [c.id, c]));
  const peopleList = (people as Person[] | null) ?? [];
  const cardsList = (cards as Card[] | null) ?? [];

  const hasFilters = params.q || params.person || params.card || params.min || params.max || params.cuotas;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Histórico</h1>
        <p className="text-sm text-neutral-500">Todos tus gastos confirmados, de cualquier mes.</p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
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
          <label className="text-xs font-medium text-neutral-600">Tarjeta</label>
          <select
            name="card"
            defaultValue={params.card ?? ""}
            className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {cardsList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
          <a href="/historial" className="text-xs text-neutral-500 hover:underline">
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
              <th className="px-4 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {((transactions as Transaction[] | null) ?? []).map((t) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-500">{formatDate(t.transaction_date)}</td>
                <td className="px-4 py-2 font-medium">
                  {t.description}
                  {t.installment_number && t.installment_total && (
                    <span className="ml-1 text-xs font-normal text-neutral-400">
                      {t.installment_number}/{t.installment_total}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {t.card_id ? (cardsById.get(t.card_id)?.name ?? "—") : "Otro gasto"}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {t.category_id ? (categoriesById.get(t.category_id)?.name ?? "—") : "—"}
                </td>
                <td className="px-4 py-2 text-right">{money(Number(t.amount))}</td>
              </tr>
            ))}
            {!transactions?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Resúmenes importados</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Mes</th>
                <th className="px-4 py-2">Tarjeta</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(
                (imports as { id: string; statement_month: string; cards: { name: string } | null }[] | null) ?? []
              ).map((imp) => (
                <tr key={imp.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 text-neutral-500">
                    {new Date(imp.statement_month).toLocaleDateString("es-AR", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="px-4 py-2">{imp.cards?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/api/statements/${imp.id}/download`}
                      target="_blank"
                      className="text-xs font-medium text-neutral-500 hover:underline"
                    >
                      Ver PDF
                    </a>
                  </td>
                </tr>
              ))}
              {!imports?.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                    Todavía no importaste ningún resumen.
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
