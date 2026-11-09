import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  getCurrentProfile,
  getServerSupabaseClientForRequest,
} from "@/lib/auth/getCurrentProfile";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
};

function ProjectCards({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="mt-5 rounded-xl border border-dashed border-slate-700 px-6 py-10 text-center text-slate-400">No hay proyectos asignados.</p>;
  }
  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <article className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-6" key={project.id}>
          <h3 className="text-xl font-semibold">{project.name}</h3>
          <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{project.description}</p>
          <p className="mt-5 text-sm text-slate-300">Estado: {project.status ?? "Activo"}</p>
          <Link className="mt-6 self-start rounded-md border border-cyan-400 px-5 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400 hover:text-slate-950" href={`/project/${project.id}`}>
            Entrar
          </Link>
        </article>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">SIM-KRIG</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Plataforma de Evaluación de Recursos Minerales
          </h1>
        </header>
        <Suspense fallback={<p className="mt-16 text-slate-400">Cargando proyectos…</p>}>
          <RoleHome />
        </Suspense>
      </div>
    </main>
  );
}

async function RoleHome() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) redirect("/login");

  if (profile.role === "admin") {
    const supabase = await getServerSupabaseClientForRequest();
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, name, description, status, project_type, owner_id")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ownProjects = (projects ?? []).filter(
      (project) => project.project_type === "teacher" && project.owner_id === profile.userId,
    );
    const groupProjects = (projects ?? []).filter((project) => project.project_type === "group");
    return (
      <>
        <section className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">PROYECTOS DOCENTE</p>
            <h2 className="mt-2 text-2xl font-semibold">Mis proyectos</h2>
          </div>
          <Link className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300" href="/admin/projects?new=1">
            Nuevo Proyecto
          </Link>
        </section>
        <ProjectCards projects={ownProjects} />
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Administración</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              ["/admin/groups", "Crear Grupo / Grupos"],
              ["/admin/progress", "Avance"],
              ["/admin/projects", "Todos los Proyectos"],
            ].map(([href, label]) => (
              <Link className="rounded-lg border border-slate-700 px-4 py-3 text-cyan-200 hover:border-cyan-400" href={href} key={href}>
                {label}
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Proyectos de grupos</h2>
          <ProjectCards projects={groupProjects} />
        </section>
      </>
    );
  }

  const supabase = await getServerSupabaseClientForRequest();
  const { data: memberships, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", profile.userId);
  if (membershipError) throw membershipError;
  const projectIds = (memberships ?? []).map((membership) => membership.project_id);
  const { data: projects, error: projectsError } = projectIds.length
    ? await supabase.from("projects").select("id, name, description, status").in("id", projectIds)
    : { data: [], error: null };
  if (projectsError) throw projectsError;
  return (
    <section className="mt-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">GRUPO</p>
      <h2 className="mt-2 text-2xl font-semibold">{profile.displayName ?? "Mi Grupo"}</h2>
      {(projects ?? []).map((project) => (
        <article className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6" key={project.id}>
          <h3 className="text-xl font-semibold">{project.name}</h3>
          <p className="mt-2 text-sm text-slate-400">{project.description}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              ["data", "Datos"],
              ["blocks", "Bloques"],
              ["visualization", "Visualización"],
              ["cutoff", "Ley de Corte"],
            ].map(([path, label]) => (
              <Link className="rounded-md border border-cyan-500 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10" href={`/project/${project.id}/${path}`} key={path}>
                {label}
              </Link>
            ))}
          </div>
        </article>
      ))}
      {projects?.length === 0 && <p className="mt-5 text-slate-400">No hay proyecto asignado.</p>}
    </section>
  );
}
