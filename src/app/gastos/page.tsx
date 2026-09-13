import { createClient } from "@/lib/supabase/server";
import type { Card, Category, Person, Transaction } from "@/types/database";
import { formatDate, formatMonthLabel } from "@/lib/date";
import { GastoForm } from "./GastoForm";
import { deleteTransaction } from "./actions";

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

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonth();
  const statementMonth = `${month}-01`;

  const supabase = await createClient();

  const [{ data: cards }, { data: people }, { data: categories }, { data: transactions }] =
    await Promise.all([
      supabase.from("cards").select("*").order("name"),
      supabase.from("people").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("transactions")
        .select("*")
        .eq("statement_month", statementMonth)
        .order("transaction_date", { ascending: false }),
    ]);

  const cardsById = new Map(((cards as Card[] | null) ?? []).map((c) => [c.id, c]));
  const categoriesById = new Map(((categories as Category[] | null) ?? []).map((c) => [c.id, c]));
  const total = ((transactions as Transaction[] | null) ?? []).reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Gastos</h1>
          <p className="text-sm text-neutral-500 capitalize">{formatMonthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a
            href={`/gastos?month=${shiftMonth(month, -1)}`}
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
          >
            ← Anterior
          </a>
          <a
            href={`/gastos?month=${shiftMonth(month, 1)}`}
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
          >
            Siguiente →
          </a>
        </div>
      </div>

      <GastoForm
        cards={(cards as Card[] | null) ?? []}
        people={(people as Person[] | null) ?? []}
        categoryNames={((categories as Category[] | null) ?? []).map((c) => c.name)}
      />

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
                <td className="px-4 py-2 text-neutral-500">
                  {t.owner_type === "mine" ? "Mío" : t.owner_type === "shared" ? "Compartido" : "Persona"}
                </td>
                <td className="px-4 py-2 text-right">{money(Number(t.amount))}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-xs font-medium text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!transactions?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
                  Sin gastos cargados este mes.
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
