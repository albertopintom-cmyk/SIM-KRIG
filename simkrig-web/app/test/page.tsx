import { supabase } from "@/lib/supabase";

export default async function TestSupabasePage() {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status");

  return (
    <main>
      <h1>SIM-KRIG - Test Supabase</h1>

      {error ? (
        <p>{error.message}</p>
      ) : projects && projects.length > 0 ? (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <p>Nombre: {project.name}</p>
              <p>Estado: {project.status}</p>
              <p>ID: {project.id}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay proyectos</p>
      )}
    </main>
  );
}
