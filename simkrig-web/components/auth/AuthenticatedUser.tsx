import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import SignOutButton from "@/components/auth/SignOutButton";

export default async function AuthenticatedUser() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return null;
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950 px-6 py-3 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">
          Sesión:{" "}
          <strong className="text-slate-100">
            {profile.username ?? profile.email}
          </strong>
          {profile.role && (
            <span className="ml-2 text-slate-500">({profile.role})</span>
          )}
        </p>
        <div className="flex items-center gap-4">
          {profile.role === "admin" && (
            <>
              <Link className="text-sm font-medium text-cyan-300 hover:text-cyan-200" href="/admin/groups">Grupos</Link>
              <Link className="text-sm font-medium text-cyan-300 hover:text-cyan-200" href="/admin/progress">Avance</Link>
              <Link className="text-sm font-medium text-cyan-300 hover:text-cyan-200" href="/admin/projects">Proyectos</Link>
            </>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
