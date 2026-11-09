"use client";

import { useState } from "react";

export type AdminGroup = {
  id: string;
  groupName: string;
  username: string;
  isActive: boolean;
  isAssigned: boolean;
  projectName: string;
};

export default function GroupManagement({ groups }: { groups: AdminGroup[] }) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function runAction(group: AdminGroup, action: "reset-password" | "deactivate") {
    if (
      action === "deactivate" &&
      !window.confirm(`¿Desactivar el grupo "${group.groupName}"? Perderá el acceso al proyecto.`)
    ) return;
    setPendingId(group.id);
    setErrors((previous) => ({ ...previous, [group.id]: "" }));
    setResults((previous) => ({ ...previous, [group.id]: "" }));
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "No se pudo completar la acción.";
        throw new Error(message);
      }
      const temporaryPassword =
        typeof result === "object" && result !== null &&
        "temporaryPassword" in result && typeof result.temporaryPassword === "string"
          ? result.temporaryPassword
          : null;
      if (
        action === "reset-password" &&
        temporaryPassword !== null
      ) {
        setResults((previous) => ({ ...previous, [group.id]: temporaryPassword }));
      } else {
        window.location.reload();
      }
    } catch (error) {
      setErrors((previous) => ({
        ...previous,
        [group.id]: error instanceof Error ? error.message : "Error inesperado.",
      }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">Grupos</h2>
      {groups.length === 0 ? (
        <p className="mt-4 text-slate-400">Todavía no hay grupos.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {groups.map((group) => (
            <article key={group.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{group.groupName}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Usuario: {group.username} · Proyecto: {group.projectName || "Sin asignar"}
                  </p>
                  <p className={`mt-2 text-sm ${group.isAssigned ? "text-emerald-300" : "text-amber-300"}`}>
                    Asignación: {group.isAssigned ? "Asignado" : "Sin asignar"}
                  </p>
                  <p className={`mt-2 text-sm ${group.isActive ? "text-emerald-300" : "text-amber-300"}`}>
                    {group.isActive ? "Activo" : "Desactivado"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-cyan-500 px-3 py-2 text-sm text-cyan-200 disabled:opacity-50"
                    disabled={pendingId === group.id || !group.isActive}
                    onClick={() => void runAction(group, "reset-password")}
                    type="button"
                  >
                    Resetear contraseña
                  </button>
                  <button
                    className="rounded-md border border-amber-500 px-3 py-2 text-sm text-amber-200 disabled:opacity-50"
                    disabled={pendingId === group.id || !group.isActive}
                    onClick={() => void runAction(group, "deactivate")}
                    type="button"
                  >
                    Desactivar
                  </button>
                </div>
              </div>
              {results[group.id] && (
                <p className="mt-4 break-all rounded bg-slate-950 p-3 font-mono text-sm">
                  Contraseña temporal: {results[group.id]}
                </p>
              )}
              {errors[group.id] && <p className="mt-3 text-sm text-red-300" role="alert">{errors[group.id]}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
