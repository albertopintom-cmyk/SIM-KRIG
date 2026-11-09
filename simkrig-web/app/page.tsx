import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-cyan-400">SIM-KRIG</h1>
        <Suspense
          fallback={<p className="mt-8 text-slate-400">Cargando usuario…</p>}
        >
          <AuthenticatedHome />
        </Suspense>
      </div>
    </main>
  );
}

async function AuthenticatedHome() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">Usuario autenticado</h2>
      <dl className="mt-5 space-y-3">
        <div>
          <dt className="text-sm text-slate-400">Username</dt>
          <dd className="mt-1 text-slate-100">{profile.username ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">Role</dt>
          <dd className="mt-1 text-slate-100">{profile.role ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
