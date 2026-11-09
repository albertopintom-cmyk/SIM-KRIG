"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isValidUsername,
  normalizeUsername,
  usernameToAuthEmail,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) {
      setErrorMessage("Ingresa un usuario válido.");
      return;
    }
    if (!password) {
      setErrorMessage("Ingresa tu contraseña.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToAuthEmail(normalizedUsername),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al iniciar sesión.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        Usuario
        <input
          autoComplete="username"
          className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-cyan-400 focus:outline-none"
          disabled={isSubmitting}
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        Contraseña
        <input
          autoComplete="current-password"
          className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-cyan-400 focus:outline-none"
          disabled={isSubmitting}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {errorMessage && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200" role="alert">
          {errorMessage}
        </p>
      )}
      <button
        className="w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
