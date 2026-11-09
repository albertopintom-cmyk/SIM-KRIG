"use client";

import Link from "next/link";
import { useState } from "react";

export type AdminProject = {
  id: string;
  name: string;
  description: string | null;
  projectType: "teacher" | "group";
  ownerName: string;
  ownerId: string | null;
  lastActivityAt: string | null;
};

function formatActivity(value: string | null) {
  if (!value) return "Sin actividad registrada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin actividad" : date.toLocaleString("es-CL");
}

export default function ProjectManagement({
  projects,
  currentUserId,
}: {
  projects: AdminProject[];
  currentUserId: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function startEditing(project: AdminProject) {
    setEditingId(project.id);
    setName(project.name);
    setDescription(project.description ?? "");
    setError(null);
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        editingId ? `/api/admin/projects/${editingId}` : "/api/admin/projects",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        const detail =
          typeof result === "object" && result !== null && "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "No se pudo guardar el proyecto.";
        throw new Error(detail);
      }
      setMessage(editingId ? "Proyecto actualizado." : "Proyecto creado.");
      resetForm();
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error inesperado.");
    } finally {
      setPending(false);
    }
  }

  async function deleteProject(project: AdminProject) {
    if (!window.confirm(`¿Eliminar el proyecto "${project.name}" y todos sus datos?`)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const detail =
          typeof result === "object" && result !== null && "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "No se pudo eliminar el proyecto.";
        throw new Error(detail);
      }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error inesperado.");
      setPending(false);
    }
  }

  const editableProjects = projects.filter(
    (project) => project.projectType === "teacher" && project.ownerId === currentUserId,
  );

  return (
    <div className="space-y-12">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">{editingId ? "Editar proyecto" : "Nuevo proyecto docente"}</h2>
        <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Nombre del proyecto
            <input className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3" maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Descripción
            <textarea className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3" maxLength={1000} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
          </label>
          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          {message && <p className="text-sm text-emerald-300" role="status">{message}</p>}
          <div className="flex gap-3">
            <button className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50" disabled={pending} type="submit">
              {pending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear proyecto"}
            </button>
            {editingId && <button className="rounded-lg border border-slate-700 px-5 py-3" onClick={resetForm} type="button">Cancelar</button>}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Todos los proyectos</h2>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr><th className="p-4">Tipo</th><th className="p-4">Propietario / Grupo</th><th className="p-4">Proyecto</th><th className="p-4">Última Actividad</th><th className="p-4">Acciones</th></tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const editable = editableProjects.some((item) => item.id === project.id);
                return (
                  <tr className="border-t border-slate-800" key={project.id}>
                    <td className="p-4">{project.projectType === "teacher" ? "Docente" : "Grupo"}</td>
                    <td className="p-4">{project.ownerName}</td>
                    <td className="p-4"><Link className="text-cyan-300 hover:underline" href={`/admin/projects/${project.id}`}>{project.name}</Link></td>
                    <td className="p-4">{formatActivity(project.lastActivityAt)}</td>
                    <td className="p-4">
                      {editable ? (
                        <div className="flex gap-3">
                          <button className="text-cyan-300 hover:underline" onClick={() => startEditing(project)} type="button">Editar</button>
                          <button className="text-red-300 hover:underline" disabled={pending} onClick={() => void deleteProject(project)} type="button">Eliminar</button>
                        </div>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.length === 0 && <p className="p-6 text-slate-400">No hay proyectos.</p>}
        </div>
      </section>
    </div>
  );
}
