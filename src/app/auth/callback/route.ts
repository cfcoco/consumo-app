import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_EMAIL = "cfcocofernandez@gmail.com";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Defensa en profundidad: aunque Google ya restringe el acceso a la
      // lista de usuarios de prueba, esto asegura que ninguna otra cuenta
      // pueda usar esta app aunque esa restricción cambie.
      if (data.user.email?.toLowerCase() !== ALLOWED_EMAIL) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not_allowed`);
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
