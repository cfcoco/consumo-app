import { createClient } from "@/lib/supabase/server";
import type { Card } from "@/types/database";
import { uploadStatement } from "./actions";
import { PasswordField } from "./PasswordField";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ImportarPage() {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .not("statement_format", "is", null)
    .order("name");

  const cardsWithoutFormat = await supabase
    .from("cards")
    .select("*")
    .is("statement_format", null);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Importar resumen</h1>
        <p className="text-sm text-neutral-500">
          Subí el PDF del resumen de una tarjeta. Se van a detectar los gastos nuevos y las cuotas
          que avanzaron, y vas a poder revisar todo antes de confirmar nada.
        </p>
      </div>

      <form
        action={uploadStatement}
        encType="multipart/form-data"
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Tarjeta</label>
          <select
            name="card_id"
            required
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {((cards as Card[] | null) ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {!!cardsWithoutFormat.data?.length && (
            <p className="text-xs text-amber-600">
              {cardsWithoutFormat.data.map((c) => c.name).join(", ")} no tiene formato de resumen
              asignado — configuralo en Tarjetas para poder importarla.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Mes del resumen</label>
          <input
            name="statement_month"
            type="month"
            required
            defaultValue={currentMonth()}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">
            Contraseña del PDF (si tiene)
          </label>
          <PasswordField />
          <p className="text-xs text-neutral-400">
            Se guarda solo en este navegador (no viaja al repositorio ni a la base de datos) para
            no tener que escribirla cada vez.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Archivo PDF</label>
          <input name="file" type="file" accept="application/pdf" required className="text-sm" />
        </div>

        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white"
        >
          Analizar resumen
        </button>
      </form>
    </div>
  );
}
