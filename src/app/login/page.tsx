"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errParam = searchParams.get("error");
    if (errParam === "not_allowed") {
      setError("Esa cuenta de Google no tiene acceso a esta app.");
    } else if (errParam === "auth_failed") {
      setError("No se pudo completar el login. Probá de nuevo.");
    }
  }, [searchParams]);

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError("No se pudo iniciar el login con Google.");
      setLoading(false);
    }
    // En éxito, el navegador redirige a Google, no hay nada más que hacer acá.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Consumo App</h1>
        <p className="text-sm text-neutral-500">Acceso restringido a tu cuenta de Google.</p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.95H.96A8.997 8.997 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>
          {loading ? "Redirigiendo..." : "Continuar con Google"}
        </button>
      </div>
    </div>
  );
}
