import { createClient } from "@/lib/supabase/server";
import type { Income } from "@/types/database";
import { formatDate } from "@/lib/date";
import { createIncome, deleteIncome } from "./actions";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export default async function IngresosPage() {
  const supabase = await createClient();
  const { data: incomes } = await supabase
    .from("incomes")
    .select("*")
    .order("income_date", { ascending: false });

  const total = ((incomes as Income[] | null) ?? []).reduce(
    (sum, i) => sum + Number(i.amount),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Ingresos</h1>
        <p className="text-sm text-neutral-500">Sueldos y otros ingresos.</p>
      </div>

      <form
        action={createIncome}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Descripción</label>
          <input
            name="description"
            required
            placeholder="Sueldo"
            className="w-48 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Monto</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Fecha</label>
          <input
            name="income_date"
            type="date"
            required
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Tipo</label>
          <input
            name="income_type"
            placeholder="sueldo, cobro..."
            className="w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white"
        >
          Agregar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {((incomes as Income[] | null) ?? []).map((income) => (
              <tr key={income.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-500">
                  {formatDate(income.income_date)}
                </td>
                <td className="px-4 py-2 font-medium">{income.description}</td>
                <td className="px-4 py-2 text-neutral-500">{income.income_type ?? "—"}</td>
                <td className="px-4 py-2 text-right">{money(Number(income.amount))}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteIncome}>
                    <input type="hidden" name="id" value={income.id} />
                    <button className="text-xs font-medium text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!incomes?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  Todavía no cargaste ingresos.
                </td>
              </tr>
            )}
          </tbody>
          {!!incomes?.length && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-medium">
                <td className="px-4 py-2" colSpan={3}>
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
