import { Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const stages = [
  "Datos",
  "Tablas",
  "Visualización",
  "Bloques",
  "Ley de Corte",
  "Geoestadística",
  "Recursos",
  "Reportes",
];

async function getProject(id: string) {
  "use cache";

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, description, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return project;
}

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

async function ProjectContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-4xl text-center">
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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link
          className="text-sm text-cyan-300 transition hover:text-cyan-200"
          href="/"
        >
          ← Mis Proyectos
        </Link>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <h1 className="text-3xl font-bold">Proyecto: {project.name}</h1>
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Descripción
            </h2>
            <p className="mt-2 leading-7 text-slate-200">
              {project.description || "Sin descripción"}
            </p>
          </div>
          <p className="mt-5 text-slate-300">
            Estado: <span className="font-medium">{project.status}</span>
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-wide">
            ETAPAS DEL PROYECTO
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stages.map((stage) =>
              stage === "Datos" ||
              stage === "Visualización" ||
              stage === "Bloques" ||
              stage === "Ley de Corte" ? (
                <Link
                  className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-cyan-400"
                  href={`/project/${project.id}/${stage === "Datos" ? "data" : stage === "Visualización" ? "visualization" : stage === "Bloques" ? "blocks" : "cutoff"}`}
                  key={stage}
                >
                  <h3 className="text-lg font-semibold">{stage}</h3>
                </Link>
              ) : (
                <article
                  className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                  key={stage}
                >
                  <h3 className="text-lg font-semibold">{stage}</h3>
                </article>
              ),
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
