import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
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
    return NextResponse.json({ error: "Ingresa un nombre de hasta 100 caracteres y una descripción de hasta 1000." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (profile?.role !== "admin" || !profile.is_active) {
    return NextResponse.json({ error: "Acceso exclusivo para administradores." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: project, error } = await admin.from("projects").insert({
    name,
    description,
    status: "active",
    project_type: "teacher",
    owner_id: user.id,
  }).select("id, name, description, status, project_type, owner_id, last_activity_at").single();
  if (error) return NextResponse.json({ error: `No se pudo crear el proyecto: ${error.message}` }, { status: 500 });
  return NextResponse.json(project, { status: 201 });
}
