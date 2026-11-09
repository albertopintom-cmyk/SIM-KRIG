import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import ProjectManagement, { type AdminProject } from "@/components/admin/ProjectManagement";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default function AdminProjectsPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-slate-300">Cargando proyectos…</main>}><AdminProjectsContent /></Suspense>;
}

async function AdminProjectsContent() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" || !profile.is_active) redirect("/");

  try {
    const admin = createSupabaseAdminClient();
    const { data: projectRows, error: projectsError } = await admin.from("projects")
      .select("id, name, description, project_type, owner_id, last_activity_at")
      .order("created_at", { ascending: false });
    if (projectsError) throw projectsError;
    const projectIds = (projectRows ?? []).map((project) => project.id);
    const { data: memberships, error: membersError } = projectIds.length
      ? await admin.from("project_members").select("user_id, project_id").in("project_id", projectIds)
      : { data: [], error: null };
    if (membersError) throw membersError;
    const userIds = [...new Set([
      ...(projectRows ?? []).map((project) => project.owner_id).filter((id): id is string => Boolean(id)),
      ...(memberships ?? []).map((membership) => membership.user_id),
    ])];
    const { data: profiles, error: profilesError } = userIds.length
      ? await admin.from("user_profiles").select("id, username, display_name").in("id", userIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profileById = new Map((profiles ?? []).map((item) => [item.id, item]));
    const groupByProject = new Map((memberships ?? []).map((member) => [member.project_id, member.user_id]));
    const projects: AdminProject[] = (projectRows ?? []).map((project) => {
      const assignedUserId = groupByProject.get(project.id);
      const ownerProfile = profileById.get(assignedUserId ?? project.owner_id ?? "");
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        projectType: project.project_type,
        ownerId: project.owner_id,
        ownerName: project.project_type === "group"
          ? ownerProfile?.display_name ?? ownerProfile?.username ?? "Grupo sin asignar"
          : ownerProfile?.username ?? "Sin propietario",
        lastActivityAt: project.last_activity_at,
      };
    });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">ADMINISTRACIÓN</p>
        <h1 className="mt-3 text-3xl font-bold">Todos los proyectos</h1>
        <p className="mt-3 text-slate-400">Administra tus proyectos docentes y consulta los proyectos de grupos.</p>
        <div className="mt-8"><ProjectManagement currentUserId={profile.userId} projects={projects} /></div>
      </div>
    </main>
  );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <h1 className="text-2xl font-bold">Error al cargar Proyectos</h1>
        <p className="mt-4 text-red-300" role="alert">{message}</p>
      </main>
    );
  }
}
