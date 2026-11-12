import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  getCurrentProfile,
  getServerSupabaseClientForRequest,
} from "@/lib/auth/getCurrentProfile";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
          <p className="mx-auto max-w-4xl text-slate-400">
            Preparando tu espacio de trabajo…
          </p>
        </main>
      }
    >
      <HomeRedirect />
    </Suspense>
  );
}

async function HomeRedirect() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    redirect("/admin/projects");
  }

  if (profile.role !== "student_group") {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-cyan-400">SIM-KRIG</h1>
          <p className="mt-4 text-slate-300">
            La cuenta no tiene un rol habilitado para acceder a un espacio de
            trabajo.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await getServerSupabaseClientForRequest();
  const { data: assignment, error } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", profile.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!assignment) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            SIM-KRIG
          </p>
          <h1 className="mt-4 text-2xl font-bold text-white">
            Tu cuenta aún no tiene un proyecto asignado
          </h1>
          <p className="mt-4 text-slate-300">
            La cuenta ingresada está activa, pero no está vinculada a ningún
            proyecto de trabajo. Contacta a tu docente o administrador para
            asignarte un proyecto antes de continuar.
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            Volver a iniciar sesión
          </a>
        </div>
      </main>
    );
  }

  redirect(`/project/${assignment.project_id}`);
}
