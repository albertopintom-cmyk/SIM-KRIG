import { Suspense } from "react";
import Link from "next/link";
import DrillholeMap from "@/components/project/DrillholeMap";
import { supabase } from "@/lib/supabase";

async function getProject(id: string) {
  "use cache";

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
    <Suspense fallback={null}>
      <ProjectVisualizationContent params={params} />
    </Suspense>
  );
}

async function ProjectVisualizationContent({
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
          <p className="text-sm font-semibold tracking-wide text-cyan-300">
            VISUALIZACIÓN DEL PROYECTO
          </p>
          <h1 className="mt-3 text-3xl font-bold">{project.name}</h1>
        </header>
        <DrillholeMap projectId={project.id} />
      </div>
    </main>
  );
}
