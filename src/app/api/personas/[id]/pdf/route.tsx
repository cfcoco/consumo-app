import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";
import type { Receivable, ReceivableCharge } from "@/types/database";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 16 },
  receivable: { marginBottom: 12, borderBottom: "1px solid #e5e5e5", paddingBottom: 8 },
  receivableTitle: { fontSize: 11, marginBottom: 2 },
  receivableMeta: { color: "#666", marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 8,
    borderTop: "2px solid #171717",
    fontSize: 13,
  },
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: person } = await supabase.from("people").select("*").eq("id", id).single();
  if (!person) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: receivables } = await supabase
    .from("receivables")
    .select("*")
    .eq("person_id", id)
    .order("start_month", { ascending: true });

  const { data: charges } = await supabase
    .from("receivable_charges")
    .select("*")
    .eq("person_id", id)
    .order("installment_number", { ascending: true });

  const chargesByReceivable = new Map<string, ReceivableCharge[]>();
  for (const c of (charges as ReceivableCharge[] | null) ?? []) {
    const list = chargesByReceivable.get(c.receivable_id) ?? [];
    list.push(c);
    chargesByReceivable.set(c.receivable_id, list);
  }

  const activeReceivables = ((receivables as Receivable[] | null) ?? []).filter(
    (r) => (chargesByReceivable.get(r.id) ?? []).some((c) => c.status === "pending"),
  );

  let grandTotal = 0;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Deuda de {person.name}</Text>
        <Text style={styles.subtitle}>
          Generado el {formatDate(new Date().toISOString().slice(0, 10))}
        </Text>

        {activeReceivables.map((r) => {
          const items = chargesByReceivable.get(r.id) ?? [];
          const pending = items.filter((c) => c.status === "pending");
          const collectedCount = items.length - pending.length;
          const subtotal = pending.reduce((sum, c) => sum + Number(c.amount), 0);
          grandTotal += subtotal;
          const currentInstallment = collectedCount + 1;

          return (
            <View key={r.id} style={styles.receivable}>
              <Text style={styles.receivableTitle}>{r.description}</Text>
              <Text style={styles.receivableMeta}>
                Inicio: {formatDate(r.start_month)} · Cuota actual: {currentInstallment}/
                {r.total_installments} · Restantes: {pending.length}
              </Text>
              {pending.map((c) => (
                <View key={c.id} style={styles.row}>
                  <Text>
                    Cuota {c.installment_number}/{c.installment_total} — {formatDate(c.due_month)}
                  </Text>
                  <Text>{money(Number(c.amount))}</Text>
                </View>
              ))}
              <View style={styles.row}>
                <Text style={{ fontWeight: 700 }}>Subtotal</Text>
                <Text style={{ fontWeight: 700 }}>{money(subtotal)}</Text>
              </View>
            </View>
          );
        })}

        {!activeReceivables.length && <Text>No tiene deuda pendiente.</Text>}

        <View style={styles.totalRow}>
          <Text>Total adeudado</Text>
          <Text>{money(grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="deuda-${person.name.replace(/\s+/g, "_")}.pdf"`,
    },
  });
}
