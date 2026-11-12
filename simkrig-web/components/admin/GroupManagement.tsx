"use client";

import { useMemo, useState } from "react";

export type AdminGroup = {
  id: string;
  groupName: string;
  username: string;
  isActive: boolean;
  isAssigned: boolean;
  projectName: string;
};

export type ExistingProjectOption = {
  id: string;
  name: string;
  projectType: string;
};

type GroupFilter = "all" | "active" | "inactive";

type ActivityEntry = {
  id: string;
  message: string;
  type: "success" | "error";
};

export default function GroupManagement({
  groups,
  existingProjects,
}: {
  groups: AdminGroup[];
  existingProjects: ExistingProjectOption[];
}) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Record<string, boolean>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
  const [existingProjectSelections, setExistingProjectSelections] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<GroupFilter>("all");
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const filteredGroups = useMemo(() => {
    if (filter === "active") return groups.filter((group) => group.isActive);
    if (filter === "inactive") return groups.filter((group) => !group.isActive);
    return groups;
  }, [filter, groups]);

  const selectedCount = useMemo(
    () => Object.values(selectedGroupIds).filter(Boolean).length,
    [selectedGroupIds],
  );

  function pushActivity(message: string, type: ActivityEntry["type"] = "success") {
    setActivity((prev) => [
      { id: `${Date.now()}-${Math.random()}`, message, type },
      ...prev,
    ].slice(0, 8));
  }

  function refreshAfterAction() {
    window.location.reload();
  }

  async function runResetPassword(group: AdminGroup) {
    setPendingId(group.id);
    setErrors((previous) => ({ ...previous, [group.id]: "" }));
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password" }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudo completar la acción.";
        throw new Error(message);
      }

      const temporaryPassword =
        typeof result === "object" && result !== null &&
        "temporaryPassword" in result && typeof result.temporaryPassword === "string"
          ? result.temporaryPassword
          : null;

      if (temporaryPassword !== null) {
        setResults((previous) => ({ ...previous, [group.id]: temporaryPassword }));
      }
      pushActivity(`Se reestableció la contraseña del grupo ${group.groupName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al restablecer contraseña del grupo ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function runToggleActive(group: AdminGroup, nextActive: boolean) {
    const action = nextActive ? "activate" : "deactivate";
    const actionText = nextActive ? "reactivó" : "desactivó";

    if (
      !nextActive &&
      !window.confirm(`¿Desactivar el grupo "${group.groupName}"? Perderá el acceso al proyecto.`)
    ) {
      return;
    }

    setPendingId(group.id);
    setErrors((previous) => ({ ...previous, [group.id]: "" }));
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : `No se pudo ${nextActive ? "reactivar" : "desactivar"} el grupo.`;
        throw new Error(message);
      }
      pushActivity(`Se ${actionText} el grupo ${group.groupName}.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al ${nextActive ? "reactivar" : "desactivar"} ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function runEditName(group: AdminGroup) {
    const nextName = (nameDrafts[group.id] ?? group.groupName).trim();
    if (!nextName) {
      setErrors((previous) => ({ ...previous, [group.id]: "Debes indicar un nombre válido." }));
      return;
    }

    setPendingId(group.id);
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit-name", groupName: nextName }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudo actualizar el nombre.";
        throw new Error(message);
      }
      pushActivity(`Se actualizó el nombre del grupo ${group.groupName} a ${nextName}.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al actualizar el nombre del grupo ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function runAssignProject(group: AdminGroup) {
    const projectName = (assignmentDrafts[group.id] ?? "").trim();
    if (!projectName) {
      setErrors((previous) => ({ ...previous, [group.id]: "Debes escribir el nombre del proyecto." }));
      return;
    }

    setPendingId(group.id);
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign-project", projectName }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudo asignar el proyecto.";
        throw new Error(message);
      }
      pushActivity(`Se asignó el proyecto ${projectName} al grupo ${group.groupName}.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al asignar proyecto al grupo ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function runAssignExistingProject(group: AdminGroup) {
    const projectId = existingProjectSelections[group.id] ?? "";
    if (!projectId) {
      setErrors((previous) => ({
        ...previous,
        [group.id]: "Selecciona un proyecto existente para vincularlo.",
      }));
      return;
    }

    setPendingId(group.id);
    setErrors((previous) => ({ ...previous, [group.id]: "" }));
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign-existing-project", projectId }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudo vincular el proyecto existente.";
        throw new Error(message);
      }

      const projectName = existingProjects.find((project) => project.id === projectId)?.name;
      pushActivity(`Se vinculó el proyecto existente ${projectName ?? ""} al grupo ${group.groupName}.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al vincular proyecto existente al grupo ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function runReassignProject(group: AdminGroup) {
    const targetUserId = reassignTargets[group.id] ?? "";
    if (!targetUserId) {
      setErrors((previous) => ({ ...previous, [group.id]: "Debes elegir otro grupo como destino." }));
      return;
    }

    setPendingId(group.id);
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign-project", targetUserId }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudo reasignar el proyecto.";
        throw new Error(message);
      }
      const targetGroup = groups.find((candidate) => candidate.id === targetUserId);
      pushActivity(`Se movió el proyecto del grupo ${group.groupName} a ${targetGroup?.groupName ?? "otro grupo"}.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al reasignar proyecto del grupo ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function runResetProject(group: AdminGroup) {
    if (!window.confirm(`¿Reiniciar el proyecto del grupo "${group.groupName}"? Se creará un nuevo proyecto y se transferirá la asignación.`)) {
      return;
    }

    setPendingId(group.id);
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-project" }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudo reiniciar el proyecto.";
        throw new Error(message);
      }
      pushActivity(`Se reinició el proyecto del grupo ${group.groupName}.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al reiniciar proyecto del grupo ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function runDeleteGroup(group: AdminGroup) {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente al grupo "${group.groupName}"? Esta acción borrará su cuenta, perfil y proyecto asociado.`,
    );
    if (!confirmed) {
      return;
    }

    setPendingId(group.id);
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-group" }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudo eliminar el grupo.";
        throw new Error(message);
      }
      pushActivity(`Se eliminó el grupo ${group.groupName}.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, [group.id]: message }));
      pushActivity(`Error al eliminar el grupo ${group.groupName}: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function bulkDeleteSelected() {
    const selectedIds = Object.entries(selectedGroupIds)
      .filter(([, isSelected]) => isSelected)
      .map(([groupId]) => groupId);

    if (selectedIds.length === 0) {
      return;
    }

    if (!window.confirm(`¿Eliminar ${selectedIds.length} grupos seleccionados?`)) {
      return;
    }

    setPendingId("bulk");
    try {
      const response = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk-delete", userIds: selectedIds }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se pudieron eliminar los grupos seleccionados.";
        throw new Error(message);
      }
      pushActivity(`Se eliminaron ${selectedIds.length} grupos en lote.`);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      setErrors((previous) => ({ ...previous, bulk: message }));
      pushActivity(`Error en eliminación en lote: ${message}`, "error");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-12 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Grupos</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "active", "inactive"] as GroupFilter[]).map((value) => (
            <button
              key={value}
              className={`rounded-md border px-3 py-2 text-sm ${
                filter === value
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-700 text-slate-300"
              }`}
              onClick={() => setFilter(value)}
              type="button"
            >
              {value === "all" ? "Todos" : value === "active" ? "Activos" : "Inactivos"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Actividad reciente</h3>
          {selectedCount > 0 && (
            <button
              className="rounded-md border border-red-500 px-3 py-2 text-sm text-red-200 disabled:opacity-50"
              disabled={pendingId !== null}
              onClick={() => void bulkDeleteSelected()}
              type="button"
            >
              Eliminar seleccionados ({selectedCount})
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400">No hay actividad registrada aún.</p>
          ) : (
            activity.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  entry.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                    : "border-red-500/30 bg-red-500/5 text-red-200"
                }`}
              >
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="mt-4 text-slate-400">No hay grupos en este filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    <span className="sr-only">Seleccionar</span>
                  </th>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Proyecto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group) => (
                  <tr key={group.id} className="border-t border-slate-800 align-top">
                    <td className="px-4 py-4">
                      <input
                        checked={Boolean(selectedGroupIds[group.id])}
                        className="h-4 w-4 accent-cyan-500"
                        onChange={() =>
                          setSelectedGroupIds((previous) => ({
                            ...previous,
                            [group.id]: !previous[group.id],
                          }))
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="w-40">
                        <input
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                          onChange={(event) => setNameDrafts((previous) => ({ ...previous, [group.id]: event.target.value }))}
                          value={nameDrafts[group.id] ?? group.groupName}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-slate-300">{group.username}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="w-48">
                        <p className="mb-2 text-xs text-slate-400">
                          Actual: {group.projectName || "Sin asignar"}
                        </p>
                        <input
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                          onChange={(event) =>
                            setAssignmentDrafts((previous) => ({
                              ...previous,
                              [group.id]: event.target.value,
                            }))
                          }
                          placeholder="Nuevo proyecto"
                          value={assignmentDrafts[group.id] ?? ""}
                        />
                        <select
                          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                          disabled={group.isAssigned || existingProjects.length === 0 || pendingId === group.id}
                          onChange={(event) =>
                            setExistingProjectSelections((previous) => ({
                              ...previous,
                              [group.id]: event.target.value,
                            }))
                          }
                          value={existingProjectSelections[group.id] ?? ""}
                        >
                          <option value="">Vincular proyecto existente…</option>
                          {existingProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name} ({project.projectType === "teacher" ? "docente/legado" : "grupo"})
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${group.isActive ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                        {group.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-cyan-500 px-2 py-2 text-xs text-cyan-200 disabled:opacity-50"
                          disabled={pendingId === group.id}
                          onClick={() => void runEditName(group)}
                          type="button"
                        >
                          Guardar nombre
                        </button>
                        <button
                          className="rounded-md border border-cyan-500 px-2 py-2 text-xs text-cyan-200 disabled:opacity-50"
                          disabled={pendingId === group.id}
                          onClick={() => void runAssignProject(group)}
                          type="button"
                        >
                          Asignar
                        </button>
                        <button
                          className="rounded-md border border-emerald-500 px-2 py-2 text-xs text-emerald-200 disabled:opacity-50"
                          disabled={pendingId === group.id || group.isAssigned || existingProjects.length === 0}
                          onClick={() => void runAssignExistingProject(group)}
                          type="button"
                        >
                          Vincular existente
                        </button>
                        <button
                          className="rounded-md border border-violet-500 px-2 py-2 text-xs text-violet-200 disabled:opacity-50"
                          disabled={pendingId === group.id || !group.isAssigned || groups.length < 2}
                          onClick={() => void runReassignProject(group)}
                          type="button"
                        >
                          Mover
                        </button>
                        <button
                          className="rounded-md border border-orange-500 px-2 py-2 text-xs text-orange-200 disabled:opacity-50"
                          disabled={pendingId === group.id}
                          onClick={() => void runResetProject(group)}
                          type="button"
                        >
                          Reiniciar
                        </button>
                        {group.isActive ? (
                          <button
                            className="rounded-md border border-amber-500 px-2 py-2 text-xs text-amber-200 disabled:opacity-50"
                            disabled={pendingId === group.id}
                            onClick={() => void runToggleActive(group, false)}
                            type="button"
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            className="rounded-md border border-emerald-500 px-2 py-2 text-xs text-emerald-200 disabled:opacity-50"
                            disabled={pendingId === group.id}
                            onClick={() => void runToggleActive(group, true)}
                            type="button"
                          >
                            Activar
                          </button>
                        )}
                        <button
                          className="rounded-md border border-red-500 px-2 py-2 text-xs text-red-200 disabled:opacity-50"
                          disabled={pendingId === group.id}
                          onClick={() => void runDeleteGroup(group)}
                          type="button"
                        >
                          Eliminar
                        </button>
                        <button
                          className="rounded-md border border-cyan-500 px-2 py-2 text-xs text-cyan-200 disabled:opacity-50"
                          disabled={pendingId === group.id || !group.isActive}
                          onClick={() => void runResetPassword(group)}
                          type="button"
                        >
                          Contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errors.bulk && <p className="text-sm text-red-300" role="alert">{errors.bulk}</p>}
    </section>
  );
}
