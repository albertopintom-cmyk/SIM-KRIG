import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type GroupProgress = {
  groupName: string;
  projectName: string;
  fileCount: number;
  blockCount: number;
  cutoffStatus: string;
  lastActivity: string;
};

export default function AdminProgressPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-slate-300">Cargando avance…</main>}><AdminProgressContent /></Suspense>;
}

async function AdminProgressContent() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" || !profile.is_active) redirect("/");

  const admin = createSupabaseAdminClient();
  const { data: projects, error: projectsError } = await admin.from("projects")
    .select("id, name, last_activity_at")
    .eq("project_type", "group")
    .order("last_activity_at", { ascending: false });
  if (projectsError) throw projectsError;
  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: memberships, error: membershipsError } = projectIds.length
    ? await admin.from("project_members").select("user_id, project_id").in("project_id", projectIds)
    : { data: [], error: null };
  if (membershipsError) throw membershipsError;
  const userIds = (memberships ?? []).map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("user_profiles").select("id, username, display_name").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) throw profilesError;
  const profilesById = new Map((profiles ?? []).map((item) => [item.id, item]));
  const membersByProject = new Map((memberships ?? []).map((item) => [item.project_id, item.user_id]));

  const rows: GroupProgress[] = await Promise.all((projects ?? []).map(async (project) => {
    const [files, blocks, cutoff] = await Promise.all([
      admin.from("project_files").select("id", { count: "exact", head: true }).eq("project_id", project.id),
      admin.from("estimation_blocks").select("id", { count: "exact", head: true }).eq("project_id", project.id),
      admin.from("cutoff_runs").select("created_at").eq("project_id", project.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (files.error) throw files.error;
    if (blocks.error) throw blocks.error;
    if (cutoff.error) throw cutoff.error;
    const group = profilesById.get(membersByProject.get(project.id) ?? "");
    return {
      groupName: group?.display_name ?? group?.username ?? "Grupo sin asignar",
      projectName: project.name,
      fileCount: files.count ?? 0,
      blockCount: blocks.count ?? 0,
      cutoffStatus: cutoff.data ? `Calculada (${new Date(cutoff.data.created_at).toLocaleDateString("es-CL")})` : "Pendiente",
      lastActivity: project.last_activity_at
        ? new Date(project.last_activity_at).toLocaleString("es-CL")
        : "Sin actividad",
    };
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">ADMINISTRACIÓN</p>
        <h1 className="mt-3 text-3xl font-bold">Avance de grupos</h1>
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="p-4">Grupo</th><th className="p-4">Proyecto</th>
                <th className="p-4">N° Archivos</th><th className="p-4">N° Bloques</th>
                <th className="p-4">Estado Ley de Corte</th><th className="p-4">Última Actividad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t border-slate-800" key={`${row.groupName}:${row.projectName}`}>
                  <td className="p-4">{row.groupName}</td><td className="p-4">{row.projectName}</td>
                  <td className="p-4">{row.fileCount}</td><td className="p-4">{row.blockCount}</td>
                  <td className="p-4">{row.cutoffStatus}</td><td className="p-4">{row.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-6 text-slate-400">Todavía no hay proyectos de grupo.</p>}
        </div>
      </div>
    </main>
  );
}
