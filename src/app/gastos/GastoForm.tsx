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

  return (
    <form
      action={async (formData) => {
        await createTransaction(formData);
        setIsInstallment(false);
        setOwnerType("mine");
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
        <label className="text-xs font-medium text-neutral-600">Descripción</label>
        <input
          name="description"
          required
          placeholder="Notebook"
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
          <label className="text-xs font-medium text-neutral-600">Cant. cuotas</label>
          <input
            name="total_installments"
            type="number"
            min={2}
            defaultValue={2}
            className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
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
