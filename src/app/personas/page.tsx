import { createClient } from "@/lib/supabase/server";
import type { Card, Person, Receivable, ReceivableCharge, Transaction } from "@/types/database";
import { formatDate } from "@/lib/date";
import {
  createPerson,
  deleteCharge,
  deletePerson,
  linkTransactionToPerson,
  settleCharge,
  settleChargesAhead,
  settleReceivable,
} from "./actions";
import { ChargeAmount } from "./ChargeAmount";
import { ChargeNote } from "./ChargeNote";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function firstOfCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthsAgo(count: number) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - count, 1));
  return d.toISOString().slice(0, 10);
}

export default async function PersonasPage() {
  const supabase = await createClient();
  const currentMonth = firstOfCurrentMonth();

  const [{ data: people }, { data: charges }, { data: cards }, { data: allReceivables }] =
    await Promise.all([
      supabase.from("people").select("*").order("created_at", { ascending: true }),
      supabase
        .from("receivable_charges")
        .select("*")
        .eq("status", "pending")
        .order("due_month", { ascending: true }),
      supabase.from("cards").select("*"),
      supabase.from("receivables").select("*"),
    ]);

  const receivablesById = new Map(
    ((allReceivables as Receivable[] | null) ?? []).map((r) => [r.id, r]),
  );
  const cardsById = new Map(((cards as Card[] | null) ?? []).map((c) => [c.id, c]));

  const sourceTxIds = ((allReceivables as Receivable[] | null) ?? [])
    .map((r) => r.source_transaction_id)
    .filter((id): id is string => Boolean(id));

  const { data: sourceTransactions } = sourceTxIds.length
    ? await supabase.from("transactions").select("*").in("id", sourceTxIds)
    : { data: [] as Transaction[] };

  const transactionsById = new Map(
    ((sourceTransactions as Transaction[] | null) ?? []).map((t) => [t.id, t]),
  );

  // Consumos propios de los últimos meses que todavía no están vinculados a
  // nadie: son los candidatos para asignarle a una persona.
  const { data: recentMine } = await supabase
    .from("transactions")
    .select("*")
    .eq("owner_type", "mine")
    .gte("transaction_date", monthsAgo(3))
    .order("transaction_date", { ascending: false })
    .limit(100);

  const linkedTxIds = new Set(sourceTxIds);
  const linkableTransactions = ((recentMine as Transaction[] | null) ?? []).filter(
    (t) => !linkedTxIds.has(t.id),
  );

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
            <details
              key={person.id}
              open={items.length > 0}
              className="group rounded-lg border border-neutral-200 bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">
                    <span className="mr-1 inline-block text-neutral-400 group-open:rotate-90">
                      ›
                    </span>
                    {person.name}
                  </p>
                  <p className="pl-4 text-xs text-neutral-500">
                    {items.length} cuota{items.length !== 1 ? "s" : ""} pendiente
                    {items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold">{money(total)}</span>
              </summary>

              <div className="flex items-center justify-end gap-3 border-b border-neutral-100 px-4 pb-3">
                <a
                  href={`/api/personas/${person.id}/pdf`}
                  className="text-xs font-medium text-neutral-500 hover:underline"
                >
                  Exportar PDF
                </a>
                <form action={deletePerson}>
                  <input type="hidden" name="id" value={person.id} />
                  <button className="text-xs font-medium text-red-600 hover:underline">
                    Eliminar persona
                  </button>
                </form>
              </div>

              {Array.from(byReceivable.entries()).map(([receivableId, receivableCharges]) => {
                const receivable = receivablesById.get(receivableId);
                const sourceTx = receivable?.source_transaction_id
                  ? transactionsById.get(receivable.source_transaction_id)
                  : undefined;
                const sourceCard = sourceTx?.card_id ? cardsById.get(sourceTx.card_id) : undefined;

                // La cuota "de este mes": la que vence en el mes corriente, o
                // si no hay, la más próxima; si todas quedaron atrás, la más vieja.
                const current =
                  receivableCharges.find((c) => c.due_month === currentMonth) ??
                  receivableCharges.find((c) => c.due_month > currentMonth) ??
                  receivableCharges[0];
                const isOverdue = current.due_month < currentMonth;

                return (
                  <div key={receivableId} className="border-b border-neutral-100 last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-50 px-4 py-1.5">
                      <div>
                        <p className="text-xs font-medium text-neutral-600">
                          {receivableCharges[0].description}
                        </p>
                        {sourceTx && (
                          <p className="text-xs text-neutral-400">
                            {sourceCard?.name ?? "Otro gasto"} · {formatDate(sourceTx.transaction_date)}{" "}
                            · {money(Number(sourceTx.amount))}
                            {sourceTx.is_fixed
                              ? " · fijo mensual"
                              : sourceTx.installment_number && sourceTx.installment_total
                                ? ` · cuota ${sourceTx.installment_number}/${sourceTx.installment_total} en la tarjeta`
                                : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <form action={settleChargesAhead} className="flex items-center gap-1">
                          <input type="hidden" name="receivable_id" value={receivableId} />
                          <input
                            name="count"
                            type="number"
                            min={1}
                            max={receivableCharges.length}
                            defaultValue={1}
                            className="w-14 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs"
                          />
                          <button className="text-xs font-medium text-neutral-600 hover:underline">
                            Adelantar cuotas
                          </button>
                        </form>
                        <form action={settleReceivable}>
                          <input type="hidden" name="receivable_id" value={receivableId} />
                          <button className="text-xs font-medium text-emerald-700 hover:underline">
                            Marcar todo cobrado
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-2 text-sm">
                      <div>
                        <p>
                          Cuota {current.installment_number} de {current.installment_total}
                          {isOverdue && (
                            <span className="ml-1 rounded bg-red-50 px-1 text-xs text-red-600">
                              atrasada
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {formatDate(current.due_month)} · quedan {receivableCharges.length} cuota
                          {receivableCharges.length !== 1 ? "s" : ""} por cobrar
                        </p>
                        <ChargeNote id={current.id} note={current.note} />
                      </div>
                      <div className="flex items-center gap-3">
                        <ChargeAmount id={current.id} amount={Number(current.amount)} />
                        <form action={settleCharge}>
                          <input type="hidden" name="id" value={current.id} />
                          <button className="text-xs font-medium text-neutral-500 hover:underline">
                            Marcar cobrado
                          </button>
                        </form>
                        <form action={deleteCharge}>
                          <input type="hidden" name="id" value={current.id} />
                          <button className="text-xs font-medium text-red-600 hover:underline">
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </div>

                    {receivableCharges.length > 1 && (
                      <details className="px-4 pb-2">
                        <summary className="cursor-pointer text-xs text-neutral-500 hover:underline">
                          Ver las {receivableCharges.length} cuotas
                        </summary>
                        <ul className="mt-1 divide-y divide-neutral-100 border-t border-neutral-100">
                          {receivableCharges.map((c) => (
                            <li
                              key={c.id}
                              className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm"
                            >
                              <div>
                                <p>
                                  Cuota {c.installment_number}/{c.installment_total}
                                </p>
                                <p className="text-xs text-neutral-400">{formatDate(c.due_month)}</p>
                                <ChargeNote id={c.id} note={c.note} />
                              </div>
                              <div className="flex items-center gap-3">
                                <ChargeAmount id={c.id} amount={Number(c.amount)} />
                                <form action={settleCharge}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <button className="text-xs font-medium text-neutral-500 hover:underline">
                                    Marcar cobrado
                                  </button>
                                </form>
                                <form action={deleteCharge}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <button className="text-xs font-medium text-red-600 hover:underline">
                                    Eliminar
                                  </button>
                                </form>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}

              <details className="border-t border-neutral-100 px-4 py-2">
                <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:underline">
                  Vincular un consumo de la tarjeta
                </summary>
                {linkableTransactions.length ? (
                  <form
                    action={linkTransactionToPerson}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="person_id" value={person.id} />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-neutral-600">Consumo</label>
                      <select
                        name="transaction_id"
                        required
                        className="w-72 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                      >
                        {linkableTransactions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {formatDate(t.transaction_date)} · {t.description}
                            {t.is_fixed
                              ? " (fijo)"
                              : t.installment_number && t.installment_total
                                ? ` (${t.installment_number}/${t.installment_total})`
                                : ""}{" "}
                            · {t.card_id ? (cardsById.get(t.card_id)?.name ?? "Tarjeta") : "Otro gasto"}{" "}
                            · {money(Number(t.amount))}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-neutral-600">
                        Monto a cobrarle
                      </label>
                      <input
                        name="charge_amount"
                        type="number"
                        step="0.01"
                        placeholder="Todo"
                        className="w-28 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-neutral-600">Cuotas</label>
                      <input
                        name="charge_installments"
                        type="number"
                        min={1}
                        defaultValue={1}
                        className="w-20 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
                      Vincular
                    </button>
                  </form>
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">
                    No hay consumos propios sin asignar en los últimos 3 meses.
                  </p>
                )}
              </details>
            </details>
          );
        })}
        {!people?.length && (
          <p className="text-center text-sm text-neutral-400">Todavía no cargaste personas.</p>
        )}
      </div>
    </div>
  );
}
