"use client";

import { useState } from "react";
import type { Card, Person } from "@/types/database";
import { createTransaction } from "./actions";

export function GastoForm({
  cards,
  people,
  categoryNames,
}: {
  cards: Card[];
  people: Person[];
  categoryNames: string[];
}) {
  const [ownerType, setOwnerType] = useState<"mine" | "shared" | "person">("mine");
  const [isInstallment, setIsInstallment] = useState(false);
  const [amount, setAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState(2);

  return (
    <form
      action={async (formData) => {
        await createTransaction(formData);
        setIsInstallment(false);
        setOwnerType("mine");
        setAmount("");
        setTotalInstallments(2);
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Tarjeta</label>
        <select
          name="card_id"
          defaultValue=""
          className="w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Otro gasto</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Descripción (tu etiqueta)</label>
        <input
          name="description"
          required
          placeholder="Regalo cumple Mika"
          className="w-44 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Nombre real (opcional)</label>
        <input
          name="raw_description"
          placeholder="Como figura en la tarjeta"
          className="w-44 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">
          {isInstallment ? "Monto por cuota" : "Monto"}
        </label>
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Fecha</label>
        <input
          name="transaction_date"
          type="date"
          required
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Categoría</label>
        <input
          name="category"
          list="category-list"
          placeholder="Comida, streaming..."
          className="w-36 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <datalist id="category-list">
          {categoryNames.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">De quién</label>
        <select
          name="owner_type"
          value={ownerType}
          onChange={(e) => setOwnerType(e.target.value as typeof ownerType)}
          className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="mine">Mío</option>
          <option value="shared">Compartido</option>
          <option value="person">De alguien</option>
        </select>
      </div>

      {ownerType === "person" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Persona</label>
          <select
            name="person_id"
            required
            className="w-36 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {ownerType === "shared" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">
            Entre quiénes (se divide en partes iguales)
          </label>
          <div className="flex max-w-xs flex-wrap gap-2 rounded-md border border-neutral-300 px-2 py-1.5">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-1 text-xs">
                <input type="checkbox" name="shared_person_ids" value={p.id} />
                {p.name}
              </label>
            ))}
            {!people.length && (
              <span className="text-xs text-neutral-400">Cargá personas primero.</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pb-1.5">
        <input
          id="is_installment"
          name="is_installment"
          type="checkbox"
          checked={isInstallment}
          onChange={(e) => setIsInstallment(e.target.checked)}
        />
        <label htmlFor="is_installment" className="text-xs font-medium text-neutral-600">
          En cuotas
        </label>
      </div>

      {isInstallment && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Cant. cuotas (tarjeta)</label>
          <input
            name="total_installments"
            type="number"
            min={2}
            value={totalInstallments}
            onChange={(e) => setTotalInstallments(Number(e.target.value))}
            className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      )}

      {ownerType === "person" && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600">Monto a cobrarle</label>
            <input
              key={`charge-amount-${amount}`}
              name="charge_amount"
              type="number"
              step="0.01"
              defaultValue={amount}
              className="w-28 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600">Cuotas a cobrarle</label>
            <input
              key={`charge-installments-${isInstallment ? totalInstallments : 1}`}
              name="charge_installments"
              type="number"
              min={1}
              defaultValue={isInstallment ? totalInstallments : 1}
              className="w-24 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white"
      >
        Agregar
      </button>
    </form>
  );
}
