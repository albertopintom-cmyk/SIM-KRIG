import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, status")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <header className="flex flex-col items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            SIM-KRIG
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Plataforma de Evaluación de Recursos Minerales
          </h1>
          <button
            className="mt-8 rounded-lg bg-cyan-400 px-8 py-4 text-lg font-semibold text-slate-950 transition hover:bg-cyan-300"
            type="button"
          >
            Nuevo Proyecto
          </button>
        </header>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">Mis Proyectos</h2>

          {projects && projects.length > 0 ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <article
                  className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-6"
                  key={project.id}
                >
                  <h3 className="text-xl font-semibold">{project.name}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">
                    {project.description}
                  </p>
                  <p className="mt-5 text-sm text-slate-300">
                    Estado: <span className="font-medium">{project.status}</span>
                  </p>
                  <button
                    className="mt-6 self-start rounded-md border border-cyan-400 px-5 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
                    type="button"
                  >
                    Entrar
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
              No existen proyectos registrados
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
