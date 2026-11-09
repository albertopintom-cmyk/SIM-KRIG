import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  }
  const { projectId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "El proyecto no es válido." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
  }
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const averageGrade = input.averageGrade === null ? null : input.averageGrade;
  if (
    !isFiniteNumber(input.cutoffGrade) || input.cutoffGrade < 0 ||
    !isFiniteNumber(input.recoverableTonnage) || input.recoverableTonnage < 0 ||
    !isFiniteNumber(averageGrade) && averageGrade !== null ||
    !isFiniteNumber(input.fineMetal) || input.fineMetal < 0 ||
    !Number.isInteger(input.mineralBlockCount) || (input.mineralBlockCount as number) < 0 ||
    !Number.isInteger(input.wasteBlockCount) || (input.wasteBlockCount as number) < 0
  ) {
    return NextResponse.json({ error: "Los valores del cálculo no son válidos." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const { data: project, error: projectError } = await supabase
    .from("projects").select("id").eq("id", projectId).maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "No tienes acceso a este proyecto." }, { status: 403 });

  const { error } = await supabase.from("cutoff_runs").insert({
    project_id: projectId,
    created_by: user.id,
    cutoff_grade: input.cutoffGrade,
    recoverable_tonnage: input.recoverableTonnage,
    average_grade: averageGrade,
    fine_metal: input.fineMetal,
    mineral_block_count: input.mineralBlockCount,
    waste_block_count: input.wasteBlockCount,
  });
  if (error) return NextResponse.json({ error: `No se pudo guardar el cálculo: ${error.message}` }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
