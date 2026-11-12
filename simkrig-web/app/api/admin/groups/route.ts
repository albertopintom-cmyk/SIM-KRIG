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

  const action = typeof input.action === "string" ? input.action : null;
  if (action === "bulk-delete") {
    const requestedUserIds = Array.isArray(input.userIds)
      ? [...new Set(input.userIds.filter((value): value is string => typeof value === "string"))]
      : [];

    if (
      requestedUserIds.length === 0 ||
      requestedUserIds.some(
        (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
      )
    ) {
      return NextResponse.json({ error: "Debes elegir al menos un grupo para eliminar." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    const admin = createSupabaseAdminClient();
    const failures: string[] = [];

    for (const targetUserId of requestedUserIds) {
      try {
        const { data: targetProfile, error: targetProfileError } = await admin
          .from("user_profiles")
          .select("id, role")
          .eq("id", targetUserId)
          .maybeSingle();

        if (targetProfileError) {
          failures.push(`Grupo ${targetUserId}: ${targetProfileError.message}`);
          continue;
        }
        if (!targetProfile || targetProfile.role !== "student_group") {
          failures.push(`El usuario ${targetUserId} no es un grupo válido.`);
          continue;
        }

        const { data: memberships, error: membershipLookupError } = await admin
          .from("project_members")
          .select("project_id")
          .eq("user_id", targetUserId);

        if (membershipLookupError) {
          failures.push(`Grupo ${targetUserId}: ${membershipLookupError.message}`);
          continue;
        }

        const projectIds = (memberships ?? []).map((membership) => membership.project_id);
        const { data: assignedProjects, error: assignedProjectsError } = projectIds.length
          ? await admin
              .from("projects")
              .select("id, project_type")
              .in("id", projectIds)
          : { data: [], error: null };

        if (assignedProjectsError) {
          failures.push(`Grupo ${targetUserId}: ${assignedProjectsError.message}`);
          continue;
        }

        if (projectIds.length > 0) {
          const { error: memberCleanupError } = await admin
            .from("project_members")
            .delete()
            .eq("user_id", targetUserId);

          if (memberCleanupError) {
            failures.push(`Grupo ${targetUserId}: ${memberCleanupError.message}`);
            continue;
          }

          const managedProjectIds = (assignedProjects ?? [])
            .filter((project) => project.project_type === "group")
            .map((project) => project.id);
          const { error: projectCleanupError } = managedProjectIds.length
            ? await admin.from("projects").delete().in("id", managedProjectIds)
            : { error: null };

          if (projectCleanupError) {
            failures.push(`Grupo ${targetUserId}: ${projectCleanupError.message}`);
            continue;
          }
        }

        const { error: profileDeleteError } = await admin
          .from("user_profiles")
          .delete()
          .eq("id", targetUserId);

        if (profileDeleteError) {
          failures.push(`Grupo ${targetUserId}: ${profileDeleteError.message}`);
          continue;
        }

        const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetUserId);
        if (authDeleteError) {
          failures.push(`Grupo ${targetUserId}: ${authDeleteError.message}`);
        }
      } catch (error) {
        failures.push(
          `Grupo ${targetUserId}: ${error instanceof Error ? error.message : "Error inesperado."}`,
        );
      }
    }

    if (failures.length > 0) {
      return NextResponse.json(
        { error: `No se pudieron eliminar todos los grupos: ${failures.join("; ")}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, deletedCount: requestedUserIds.length });
  }

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
