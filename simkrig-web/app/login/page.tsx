import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
          SIM-KRIG
        </p>
        <h1 className="mt-3 text-2xl font-bold">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ingresa con el usuario y la contraseña asignados.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
