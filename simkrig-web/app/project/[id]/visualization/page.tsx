import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import DrillholeMap from "@/components/project/DrillholeMap";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getProject(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return project;
}

export default function ProjectVisualizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
          <div className="mx-auto max-w-5xl">
            <p className="text-slate-400">Cargando visualización…</p>
          </div>
        </main>
      }
    >
      <ProjectVisualizationContent params={params} />
    </Suspense>
  );
}

async function ProjectVisualizationContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-3xl font-bold">Proyecto no encontrado</h1>
          <Link
            className="mt-6 inline-block text-cyan-300 hover:text-cyan-200"
            href="/"
          >
            Volver a Mis Proyectos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          className="text-sm text-cyan-300 transition hover:text-cyan-200"
          href={`/project/${project.id}`}
        >
          ← Volver al proyecto
        </Link>
        <header className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <p className="text-sm font-semibold tracking-wide text-cyan-300">
            VISUALIZACIÓN DEL PROYECTO
          </p>
          <h1 className="mt-3 text-3xl font-bold">{project.name}</h1>
          <Link
            className="mt-5 inline-flex rounded-lg border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
            href={`/project/${project.id}/blocks`}
          >
            Bloques
          </Link>
        </header>
        <DrillholeMap projectId={project.id} />
      </div>
    </main>
  );
}
