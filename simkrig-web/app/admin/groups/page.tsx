import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import GroupCreationForm from "@/components/admin/GroupCreationForm";
import GroupManagement, { type AdminGroup } from "@/components/admin/GroupManagement";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ExistingProjectOption = {
  id: string;
  name: string;
  projectType: string;
};

export default function AdminGroupsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
              ADMINISTRACIÓN
            </p>
            <h1 className="mt-3 text-3xl font-bold">Crear grupo</h1>
            <p className="mt-3 text-slate-400">
              Cargando administración…
            </p>
          </div>
        </main>
      }
    >
      <AdminGroupsContent />
    </Suspense>
  );
}

async function AdminGroupsContent() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "admin" || !profile.is_active) {
    redirect("/");
  }

  let groups: AdminGroup[] = [];
  let existingProjects: ExistingProjectOption[] = [];
  let errorMessage: string | null = null;

  try {
    const admin = createSupabaseAdminClient();
    const { data: profiles, error: groupsError } = await admin
      .from("user_profiles")
      .select("id, username, display_name, is_active")
      .eq("role", "student_group")
      .order("created_at", { ascending: false });
    if (groupsError) throw new Error(`Consulta user_profiles (grupos): ${groupsError.message}`);

    const groupIds = (profiles ?? []).map((group) => group.id);
    const { data: memberships, error: membershipError } = await admin
      .from("project_members")
      .select("user_id, project_id");
    if (membershipError) throw new Error(`Consulta project_members: ${membershipError.message}`);

    const { data: projects, error: projectsError } = await admin
      .from("projects")
      .select("id, name, project_type")
      .order("created_at", { ascending: false });
    if (projectsError) throw new Error(`Consulta projects: ${projectsError.message}`);

    const assignedProjectIds = new Set(
      (memberships ?? []).map((membership) => membership.project_id),
    );
    existingProjects = (projects ?? [])
      .filter((project) => !assignedProjectIds.has(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        projectType: project.project_type,
      }));

    const groupMemberships = (memberships ?? []).filter((membership) =>
      groupIds.includes(membership.user_id),
    );
    const projectIds = groupMemberships.map((membership) => membership.project_id);
    const { data: assignedProjects, error: assignedProjectsError } = projectIds.length
      ? await admin.from("projects").select("id, name").in("id", projectIds)
      : { data: [], error: null };
    if (assignedProjectsError) throw new Error(`Consulta projects asignados: ${assignedProjectsError.message}`);

    const projectNames = new Map(
      (assignedProjects ?? []).map((project) => [project.id, project.name]),
    );
    const projectByGroup = new Map(
      groupMemberships.map((membership) => [
        membership.user_id,
        projectNames.get(membership.project_id) ?? "Sin asignar",
      ]),
    );
    groups = (profiles ?? []).map((group) => ({
      id: group.id,
      groupName: group.display_name ?? group.username,
      username: group.username,
      isActive: group.is_active,
      isAssigned: projectByGroup.has(group.id),
      projectName: projectByGroup.get(group.id) ?? "Sin asignar",
    }));
  } catch (error) {
    errorMessage =
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : String(error);
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <h1 className="text-2xl font-bold">Error al cargar Grupos</h1>
        <p className="mt-4 text-red-300" role="alert">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
          ADMINISTRACIÓN
        </p>
        <h1 className="mt-3 text-3xl font-bold">Crear grupo</h1>
        <p className="mt-3 text-slate-400">
          Crea y administra grupos. También puedes vincular proyectos existentes sin borrar sus datos.
        </p>
        <GroupCreationForm />
        <GroupManagement groups={groups} existingProjects={existingProjects} />
      </div>
    </main>
  );
}
