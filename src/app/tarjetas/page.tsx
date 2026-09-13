import { createClient } from "@/lib/supabase/server";
import type { Card } from "@/types/database";
import { createCard, deleteCard } from "./actions";

export default async function TarjetasPage() {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Tarjetas</h1>
        <p className="text-sm text-neutral-500">
          Tus tarjetas de crédito. El día de cierre se usa para calcular a qué mes pertenece cada gasto.
        </p>
      </div>

      <form
        action={createCard}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Nombre</label>
          <input
            name="name"
            required
            placeholder="BNA+"
            className="w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Banco</label>
          <input
            name="bank"
            placeholder="Banco Nación"
            className="w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Día de cierre</label>
          <input
            name="closing_day"
            type="number"
            min={1}
            max={31}
            className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Día de vencimiento</label>
          <input
            name="due_day"
            type="number"
            min={1}
            max={31}
            className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
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
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Banco</th>
              <th className="px-4 py-2">Cierre</th>
              <th className="px-4 py-2">Vencimiento</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(cards as Card[] | null)?.map((card) => (
              <tr key={card.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium">{card.name}</td>
                <td className="px-4 py-2 text-neutral-500">{card.bank ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{card.closing_day ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{card.due_day ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteCard}>
                    <input type="hidden" name="id" value={card.id} />
                    <button className="text-xs font-medium text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!cards?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  Todavía no cargaste tarjetas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
