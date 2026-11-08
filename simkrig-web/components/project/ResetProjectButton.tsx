"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ResetProjectButtonProps = {
  projectId: string;
};

export default function ResetProjectButton({
  projectId,
}: ResetProjectButtonProps) {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleReset() {
    if (isResetting) {
      return;
    }

    const confirmed = window.confirm(
      "Esta acción eliminará todos los datos del proyecto y no se puede deshacer.",
    );
    if (!confirmed) {
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.rpc("reset_project_data", {
        p_project_id: projectId,
      });

      if (error) {
        throw new Error(error.message);
      }

      router.replace(`/project/${projectId}/data?reset=success`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `No se pudo reiniciar el proyecto: ${error.message}`
          : "No se pudo reiniciar el proyecto por un error inesperado.",
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div>
      <button
        className="rounded-lg border border-red-500/60 px-6 py-3 font-semibold text-red-300 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isResetting}
        onClick={handleReset}
        type="button"
      >
        {isResetting ? "Reiniciando..." : "🗑 Reiniciar Proyecto"}
      </button>
      {errorMessage && (
        <p className="mt-3 max-w-sm text-sm text-red-200" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
