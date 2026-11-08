import { Suspense } from "react";
import Link from "next/link";
import CutoffGradeAnalysis from "@/components/project/CutoffGradeAnalysis";
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

export default function ProjectCutoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
          <div className="mx-auto max-w-5xl">
            <p className="text-slate-400">Cargando análisis de ley de corte…</p>
          </div>
        </main>
      }
    >
      <ProjectCutoffContent params={params} />
    </Suspense>
  );
}

async function ProjectCutoffContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
          <h1 className="text-3xl font-bold">{project.name}</h1>
        </header>
        <CutoffGradeAnalysis projectId={project.id} />
      </div>
    </main>
  );
}
