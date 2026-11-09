import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import GroupCreationForm from "@/components/admin/GroupCreationForm";
import GroupManagement, { type AdminGroup } from "@/components/admin/GroupManagement";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  try {
    const admin = createSupabaseAdminClient();
    const { data: profiles, error: groupsError } = await admin
      .from("user_profiles")
      .select("id, username, display_name, is_active")
      .eq("role", "student_group")
      .order("created_at", { ascending: false });
    if (groupsError) throw groupsError;

    const groupIds = (profiles ?? []).map((group) => group.id);
    const { data: memberships, error: membershipError } = groupIds.length
      ? await admin.from("project_members").select("user_id, project_id").in("user_id", groupIds)
      : { data: [], error: null };
    if (membershipError) throw membershipError;

    const projectIds = (memberships ?? []).map((membership) => membership.project_id);
    const { data: projects, error: projectsError } = projectIds.length
      ? await admin.from("projects").select("id, name").in("id", projectIds)
      : { data: [], error: null };
    if (projectsError) throw projectsError;

  const projectNames = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const groupProjects = new Map((memberships ?? []).map((membership) => [
    membership.user_id,
    projectNames.get(membership.project_id) ?? "Sin asignar",
  ]));
  const groups: AdminGroup[] = (profiles ?? []).map((group) => ({
    id: group.id,
    groupName: group.display_name ?? group.username,
    username: group.username,
    isActive: group.is_active,
    projectName: groupProjects.get(group.id) ?? "Sin asignar",
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
          ADMINISTRACIÓN
        </p>
        <h1 className="mt-3 text-3xl font-bold">Crear grupo</h1>
        <p className="mt-3 text-slate-400">
          Crea una cuenta para el grupo y asígnale su proyecto.
        </p>
        <GroupCreationForm />
        <GroupManagement groups={groups} />
      </div>
    </main>
  );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <h1 className="text-2xl font-bold">Error al cargar Grupos</h1>
        <p className="mt-4 text-red-300" role="alert">{message}</p>
      </main>
    );
  }
}
