import Link from "next/link";

export default function Home() {
  const modules = [
    "Polígonos de Influencia",
    "Cálculo de Áreas",
    "Potencias",
    "Volúmenes",
    "Densidades",
    "Recursos Minerales",
    "Leyes",
    "Finos",
    "Ley Media",
    "Ley de Corte",
    "Curvas Tonelaje-Ley",
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">

        <h1 className="text-5xl font-bold text-center">
          SIM-KRIG
        </h1>

        <p className="text-center text-slate-300 mt-4 mb-12">
          Plataforma de Simulación y Estimación de Recursos Minerales
        </p>

        <h2 className="text-3xl font-semibold mb-8">
          Módulos Metodológicos
        </h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {modules.map((module, index) => {
            const isAvailable = index === 0;
            const Card = (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-yellow-400 text-2xl mb-4">
                  {isAvailable ? "⌗" : "🚧"}
                </div>

                <h3 className="font-semibold text-xl">{module}</h3>

                <p className="text-slate-400 mt-2">
                  {isAvailable ? "Abrir constructor" : "Próximamente"}
                </p>
              </div>
            );

            return isAvailable ? (
              <Link
                aria-label="Abrir el módulo Polígonos de Influencia"
                className="transition-transform hover:-translate-y-1"
                href="/modules/polygons"
                key={module}
              >
                {Card}
              </Link>
            ) : (
              <div key={module}>{Card}</div>
            );
          })}

        </div>

      </div>
    </main>
  );
}