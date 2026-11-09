import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  }

  const { userId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: "El usuario no es válido." }, { status: 400 });
  }

  let action: unknown;
  try {
    const body: unknown = await request.json();
    action =
      typeof body === "object" && body !== null && "action" in body
        ? body.action
        : null;
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
  }
  if (action !== "reset-password" && action !== "deactivate") {
    return NextResponse.json({ error: "La acción no es válida." }, { status: 400 });
  }

  const sessionClient = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }
  const { data: requester, error: requesterError } = await sessionClient
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (requesterError) {
    return NextResponse.json({ error: `No se pudo verificar el rol: ${requesterError.message}` }, { status: 500 });
  }
  if (requester?.role !== "admin" || !requester.is_active) {
    return NextResponse.json({ error: "Acceso exclusivo para administradores." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: group, error: groupError } = await admin
    .from("user_profiles")
    .select("id, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (groupError) {
    return NextResponse.json({ error: `No se pudo cargar el grupo: ${groupError.message}` }, { status: 500 });
  }
  if (!group || group.role !== "student_group") {
    return NextResponse.json({ error: "No se encontró el grupo solicitado." }, { status: 404 });
  }

  if (action === "deactivate") {
    const { error: profileUpdateError } = await admin
      .from("user_profiles")
      .update({ is_active: false })
      .eq("id", userId);
    if (profileUpdateError) {
      return NextResponse.json({ error: `No se pudo desactivar el grupo: ${profileUpdateError.message}` }, { status: 500 });
    }

    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
    if (banError) {
      const { error: rollbackError } = await admin
        .from("user_profiles")
        .update({ is_active: true })
        .eq("id", userId);
      return NextResponse.json(
        {
          error: rollbackError
            ? `No se pudo bloquear la cuenta Auth (${banError.message}) ni restaurar el perfil (${rollbackError.message}).`
            : `No se pudo bloquear la cuenta Auth: ${banError.message}`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  }

  if (!group.is_active) {
    return NextResponse.json({ error: "El grupo está desactivado." }, { status: 409 });
  }
  const temporaryPassword = randomBytes(18).toString("base64url");
  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    ban_duration: "none",
  });
  if (passwordError) {
    return NextResponse.json({ error: `No se pudo resetear la contraseña: ${passwordError.message}` }, { status: 500 });
  }
  return NextResponse.json({ temporaryPassword });
}
