"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "consumo-app:statement-password";

export function PasswordField() {
  const [value, setValue] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setValue(saved);
    } catch {
      // localStorage no disponible (modo privado, etc.), sin problema.
    }
  }, []);

  function handleChange(v: string) {
    setValue(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignorar
    }
  }

  return (
    <input
      name="password"
      type="password"
      placeholder="Se recuerda en este navegador"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
    />
  );
}
