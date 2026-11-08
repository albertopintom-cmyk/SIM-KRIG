import { Suspense } from "react";
import { redirect } from "next/navigation";
import GroupCreationForm from "@/components/admin/GroupCreationForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default function AdminGroupsPage() {
  return (
    <Suspense fallback={null}>
      <AdminGroupsContent />
    </Suspense>
  );
}

async function AdminGroupsContent() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }
  if (profile?.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
          ADMINISTRACIÓN
        </p>
        <h1 className="mt-3 text-3xl font-bold">Crear grupo</h1>
        <p className="mt-3 text-slate-400">
          Crea una cuenta para el grupo y asígnale su proyecto.
        </p>
        <GroupCreationForm />
      </div>
    </main>
  );
}
