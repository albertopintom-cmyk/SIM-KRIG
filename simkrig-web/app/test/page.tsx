import { supabase } from "@/lib/supabase";

export default async function TestSupabasePage() {
  let projects;
  let queryError: { message: string; name?: string; stack?: string } | null =
    null;
  let exceptionDetails: string | null = null;

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status");

    projects = data;
    if (error) {
      queryError = {
        message: error.message,
        name:
          "name" in error && typeof error.name === "string"
            ? error.name
            : undefined,
        stack:
          "stack" in error && typeof error.stack === "string"
            ? error.stack
            : undefined,
      };
    }
  } catch (error: unknown) {
    const details =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : typeof error === "object" && error !== null
          ? {
              name: "name" in error ? error.name : undefined,
              message: "message" in error ? error.message : undefined,
              stack: "stack" in error ? error.stack : undefined,
            }
          : {};

    exceptionDetails = JSON.stringify(details, null, 2);
  }

  return (
    <main>
      <h1>SIM-KRIG - Test Supabase</h1>
      <p>URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>

      {exceptionDetails ? (
        <pre>{exceptionDetails}</pre>
      ) : queryError ? (
        <section>
          <p>error.message: {queryError.message}</p>
          <p>error.name: {queryError.name ?? "No disponible"}</p>
          {queryError.stack ? <pre>error.stack: {queryError.stack}</pre> : null}
        </section>
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
