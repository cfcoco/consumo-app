import { createClient } from "@/lib/supabase/server";
import type { Card, Category, Income, Person, Transaction } from "@/types/database";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function monthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const statementMonth = currentMonth();

  const [{ data: transactions }, { data: incomes }, { data: cards }, { data: categories }, { data: debts }] =
    await Promise.all([
      supabase.from("transactions").select("*").eq("statement_month", statementMonth),
      supabase
        .from("incomes")
        .select("*")
        .gte("income_date", monthStart())
        .lte("income_date", monthEnd()),
      supabase.from("cards").select("*"),
      supabase.from("categories").select("*"),
      supabase.from("transactions").select("*").eq("owner_type", "person").eq("is_settled", false),
    ]);

  const txs = (transactions as Transaction[] | null) ?? [];
  const cardsById = new Map(((cards as Card[] | null) ?? []).map((c) => [c.id, c]));
  const categoriesById = new Map(((categories as Category[] | null) ?? []).map((c) => [c.id, c]));

  const totalSpent = txs.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalIncome = ((incomes as Income[] | null) ?? []).reduce(
    (sum, i) => sum + Number(i.amount),
    0,
  );
  const totalOwedToMe = ((debts as Transaction[] | null) ?? []).reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );

  const byCard = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (const t of txs) {
    const cardLabel = t.card_id ? (cardsById.get(t.card_id)?.name ?? "Otra") : "Otros gastos";
    byCard.set(cardLabel, (byCard.get(cardLabel) ?? 0) + Number(t.amount));

    const catLabel = t.category_id ? (categoriesById.get(t.category_id)?.name ?? "Sin categoría") : "Sin categoría";
    byCategory.set(catLabel, (byCategory.get(catLabel) ?? 0) + Number(t.amount));
  }

  const monthName = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Resumen</h1>
        <p className="text-sm capitalize text-neutral-500">{monthName}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase text-neutral-400">Gastado</p>
          <p className="text-xl font-semibold">{money(totalSpent)}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase text-neutral-400">Ingresos</p>
          <p className="text-xl font-semibold">{money(totalIncome)}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase text-neutral-400">Disponible</p>
          <p className={`text-xl font-semibold ${totalIncome - totalSpent < 0 ? "text-red-600" : ""}`}>
            {money(totalIncome - totalSpent)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase text-neutral-400">Me deben</p>
          <p className="text-xl font-semibold">{money(totalOwedToMe)}</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Por tarjeta</h2>
          <ul className="space-y-2">
            {Array.from(byCard.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([label, amount]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{label}</span>
                  <span className="font-medium">{money(amount)}</span>
                </li>
              ))}
            {!byCard.size && <p className="text-sm text-neutral-400">Sin gastos este mes.</p>}
          </ul>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Por categoría</h2>
          <ul className="space-y-2">
            {Array.from(byCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([label, amount]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{label}</span>
                  <span className="font-medium">{money(amount)}</span>
                </li>
              ))}
            {!byCategory.size && <p className="text-sm text-neutral-400">Sin gastos este mes.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
