"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OwnerType } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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
  supabase: SupabaseServerClient,
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

// Crea un receivable + su/s cuota/s para una persona, a partir de un gasto.
// Se usa tanto para "de alguien" (una persona) como para dividir un
// "compartido" entre varias (una llamada por persona, cada una con su parte).
async function createReceivableFor(
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

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cardId = String(formData.get("card_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  const rawDescription = String(formData.get("raw_description") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0);
  const transactionDate = String(formData.get("transaction_date") ?? "");
  const categoryName = String(formData.get("category") ?? "");
  const ownerType = String(formData.get("owner_type") ?? "mine") as OwnerType;
  const personId = ownerType === "person" ? String(formData.get("person_id") ?? "") || null : null;
  const sharedPersonIds =
    ownerType === "shared" ? formData.getAll("shared_person_ids").map(String).filter(Boolean) : [];
  const isInstallment = formData.get("is_installment") === "on";
  const totalInstallments = isInstallment ? Number(formData.get("total_installments") ?? 1) : 1;

  if (!description || !amount || !transactionDate) return;

  const categoryId = await resolveCategoryId(supabase, user.id, categoryName);
  const statementMonth = firstOfMonth(transactionDate);

  let firstTransactionId: string | null = null;

  if (!isInstallment || totalInstallments <= 1) {
    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        card_id: cardId,
        category_id: categoryId,
        person_id: personId,
        description,
        raw_description: rawDescription,
        amount,
        transaction_date: transactionDate,
        statement_month: statementMonth,
        owner_type: ownerType,
        status: "confirmed",
        source: "manual",
      })
      .select("id")
      .single();
    if (error) console.error("createTransaction insert error:", error);
    firstTransactionId = inserted?.id ?? null;
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
      raw_description: rawDescription,
      amount,
      transaction_date: i === 0 ? transactionDate : addMonths(transactionDate, i),
      statement_month: firstOfMonth(transactionDate, i),
      installment_number: i + 1,
      installment_total: totalInstallments,
      owner_type: ownerType,
      status: i === 0 ? "confirmed" : "projected",
      source: "manual",
    }));

    const { data: insertedRows } = await supabase.from("transactions").insert(rows).select("id");
    firstTransactionId = insertedRows?.[0]?.id ?? null;
  }

  // Lo que se le cobra a la persona es un cronograma independiente del de
  // la tarjeta (puede tener otra cantidad de cuotas u otro monto).
  if (ownerType === "person" && personId) {
    const chargeAmount = Number(formData.get("charge_amount") ?? amount);
    const chargeInstallments = Math.max(
      1,
      Number(formData.get("charge_installments") ?? totalInstallments),
    );

    await createReceivableFor(supabase, {
      userId: user.id,
      personId,
      cardId,
      categoryId,
      sourceTransactionId: firstTransactionId,
      description,
      installmentAmount: chargeAmount,
      totalInstallments: chargeInstallments,
      startDate: transactionDate,
    });
  }

  // Compartido: se divide el monto en partes iguales entre las personas
  // elegidas, cada una con su propio cobro (se puede ajustar después).
  if (ownerType === "shared" && sharedPersonIds.length > 0) {
    const share = Math.round((amount / sharedPersonIds.length) * 100) / 100;
    for (const pid of sharedPersonIds) {
      await createReceivableFor(supabase, {
        userId: user.id,
        personId: pid,
        cardId,
        categoryId,
        sourceTransactionId: firstTransactionId,
        description,
        installmentAmount: share,
        totalInstallments: 1,
        startDate: transactionDate,
      });
    }
  }

  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/cuotas");
  revalidatePath("/personas");
}

// Suma o quita gente de la división de un gasto ya cargado (compartido u
// "otro gasto" que ahora se quiere repartir). Si ya se cobró alguna cuota de
// ese gasto no se toca nada, para no perder plata ya registrada.
export async function updateTransactionSplit(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const transactionId = String(formData.get("transaction_id") ?? "");
  const personIds = formData.getAll("person_ids").map(String).filter(Boolean);
  if (!transactionId) return;

  const { data: tx } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (!tx) return;

  const { data: existing } = await supabase
    .from("receivables")
    .select("id, receivable_charges(status)")
    .eq("source_transaction_id", transactionId);

  const hasCollected = (existing ?? []).some((r) =>
    (r.receivable_charges as { status: string }[]).some((c) => c.status === "collected"),
  );
  if (hasCollected) return;

  const existingIds = (existing ?? []).map((r) => r.id);
  if (existingIds.length) {
    await supabase.from("receivables").delete().in("id", existingIds);
  }

  if (personIds.length === 0) {
    await supabase.from("transactions").update({ owner_type: "mine" }).eq("id", transactionId);
  } else {
    await supabase.from("transactions").update({ owner_type: "shared" }).eq("id", transactionId);
    const share = Math.round((Number(tx.amount) / personIds.length) * 100) / 100;
    for (const pid of personIds) {
      await createReceivableFor(supabase, {
        userId: user.id,
        personId: pid,
        cardId: tx.card_id,
        categoryId: tx.category_id,
        sourceTransactionId: transactionId,
        description: tx.description,
        installmentAmount: share,
        totalInstallments: 1,
        startDate: tx.transaction_date,
      });
    }
  }

  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/personas");
}

export async function updateTransactionAmount(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!id || !amount) return;

  await supabase.from("transactions").update({ amount }).eq("id", id);
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
