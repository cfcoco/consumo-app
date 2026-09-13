"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCard(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const bank = String(formData.get("bank") ?? "").trim() || null;
  const closingDay = formData.get("closing_day");
  const dueDay = formData.get("due_day");
  const statementFormat = String(formData.get("statement_format") ?? "") || null;

  if (!name) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("cards").insert({
    user_id: user.id,
    name,
    bank,
    closing_day: closingDay ? Number(closingDay) : null,
    due_day: dueDay ? Number(dueDay) : null,
    statement_format: statementFormat,
  });

  revalidatePath("/tarjetas");
}

export async function deleteCard(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("cards").delete().eq("id", id);
  revalidatePath("/tarjetas");
}
