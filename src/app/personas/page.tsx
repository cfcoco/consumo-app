import { createClient } from "@/lib/supabase/server";
import type { Person, ReceivableCharge } from "@/types/database";
import { formatDate } from "@/lib/date";
import { createPerson, deletePerson, settleCharge, settleReceivable } from "./actions";
import { ChargeAmount } from "./ChargeAmount";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export default async function PersonasPage() {
  const supabase = await createClient();

  const [{ data: people }, { data: charges }] = await Promise.all([
    supabase.from("people").select("*").order("created_at", { ascending: true }),
    supabase
      .from("receivable_charges")
      .select("*")
      .eq("status", "pending")
      .order("due_month", { ascending: true }),
  ]);

  const chargesByPerson = new Map<string, ReceivableCharge[]>();
  for (const c of (charges as ReceivableCharge[] | null) ?? []) {
    const list = chargesByPerson.get(c.person_id) ?? [];
    list.push(c);
    chargesByPerson.set(c.person_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Personas</h1>
        <p className="text-sm text-neutral-500">
          Familiares o terceros a quienes les prestás la tarjeta o compartís un gasto. Acá ves
          cuánto te debe cada uno, con su propio plan de cuotas (puede ser distinto al de la
          tarjeta).
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
          const items = chargesByPerson.get(person.id) ?? [];
          const total = items.reduce((sum, c) => sum + Number(c.amount), 0);

          const byReceivable = new Map<string, ReceivableCharge[]>();
          for (const c of items) {
            const list = byReceivable.get(c.receivable_id) ?? [];
            list.push(c);
            byReceivable.set(c.receivable_id, list);
          }

          return (
            <div key={person.id} className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <div>
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs text-neutral-500">
                    {items.length} cuota{items.length !== 1 ? "s" : ""} pendiente
                    {items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{money(total)}</span>
                  <a
                    href={`/api/personas/${person.id}/pdf`}
                    className="text-xs font-medium text-neutral-500 hover:underline"
                  >
                    Exportar PDF
                  </a>
                  <form action={deletePerson}>
                    <input type="hidden" name="id" value={person.id} />
                    <button className="text-xs font-medium text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
              {Array.from(byReceivable.entries()).map(([receivableId, receivableCharges]) => (
                <div key={receivableId} className="border-b border-neutral-100 last:border-b-0">
                  <div className="flex items-center justify-between bg-neutral-50 px-4 py-1.5">
                    <p className="text-xs font-medium text-neutral-500">
                      {receivableCharges[0].description}
                    </p>
                    <form action={settleReceivable}>
                      <input type="hidden" name="receivable_id" value={receivableId} />
                      <button className="text-xs font-medium text-emerald-700 hover:underline">
                        Marcar todo cobrado (canceló antes)
                      </button>
                    </form>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {receivableCharges.map((c) => (
                      <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <div>
                          <p>
                            Cuota {c.installment_number}/{c.installment_total}
                          </p>
                          <p className="text-xs text-neutral-400">{formatDate(c.due_month)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <ChargeAmount id={c.id} amount={Number(c.amount)} />
                          <form action={settleCharge}>
                            <input type="hidden" name="id" value={c.id} />
                            <button className="text-xs font-medium text-neutral-500 hover:underline">
                              Marcar cobrado
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
