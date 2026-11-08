import { Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ProjectDataFiles from "@/components/project/ProjectDataFiles";
import ResetProjectButton from "@/components/project/ResetProjectButton";

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

async function getProjectFiles(id: string) {
  const { data: files, error } = await supabase
    .from("project_files")
    .select("id, file_name, file_type, uploaded_at")
    .eq("project_id", id)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error(error);
    throw error;
  }

  return files;
}

export default function ProjectDataPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <ProjectDataContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectDataContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  const { id } = await params;
  const { reset } = await searchParams;
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

  const files = await getProjectFiles(id);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link
          className="text-sm text-cyan-300 transition hover:text-cyan-200"
          href={`/project/${project.id}`}
        >
          ← Volver al proyecto
        </Link>

        <header className="mt-8 flex flex-col gap-6 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-cyan-300">
              DATOS DEL PROYECTO
            </p>
            <h1 className="mt-3 text-3xl font-bold">{project.name}</h1>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Link
              className="rounded-lg bg-cyan-400 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
              href="#excel-import"
            >
              Cargar Excel
            </Link>
            <ResetProjectButton projectId={project.id} />
          </div>
        </header>

        {reset === "success" && (
          <p
            className="mt-6 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-200"
            role="status"
          >
            Proyecto reiniciado correctamente
          </p>
        )}

        <ProjectDataFiles projectId={project.id} initialFiles={files ?? []} />
      </div>
    </main>
  );
}
