import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function firstOfMonth(dateStr: string, offsetMonths = 0) {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  return d.toISOString().slice(0, 10);
}

// Crea un receivable + su/s cuota/s para una persona, a partir de un gasto.
// Se usa tanto para "de alguien" (una persona) como para dividir un
// "compartido" entre varias (una llamada por persona, cada una con su parte),
// y también para vincular retroactivamente un consumo ya cargado.
export async function createReceivableFor(
  supabase: SupabaseServerClient,
  params: {
    userId: string;
    personId: string;
    cardId: string | null;
    categoryId: string | null;
    sourceTransactionId: string | null;
    description: string;
    installmentAmount: number;
    totalInstallments: number;
    startDate: string;
  },
) {
  const { data: receivable, error: receivableError } = await supabase
    .from("receivables")
    .insert({
      user_id: params.userId,
      person_id: params.personId,
      card_id: params.cardId,
      category_id: params.categoryId,
      source_transaction_id: params.sourceTransactionId,
      description: params.description,
      installment_amount: params.installmentAmount,
      total_installments: params.totalInstallments,
      start_month: firstOfMonth(params.startDate),
    })
    .select("id")
    .single();
  if (receivableError) console.error("createReceivableFor receivable error:", receivableError);

  const chargeRows = Array.from({ length: params.totalInstallments }, (_, i) => ({
    user_id: params.userId,
    receivable_id: receivable?.id,
    person_id: params.personId,
    description: params.description,
    amount: params.installmentAmount,
    due_month: firstOfMonth(params.startDate, i),
    installment_number: i + 1,
    installment_total: params.totalInstallments,
    status: "pending" as const,
  }));

  const { error: chargesError } = await supabase.from("receivable_charges").insert(chargeRows);
  if (chargesError) console.error("createReceivableFor charges error:", chargesError);
}
