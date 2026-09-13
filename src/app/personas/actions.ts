"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
