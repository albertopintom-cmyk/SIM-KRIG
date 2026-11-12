import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
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
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!name || name.length > 100 || description.length > 1000) {
    return NextResponse.json({ error: "Nombre o descripción no válidos." }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("role, is_active").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (profile?.role !== "admin" || !profile.is_active) {
    return NextResponse.json({ error: "Acceso exclusivo para administradores." }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  const { data: updated, error } = await admin.from("projects").update({
    name,
    description,
  }).eq("id", projectId)
    .select("id, name, description, status").maybeSingle();
  if (error) return NextResponse.json({ error: `No se pudo actualizar: ${error.message}` }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "No se encontró el proyecto." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  }
  const { projectId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "El proyecto no es válido." }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("role, is_active").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (profile?.role !== "admin" || !profile.is_active) {
    return NextResponse.json({ error: "Acceso exclusivo para administradores." }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  const { data: project, error: ownershipError } = await admin.from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (ownershipError) {
    return NextResponse.json({ error: `No se pudo verificar el proyecto: ${ownershipError.message}` }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "No se encontró el proyecto." }, { status: 404 });
  }
  const { error: resetError } = await admin.rpc("reset_project_data", {
    p_project_id: projectId,
  });
  if (resetError) {
    return NextResponse.json({ error: `No se pudieron eliminar los datos del proyecto: ${resetError.message}` }, { status: 500 });
  }
  const { data: deleted, error } = await admin.from("projects").delete()
    .eq("id", projectId)
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ error: `No se pudo eliminar: ${error.message}` }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "No se encontró un proyecto docente propio." }, { status: 404 });
  return NextResponse.json({ success: true });
}
