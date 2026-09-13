"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createReceivableFor } from "@/lib/receivables";

export async function createPerson(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("people").insert({ user_id: user.id, name });
  revalidatePath("/personas");
}

export async function deletePerson(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("people").delete().eq("id", id);
  revalidatePath("/personas");
}

export async function updateChargeAmount(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!id || !amount) return;

  await supabase.from("receivable_charges").update({ amount }).eq("id", id);
  revalidatePath("/personas");
}

export async function updateChargeNote(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id) return;

  await supabase.from("receivable_charges").update({ note }).eq("id", id);
  revalidatePath("/personas");
}

// Borra una cuota puntual sin renumerar las demás: el resto conserva su
// número original para que coincida con lo que ya se le informó a la persona.
export async function deleteCharge(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("receivable_charges").delete().eq("id", id);
  revalidatePath("/personas");
}

// Toma un consumo real ya cargado en la tarjeta y lo convierte en deuda de una
// persona, con su propio plan de cobro (puede diferir del de la tarjeta).
export async function linkTransactionToPerson(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const personId = String(formData.get("person_id") ?? "");
  const transactionId = String(formData.get("transaction_id") ?? "");
  if (!personId || !transactionId) return;

  const { data: tx } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (!tx) return;

  const chargeAmount = Number(formData.get("charge_amount") ?? 0) || Number(tx.amount);
  const chargeInstallments = Math.max(1, Number(formData.get("charge_installments") ?? 1));

  await supabase
    .from("transactions")
    .update({ owner_type: "person", person_id: personId })
    .eq("id", transactionId);

  await createReceivableFor(supabase, {
    userId: user.id,
    personId,
    cardId: tx.card_id,
    categoryId: tx.category_id,
    sourceTransactionId: transactionId,
    description: tx.description,
    installmentAmount: chargeAmount,
    totalInstallments: chargeInstallments,
    startDate: tx.transaction_date,
  });

  revalidatePath("/personas");
  revalidatePath("/gastos");
}

export async function settleCharge(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("receivable_charges")
    .update({ status: "collected", collected_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/personas");
}

// Adelanto: la persona paga varias cuotas de una, pero la tarjeta sigue
// cobrándome el mismo plan mes a mes.
export async function settleChargesAhead(formData: FormData) {
  const supabase = await createClient();
  const receivableId = String(formData.get("receivable_id") ?? "");
  const count = Math.max(1, Number(formData.get("count") ?? 1));
  if (!receivableId) return;

  const { data: pending } = await supabase
    .from("receivable_charges")
    .select("id")
    .eq("receivable_id", receivableId)
    .eq("status", "pending")
    .order("due_month", { ascending: true })
    .limit(count);

  const ids = (pending ?? []).map((c) => c.id as string);
  if (!ids.length) return;

  await supabase
    .from("receivable_charges")
    .update({ status: "collected", collected_at: new Date().toISOString() })
    .in("id", ids);

  revalidatePath("/personas");
}

// Cancelación anticipada: el familiar canceló todo de una, pero la tarjeta
// sigue su propio plan de cuotas sin verse afectada.
export async function settleReceivable(formData: FormData) {
  const supabase = await createClient();
  const receivableId = String(formData.get("receivable_id") ?? "");
  if (!receivableId) return;

  await supabase
    .from("receivable_charges")
    .update({ status: "collected", collected_at: new Date().toISOString() })
    .eq("receivable_id", receivableId)
    .eq("status", "pending");

  await supabase
    .from("receivables")
    .update({ status: "settled", settled_at: new Date().toISOString() })
    .eq("id", receivableId);

  revalidatePath("/personas");
}
