import { Suspense } from "react";
import Link from "next/link";
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

async function getProjectFiles(id: string) {
  "use cache";

  const { data: files, error } = await supabase
    .from("project_files")
    .select("file_name, file_type, uploaded_at")
    .eq("project_id", id)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw error;
  }

  return files;
}

export default function ProjectDataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <ProjectDataContent params={params} />
    </Suspense>
  );
}

async function ProjectDataContent({
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
          <button
            className="rounded-lg bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            type="button"
          >
            Cargar Excel
          </button>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Archivos del Proyecto</h2>

          {files && files.length > 0 ? (
            <ul className="mt-6 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
              {files.map((file, index) => (
                <li
                  className="grid gap-2 p-5 sm:grid-cols-3"
                  key={`${file.file_name}-${file.uploaded_at}-${index}`}
                >
                  <p className="font-medium">{file.file_name}</p>
                  <p className="text-slate-300">{file.file_type}</p>
                  <p className="text-sm text-slate-400">{file.uploaded_at}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
              No existen archivos cargados
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
