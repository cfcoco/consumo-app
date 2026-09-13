"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OwnerType } from "@/types/database";

function firstOfMonth(dateStr: string, offsetMonths = 0) {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, offsetMonths: number) {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, day));
  return d.toISOString().slice(0, 10);
}

async function resolveCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryName: string,
) {
  const name = categoryName.trim();
  if (!name) return null;

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created } = await supabase
    .from("categories")
    .insert({ user_id: userId, name })
    .select("id")
    .single();

  return created?.id ?? null;
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cardId = String(formData.get("card_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const transactionDate = String(formData.get("transaction_date") ?? "");
  const categoryName = String(formData.get("category") ?? "");
  const ownerType = String(formData.get("owner_type") ?? "mine") as OwnerType;
  const personId = ownerType === "person" ? String(formData.get("person_id") ?? "") || null : null;
  const isInstallment = formData.get("is_installment") === "on";
  const totalInstallments = isInstallment ? Number(formData.get("total_installments") ?? 1) : 1;

  if (!description || !amount || !transactionDate) return;

  const categoryId = await resolveCategoryId(supabase, user.id, categoryName);
  const statementMonth = firstOfMonth(transactionDate);

  if (!isInstallment || totalInstallments <= 1) {
    await supabase.from("transactions").insert({
      user_id: user.id,
      card_id: cardId,
      category_id: categoryId,
      person_id: personId,
      description,
      amount,
      transaction_date: transactionDate,
      statement_month: statementMonth,
      owner_type: ownerType,
      status: "confirmed",
      source: "manual",
    });
  } else {
    const { data: series } = await supabase
      .from("installment_series")
      .insert({
        user_id: user.id,
        card_id: cardId,
        category_id: categoryId,
        person_id: personId,
        description,
        owner_type: ownerType,
        installment_amount: amount,
        total_installments: totalInstallments,
        start_month: statementMonth,
      })
      .select("id")
      .single();

    const rows = Array.from({ length: totalInstallments }, (_, i) => ({
      user_id: user.id,
      card_id: cardId,
      series_id: series?.id ?? null,
      category_id: categoryId,
      person_id: personId,
      description,
      amount,
      transaction_date: i === 0 ? transactionDate : addMonths(transactionDate, i),
      statement_month: firstOfMonth(transactionDate, i),
      installment_number: i + 1,
      installment_total: totalInstallments,
      owner_type: ownerType,
      status: i === 0 ? "confirmed" : "projected",
      source: "manual",
    }));

    await supabase.from("transactions").insert(rows);
  }

  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/cuotas");
}

export async function deleteTransaction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/cuotas");
}
