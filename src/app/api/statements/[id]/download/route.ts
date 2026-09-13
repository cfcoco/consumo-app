import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: importRow } = await supabase
    .from("statement_imports")
    .select("file_path")
    .eq("id", id)
    .single();

  if (!importRow?.file_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("statements")
    .createSignedUrl(importRow.file_path, 60);

  if (error || !data) {
    return NextResponse.json({ error: "could not sign url" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
