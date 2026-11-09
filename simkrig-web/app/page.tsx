import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-cyan-400">SIM-KRIG</h1>
        <Suspense
          fallback={<p className="mt-8 text-slate-400">Cargando panel…</p>}
        >
          <AdministrationPanel />
        </Suspense>
      </div>
    </main>
  );
}

async function AdministrationPanel() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-2xl font-semibold">Panel de Administración</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-slate-400">Usuario autenticado</dt>
          <dd className="mt-1 font-medium text-slate-100">
            {profile.username ?? profile.email ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">Rol</dt>
          <dd className="mt-1 font-medium text-slate-100">
            {profile.role ?? "—"}
          </dd>
        </div>
      </dl>
      {profile.role === "admin" && (
        <nav aria-label="Administración" className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-lg border border-cyan-500 px-5 py-3 font-medium text-cyan-200 hover:bg-cyan-500/10"
            href="/admin/groups"
          >
            Grupos
          </Link>
          <Link
            className="rounded-lg border border-cyan-500 px-5 py-3 font-medium text-cyan-200 hover:bg-cyan-500/10"
            href="/admin/projects"
          >
            Proyectos
          </Link>
          <Link
            className="rounded-lg border border-cyan-500 px-5 py-3 font-medium text-cyan-200 hover:bg-cyan-500/10"
            href="/admin/progress"
          >
            Avance
          </Link>
        </nav>
      )}
    </section>
  );
}
