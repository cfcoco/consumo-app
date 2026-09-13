"use client";

import { useState } from "react";
import { updateChargeNote } from "./actions";

export function ChargeNote({ id, note }: { id: string; note: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left text-xs text-neutral-400 hover:underline"
        title="Agregar o editar comentario"
      >
        {note ? `“${note}”` : "+ Comentario"}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateChargeNote(formData);
        setEditing(false);
      }}
      className="flex items-start gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <textarea
        name="note"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Esta cuota es por..."
        autoFocus
        className="w-56 rounded-md border border-neutral-300 px-1.5 py-1 text-xs"
      />
      <button className="text-xs font-medium text-emerald-700 hover:underline">Guardar</button>
      <button
        type="button"
        onClick={() => {
          setValue(note ?? "");
          setEditing(false);
        }}
        className="text-xs text-neutral-400 hover:underline"
      >
        Cancelar
      </button>
    </form>
  );
}
