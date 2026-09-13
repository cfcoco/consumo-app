import { createClient } from "@/lib/supabase/server";
import type { Person, Transaction } from "@/types/database";
import { createPerson, deletePerson, settleTransaction } from "./actions";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export default async function PersonasPage() {
  const supabase = await createClient();

  const [{ data: people }, { data: debts }] = await Promise.all([
    supabase.from("people").select("*").order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("*")
      .eq("owner_type", "person")
      .eq("is_settled", false)
      .order("transaction_date", { ascending: true }),
  ]);

  const debtsByPerson = new Map<string, Transaction[]>();
  for (const t of (debts as Transaction[] | null) ?? []) {
    if (!t.person_id) continue;
    const list = debtsByPerson.get(t.person_id) ?? [];
    list.push(t);
    debtsByPerson.set(t.person_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Personas</h1>
        <p className="text-sm text-neutral-500">
          Familiares o terceros a quienes les prestás la tarjeta o compartís un gasto. Acá ves cuánto te debe cada uno.
        </p>
      </div>

      <form
        action={createPerson}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Nombre</label>
          <input
            name="name"
            required
            placeholder="Mika"
            className="w-48 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white"
        >
          Agregar
        </button>
      </form>

      <div className="space-y-4">
        {(people as Person[] | null)?.map((person) => {
          const items = debtsByPerson.get(person.id) ?? [];
          const total = items.reduce((sum, t) => sum + Number(t.amount), 0);

          return (
            <div key={person.id} className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <div>
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs text-neutral-500">
                    {items.length} pendiente{items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{money(total)}</span>
                  <form action={deletePerson}>
                    <input type="hidden" name="id" value={person.id} />
                    <button className="text-xs font-medium text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
              {items.length > 0 && (
                <ul className="divide-y divide-neutral-100">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div>
                        <p>{t.description}</p>
                        <p className="text-xs text-neutral-400">
                          {new Date(t.transaction_date).toLocaleDateString("es-AR")}
                          {t.installment_number && t.installment_total
                            ? ` · cuota ${t.installment_number}/${t.installment_total}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{money(Number(t.amount))}</span>
                        <form action={settleTransaction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="text-xs font-medium text-neutral-500 hover:underline">
                            Marcar cobrado
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {!people?.length && (
          <p className="text-center text-sm text-neutral-400">Todavía no cargaste personas.</p>
        )}
      </div>
    </div>
  );
}
