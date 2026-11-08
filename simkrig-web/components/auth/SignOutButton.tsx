"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(`No se pudo cerrar la sesión: ${error.message}`);
      setIsSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {errorMessage && (
        <p className="text-sm text-red-300" role="alert">
          {errorMessage}
        </p>
      )}
      <button
        className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-60"
        disabled={isSigningOut}
        onClick={handleSignOut}
        type="button"
      >
        {isSigningOut ? "Cerrando..." : "Cerrar sesión"}
      </button>
    </div>
  );
}
