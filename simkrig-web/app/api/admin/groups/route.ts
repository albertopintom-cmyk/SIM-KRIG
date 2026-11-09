import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { usernameToAuthEmail } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CreatedProject = {
  id: string;
  name: string;
};

function getText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text.length > 0 && text.length <= maximumLength ? text : null;
}

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

  const input =
    typeof body === "object" && body !== null
      ? body as Record<string, unknown>
      : {};
  const groupName = getText(input.groupName, 100);
  const username =
    typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  const projectName = getText(input.projectName, 100);
  if (!groupName || !projectName || !/^[a-z0-9_]{3,64}$/.test(username) || username === "admin") {
    return NextResponse.json(
      {
        error:
          "Ingresa un nombre de grupo, un usuario válido (3 a 64 caracteres: letras minúsculas, números o _) y un proyecto.",
      },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: `No se pudo verificar el rol: ${profileError.message}` },
      { status: 500 },
    );
  }
  if (profile?.role !== "admin" || !profile.is_active) {
    return NextResponse.json({ error: "Acceso exclusivo para administradores." }, { status: 403 });
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No está disponible la configuración administrativa.",
      },
      { status: 500 },
    );
  }

  const { data: existingProfile, error: usernameError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (usernameError) {
    return NextResponse.json(
      { error: `No se pudo validar el usuario: ${usernameError.message}` },
      { status: 500 },
    );
  }
  if (existingProfile) {
    return NextResponse.json({ error: "Ese usuario ya está registrado." }, { status: 409 });
  }

  const temporaryPassword = randomBytes(18).toString("base64url");
  const { data: authData, error: createUserError } =
    await admin.auth.admin.createUser({
      email: usernameToAuthEmail(username),
      password: temporaryPassword,
      email_confirm: true,
    });

  if (createUserError || !authData.user) {
    return NextResponse.json(
      {
        error: createUserError
          ? `No se pudo crear la cuenta Auth: ${createUserError.message}`
          : "Supabase Auth no devolvió la cuenta creada.",
      },
      { status: 500 },
    );
  }

  const userId = authData.user.id;
  let createdProject: CreatedProject | null = null;
  let failure: string | null = null;

  const { error: profileUpsertError } = await admin
    .from("user_profiles")
    .upsert(
      {
        id: userId,
        username,
        role: "student_group",
        display_name: groupName,
        is_active: true,
      },
      { onConflict: "id" },
    );

  if (profileUpsertError) {
    failure = `No se pudo guardar el perfil: ${profileUpsertError.message}`;
  } else {
    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({
        name: projectName,
        description: `Proyecto asignado al grupo ${username}.`,
        status: "active",
        project_type: "group",
        owner_id: user.id,
      })
      .select("id, name")
      .single();

    if (projectError || !project) {
      failure = projectError
        ? `No se pudo crear el proyecto: ${projectError.message}`
        : "La base de datos no devolvió el proyecto creado.";
    } else {
      createdProject = project;
      const { error: assignmentError } = await admin
        .from("project_members")
        .insert({ user_id: userId, project_id: project.id });

      if (assignmentError) {
        failure = `No se pudo asignar el proyecto: ${assignmentError.message}`;
      }
    }
  }

  if (failure) {
    const cleanupErrors: string[] = [];

    if (createdProject) {
      const { error } = await admin
        .from("projects")
        .delete()
        .eq("id", createdProject.id);
      if (error) {
        cleanupErrors.push(`proyecto (${error.message})`);
      }
    }

    const { error: userCleanupError } =
      await admin.auth.admin.deleteUser(userId);
    if (userCleanupError) {
      cleanupErrors.push(`cuenta Auth (${userCleanupError.message})`);
    }

    return NextResponse.json(
      {
        error:
          cleanupErrors.length > 0
            ? `${failure} No se pudo completar la limpieza: ${cleanupErrors.join("; ")}.`
            : `${failure} Se eliminaron la cuenta y los datos creados para evitar un grupo incompleto.`,
      },
      { status: 500 },
    );
  }

  if (!createdProject) {
    return NextResponse.json(
      { error: "El grupo se creó sin un proyecto asociado." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    groupName,
    username,
    temporaryPassword,
    projectId: createdProject.id,
    projectName: createdProject.name,
  });
}
