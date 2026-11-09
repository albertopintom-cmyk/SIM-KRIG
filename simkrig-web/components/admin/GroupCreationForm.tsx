"use client";

import { useState } from "react";

type CreatedGroup = {
  groupName: string;
  username: string;
  temporaryPassword: string;
  projectId: string;
  projectName: string;
};

export default function GroupCreationForm() {
  const [groupName, setGroupName] = useState("");
  const [username, setUsername] = useState("");
  const [projectName, setProjectName] = useState("");
  const [createdGroup, setCreatedGroup] = useState<CreatedGroup | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setCreatedGroup(null);

    try {
      const response = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName, username, projectName }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "No se pudo crear el grupo.";
        throw new Error(message);
      }

      if (
        typeof result !== "object" ||
        result === null ||
        !("username" in result) ||
        typeof result.username !== "string" ||
        !("groupName" in result) ||
        typeof result.groupName !== "string" ||
        !("temporaryPassword" in result) ||
        typeof result.temporaryPassword !== "string" ||
        !("projectId" in result) ||
        typeof result.projectId !== "string" ||
        !("projectName" in result) ||
        typeof result.projectName !== "string"
      ) {
        throw new Error("El servidor devolvió una respuesta inválida.");
      }

      setCreatedGroup({
        groupName: result.groupName,
        username: result.username,
        temporaryPassword: result.temporaryPassword,
        projectId: result.projectId,
        projectName: result.projectName,
      });
      setGroupName("");
      setUsername("");
      setProjectName("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear el grupo por un error inesperado.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Nombre Grupo
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-cyan-400 focus:outline-none"
            maxLength={100}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Ejemplo: EY001 - Grupo 1"
            required
            value={groupName}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Usuario
          <input
            autoCapitalize="none"
            autoComplete="off"
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-cyan-400 focus:outline-none"
            maxLength={64}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            pattern="[a-z0-9_]{3,64}"
            placeholder="Ejemplo: ey001_g01"
            required
            value={username}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Proyecto
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-cyan-400 focus:outline-none"
            maxLength={100}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Ejemplo: Proyecto Grupo 1"
            required
            value={projectName}
          />
        </label>
        {errorMessage && (
          <p
            className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
        <button
          className="rounded-lg bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creando grupo..." : "Crear grupo"}
        </button>
      </form>

      {createdGroup && (
        <section
          aria-live="polite"
          className="mt-8 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-5"
          role="status"
        >
          <h2 className="text-lg font-semibold text-emerald-200">
            Grupo creado correctamente
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-400">Grupo</dt>
              <dd className="mt-1 text-slate-100">{createdGroup.groupName}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Usuario</dt>
              <dd className="mt-1 font-mono text-slate-100">
                {createdGroup.username}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Contraseña temporal</dt>
              <dd className="mt-1 break-all font-mono text-slate-100">
                {createdGroup.temporaryPassword}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-slate-400">Proyecto</dt>
              <dd className="mt-1 text-slate-100">{createdGroup.projectName}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-amber-200">
            Guarda la contraseña temporal ahora; no se volverá a mostrar.
          </p>
        </section>
      )}
    </section>
  );
}
