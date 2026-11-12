import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import {
  getCurrentProfile,
  getServerSupabaseClientForRequest,
} from "@/lib/auth/getCurrentProfile";

type ProjectMember = {
  user_id: string;
  assigned_at: string;
};

type ProjectFile = {
  id: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
};

type EstimationBlock = {
  id: string;
  block_name: string;
  created_at: string;
};

type BlockVariable = {
  block_id: string;
  variable_name: string;
  unit: string;
};

const PAGE_SIZE = 500;

function formatDate(value: string | null) {
  if (!value) return "Sin actividad registrada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-CL");
}

async function loadAllPages<T>(
  loadPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  queryName: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${queryName}: ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-medium text-slate-400">{label}</h2>
      <p className="mt-3 text-2xl font-semibold text-slate-100">{value}</p>
    </article>
  );
}

export default function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-300">
          Cargando detalle del proyecto…
        </main>
      }
    >
      <AdminProjectDetail params={params} />
    </Suspense>
  );
}

async function AdminProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" || !profile.is_active) redirect("/");

  const { id } = await params;
  const supabase = await getServerSupabaseClientForRequest();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, description, status, project_type, owner_id, created_at, last_activity_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    throw new Error(`No se pudo cargar el proyecto: ${projectError.message}`);
  }
  if (!project) notFound();

  const [members, files, blocks] = await Promise.all([
    loadAllPages<ProjectMember>(
      async (from, to) =>
        await supabase
          .from("project_members")
          .select("user_id, assigned_at")
          .eq("project_id", id)
          .order("assigned_at", { ascending: true })
          .range(from, to),
      "No se pudieron cargar los miembros",
    ),
    loadAllPages<ProjectFile>(
      async (from, to) =>
        await supabase
          .from("project_files")
          .select("id, file_name, file_type, uploaded_at")
          .eq("project_id", id)
          .order("uploaded_at", { ascending: false })
          .range(from, to),
      "No se pudieron cargar los archivos",
    ),
    loadAllPages<EstimationBlock>(
      async (from, to) =>
        await supabase
          .from("estimation_blocks")
          .select("id, block_name, created_at")
          .eq("project_id", id)
          .order("created_at", { ascending: true })
          .range(from, to),
      "No se pudieron cargar los bloques",
    ),
  ]);

  const blockIds = blocks.map((block) => block.id);
  const variableRows: BlockVariable[] = [];
  for (let start = 0; start < blockIds.length; start += 100) {
    const blockIdBatch = blockIds.slice(start, start + 100);
    const batchRows = await loadAllPages<BlockVariable>(
      async (from, to) =>
        await supabase
          .from("block_variables")
          .select("block_id, variable_name, unit")
          .in("block_id", blockIdBatch)
          .order("variable_name", { ascending: true })
          .range(from, to),
      "No se pudieron cargar las variables",
    );
    variableRows.push(...batchRows);
  }

  const variableSummary = new Map<string, { unit: string; blockCount: number }>();
  const variableBlocks = new Map<string, Set<string>>();
  for (const variable of variableRows) {
    const blocksForVariable =
      variableBlocks.get(variable.variable_name) ?? new Set<string>();
    blocksForVariable.add(variable.block_id);
    variableBlocks.set(variable.variable_name, blocksForVariable);
    variableSummary.set(variable.variable_name, {
      unit: variable.unit,
      blockCount: blocksForVariable.size,
    });
  }
  const variables = [...variableSummary.entries()].map(([name, summary]) => ({
    name,
    ...summary,
  }));
  const lastActivity =
    project.last_activity_at ??
    files[0]?.uploaded_at ??
    blocks[blocks.length - 1]?.created_at ??
    null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link
          className="text-sm text-cyan-300 hover:text-cyan-200"
          href="/admin/projects"
        >
          ← Todos los proyectos
        </Link>
        <header className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            DETALLE ADMINISTRATIVO DEL PROYECTO
          </p>
          <h1 className="mt-3 text-3xl font-bold">{project.name}</h1>
          <p className="mt-3 text-slate-300">
            {project.description || "Sin descripción"}
          </p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-slate-400">Estado</dt>
              <dd className="mt-1">{project.status || "Sin estado"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Tipo de proyecto</dt>
              <dd className="mt-1">
                {project.project_type === "group" ? "Grupo" : "Docente"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Propietario (ID)</dt>
              <dd className="mt-1 break-all">{project.owner_id ?? "Sin propietario"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Creado</dt>
              <dd className="mt-1">{formatDate(project.created_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Última actividad</dt>
              <dd className="mt-1">
                {formatDate(project.last_activity_at ?? lastActivity)}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              href={`/project/${project.id}`}
            >
              Abrir espacio de trabajo
            </Link>
            <Link
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400"
              href="/modules/polygons"
            >
              Módulo de polígonos
            </Link>
          </div>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Módulos de trabajo disponibles</h2>
          <p className="mt-2 text-slate-400">
            Abre cada módulo en el contexto de este proyecto. Los módulos que aún no
            tienen una pantalla funcional se muestran en el espacio de trabajo como etapas pendientes.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Datos del proyecto", href: `/project/${project.id}/data` },
              { title: "Visualización de sondajes", href: `/project/${project.id}/visualization` },
              { title: "Generación de bloques", href: `/project/${project.id}/blocks` },
              { title: "Ley de corte", href: `/project/${project.id}/cutoff` },
            ].map((module) => (
              <Link
                className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-400"
                href={module.href}
                key={module.href}
              >
                <h3 className="font-semibold">{module.title}</h3>
                <span className="mt-3 inline-block text-sm text-cyan-300">Abrir módulo →</span>
              </Link>
            ))}
            <Link
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-400"
              href="/modules/polygons"
            >
              <h3 className="font-semibold">Polígonos de influencia</h3>
              <span className="mt-3 inline-block text-sm text-cyan-300">Abrir módulo →</span>
            </Link>
          </div>
        </section>

        <section
          aria-label="Resumen del proyecto"
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Metric label="Archivos" value={files.length} />
          <Metric label="Bloques generados" value={blocks.length} />
          <Metric label="Variables distintas" value={variables.length} />
          <Metric
            label="Última actividad"
            value={formatDate(project.last_activity_at ?? lastActivity)}
          />
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Miembros</h2>
          {members.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-slate-400">
              No hay miembros asignados a este proyecto.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    <th className="p-4">Usuario (ID)</th>
                    <th className="p-4">Fecha de asignación</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr className="border-t border-slate-800" key={member.user_id}>
                      <td className="break-all p-4">{member.user_id}</td>
                      <td className="p-4">{formatDate(member.assigned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Archivos</h2>
          {files.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-slate-400">
              No hay archivos cargados en este proyecto.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    <th className="p-4">Nombre de archivo</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Fecha de carga</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr className="border-t border-slate-800" key={file.id}>
                      <td className="break-all p-4">{file.file_name}</td>
                      <td className="p-4">{file.file_type || "—"}</td>
                      <td className="p-4">{formatDate(file.uploaded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Bloques de estimación</h2>
          {blocks.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-slate-400">
              No hay bloques generados para este proyecto.
            </p>
          ) : (
            <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
              Total de bloques generados:{" "}
              <strong className="text-cyan-300">{blocks.length}</strong>
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Variables disponibles</h2>
          {variables.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-slate-400">
              No hay variables registradas en los bloques.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    <th className="p-4">Variable</th>
                    <th className="p-4">Unidad</th>
                    <th className="p-4">Bloques con valor</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((variable) => (
                    <tr className="border-t border-slate-800" key={variable.name}>
                      <td className="p-4">{variable.name}</td>
                      <td className="p-4">{variable.unit || "—"}</td>
                      <td className="p-4">{variable.blockCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
