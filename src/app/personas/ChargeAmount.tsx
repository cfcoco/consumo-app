"use client";

import { useState } from "react";
import { updateChargeAmount } from "./actions";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export function ChargeAmount({ id, amount }: { id: string; amount: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(amount));

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="hover:underline" title="Ajustar monto">
        {money(amount)}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateChargeAmount(formData);
        setEditing(false);
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="amount"
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="w-24 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs"
      />
      <button className="text-xs font-medium text-emerald-700 hover:underline">Guardar</button>
    </form>
  );
}
