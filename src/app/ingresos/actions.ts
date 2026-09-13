"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createIncome(formData: FormData) {
  const supabase = await createClient();

  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const incomeDate = String(formData.get("income_date") ?? "");
  const incomeType = String(formData.get("income_type") ?? "").trim() || null;

  if (!description || !amount || !incomeDate) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("incomes").insert({
    user_id: user.id,
    description,
    amount,
    income_date: incomeDate,
    income_type: incomeType,
  });

  revalidatePath("/ingresos");
}

export async function deleteIncome(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("incomes").delete().eq("id", id);
  revalidatePath("/ingresos");
}
