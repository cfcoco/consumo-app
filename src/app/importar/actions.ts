"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { extractPdfText, parseStatement } from "@/lib/statements/parse";
import { reconcile, type ReconciledCharge } from "@/lib/statements/reconcile";
import type { Transaction } from "@/types/database";

function firstOfMonth(dateStr: string, offsetMonths = 0) {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  return d.toISOString().slice(0, 10);
}

export async function uploadStatement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cardId = String(formData.get("card_id") ?? "");
  const statementMonth = String(formData.get("statement_month") ?? "");
  const password = String(formData.get("password") ?? "") || undefined;
  const file = formData.get("file") as File | null;

  if (!cardId || !statementMonth || !file || file.size === 0) return;

  const { data: card } = await supabase.from("cards").select("*").eq("id", cardId).single();
  if (!card?.statement_format || card.statement_format === "naranja") return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  let lines: string[];
  try {
    lines = await extractPdfText(bytes, password);
  } catch {
    return;
  }

  const parsed = parseStatement(card.statement_format, lines);
  const monthStart = firstOfMonth(`${statementMonth}-01`);

  const { data: existing } = await supabase
    .from("transactions")
    .select("*")
    .eq("card_id", cardId);

  const reconciled = reconcile(parsed.charges, (existing as Transaction[] | null) ?? []);

  const filePath = `${user.id}/${cardId}/${statementMonth}-${Date.now()}.pdf`;
  await supabase.storage.from("statements").upload(filePath, bytes, {
    contentType: "application/pdf",
  });

  const { data: importRow } = await supabase
    .from("statement_imports")
    .insert({
      user_id: user.id,
      card_id: cardId,
      statement_month: monthStart,
      file_path: filePath,
      parsed_result: {
        charges: reconciled,
        nextClosingDay: parsed.nextClosingDay,
        nextDueDay: parsed.nextDueDay,
      },
      status: "pending_review",
    })
    .select("id")
    .single();

  if (!importRow) return;
  redirect(`/importar/${importRow.id}`);
}

async function resolveCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", "Importado")
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data: created } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: "Importado" })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function confirmImport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const importId = String(formData.get("import_id") ?? "");
  if (!importId) return;

  const { data: importRow } = await supabase
    .from("statement_imports")
    .select("*")
    .eq("id", importId)
    .single();
  if (!importRow) return;

  const includedIndexes = new Set(formData.getAll("include").map(String));
  const charges = (importRow.parsed_result as { charges: ReconciledCharge[] }).charges;
  const categoryId = await resolveCategoryId(supabase, user.id);

  for (let i = 0; i < charges.length; i++) {
    if (!includedIndexes.has(String(i))) continue;
    const charge = charges[i];

    if (charge.kind === "exists") continue;

    if (charge.kind === "advance" && charge.matchedTransactionId) {
      await supabase
        .from("transactions")
        .update({
          status: "confirmed",
          amount: charge.amountArs,
          raw_description: charge.rawDescription,
          source: "import",
        })
        .eq("id", charge.matchedTransactionId);
      continue;
    }

    // kind === "new"
    const statementMonth = firstOfMonth(charge.date);
    let seriesId: string | null = null;
    if (charge.installmentNumber && charge.installmentTotal && charge.installmentTotal > 1) {
      const { data: series } = await supabase
        .from("installment_series")
        .insert({
          user_id: user.id,
          card_id: importRow.card_id,
          category_id: categoryId,
          description: charge.rawDescription,
          owner_type: "mine",
          installment_amount: charge.amountArs,
          total_installments: charge.installmentTotal,
          start_month: statementMonth,
        })
        .select("id")
        .single();
      seriesId = series?.id ?? null;
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      card_id: importRow.card_id,
      series_id: seriesId,
      category_id: categoryId,
      description: charge.rawDescription,
      raw_description: charge.rawDescription,
      amount: charge.amountArs,
      transaction_date: charge.date,
      statement_month: statementMonth,
      installment_number: charge.installmentNumber,
      installment_total: charge.installmentTotal,
      owner_type: "mine",
      status: "confirmed",
      source: "import",
    });

    // Si viene con más cuotas futuras, se proyectan igual que la carga manual.
    if (
      seriesId &&
      charge.installmentNumber &&
      charge.installmentTotal &&
      charge.installmentTotal > charge.installmentNumber
    ) {
      const remaining = charge.installmentTotal - charge.installmentNumber;
      const rows = Array.from({ length: remaining }, (_, i) => ({
        user_id: user.id,
        card_id: importRow.card_id,
        series_id: seriesId,
        category_id: categoryId,
        description: charge.rawDescription,
        raw_description: charge.rawDescription,
        amount: charge.amountArs,
        transaction_date: statementMonth,
        statement_month: firstOfMonth(statementMonth, i + 1),
        installment_number: charge.installmentNumber! + i + 1,
        installment_total: charge.installmentTotal,
        owner_type: "mine" as const,
        status: "projected" as const,
        source: "import" as const,
      }));
      await supabase.from("transactions").insert(rows);
    }
  }

  const parsedMeta = importRow.parsed_result as { nextClosingDay: number | null; nextDueDay: number | null };
  const cardUpdate: Record<string, number> = {};
  if (parsedMeta.nextClosingDay) cardUpdate.closing_day = parsedMeta.nextClosingDay;
  if (parsedMeta.nextDueDay) cardUpdate.due_day = parsedMeta.nextDueDay;
  if (Object.keys(cardUpdate).length) {
    await supabase.from("cards").update(cardUpdate).eq("id", importRow.card_id);
  }

  await supabase.from("statement_imports").update({ status: "applied" }).eq("id", importId);

  revalidatePath("/gastos");
  revalidatePath("/tarjetas");
  revalidatePath("/cuotas");
  revalidatePath("/historial");
  redirect("/historial");
}
