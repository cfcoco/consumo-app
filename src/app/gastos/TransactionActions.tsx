"use client";

import { useState } from "react";
import type { Person, Transaction } from "@/types/database";
import { deleteTransaction, updateTransactionAmount, updateTransactionSplit } from "./actions";

export function TransactionActions({
  transaction,
  people,
  sharedWith,
}: {
  transaction: Transaction;
  people: Person[];
  sharedWith: string[];
}) {
  const [editingAmount, setEditingAmount] = useState(false);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [showSplit, setShowSplit] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {editingAmount ? (
          <form
            action={async (formData) => {
              await updateTransactionAmount(formData);
              setEditingAmount(false);
            }}
            className="flex items-center gap-1"
          >
            <input type="hidden" name="id" value={transaction.id} />
            <input
              name="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs"
              autoFocus
            />
            <button className="text-xs font-medium text-emerald-700 hover:underline">Guardar</button>
            <button
              type="button"
              onClick={() => setEditingAmount(false)}
              className="text-xs text-neutral-400 hover:underline"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            onClick={() => setEditingAmount(true)}
            className="text-xs font-medium text-neutral-500 hover:underline"
          >
            Ajustar monto
          </button>
        )}
        <button
          onClick={() => setShowSplit((v) => !v)}
          className="text-xs font-medium text-neutral-500 hover:underline"
        >
          Dividir
        </button>
        <form action={deleteTransaction}>
          <input type="hidden" name="id" value={transaction.id} />
          <button className="text-xs font-medium text-red-600 hover:underline">Eliminar</button>
        </form>
      </div>

      {showSplit && (
        <form
          action={async (formData) => {
            await updateTransactionSplit(formData);
            setShowSplit(false);
          }}
          className="flex flex-col items-end gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-2"
        >
          <input type="hidden" name="transaction_id" value={transaction.id} />
          <p className="text-xs text-neutral-500">Dividir entre:</p>
          <div className="flex flex-wrap justify-end gap-2">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  name="person_ids"
                  value={p.id}
                  defaultChecked={sharedWith.includes(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
          <button className="text-xs font-medium text-emerald-700 hover:underline">
            Guardar división
          </button>
        </form>
      )}
    </div>
  );
}
