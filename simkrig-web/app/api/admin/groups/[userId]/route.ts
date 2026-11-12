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

  let body: unknown;
  let action: unknown;
  try {
    body = await request.json();
    action =
      typeof body === "object" && body !== null && "action" in body
        ? body.action
        : null;
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
  }
  if (
    action !== "reset-password" &&
    action !== "deactivate" &&
    action !== "activate" &&
    action !== "assign-project" &&
    action !== "assign-existing-project" &&
    action !== "reassign-project" &&
    action !== "reset-project" &&
    action !== "edit-name" &&
    action !== "delete-group"
  ) {
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

  if (action === "delete-group") {
    const { data: memberships, error: membershipLookupError } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    if (membershipLookupError) {
      return NextResponse.json(
        { error: `No se pudo consultar la asignación del grupo: ${membershipLookupError.message}` },
        { status: 500 },
      );
    }

    const projectIds = (memberships ?? []).map((membership) => membership.project_id);
    const { data: assignedProjects, error: assignedProjectsError } = projectIds.length
      ? await admin
          .from("projects")
          .select("id, project_type")
          .in("id", projectIds)
      : { data: [], error: null };

    if (assignedProjectsError) {
      return NextResponse.json(
        { error: `No se pudieron consultar los proyectos del grupo: ${assignedProjectsError.message}` },
        { status: 500 },
      );
    }

    if (projectIds.length > 0) {
      const { error: memberCleanupError } = await admin
        .from("project_members")
        .delete()
        .eq("user_id", userId);

      if (memberCleanupError) {
        return NextResponse.json(
          { error: `No se pudo limpiar la asignación del proyecto: ${memberCleanupError.message}` },
          { status: 500 },
        );
      }

      const managedProjectIds = (assignedProjects ?? [])
        .filter((project) => project.project_type === "group")
        .map((project) => project.id);
      const { error: projectCleanupError } = managedProjectIds.length
        ? await admin.from("projects").delete().in("id", managedProjectIds)
        : { error: null };

      if (projectCleanupError) {
        return NextResponse.json(
          { error: `No se pudo eliminar el proyecto del grupo: ${projectCleanupError.message}` },
          { status: 500 },
        );
      }
    }

    const { error: profileDeleteError } = await admin
      .from("user_profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) {
      return NextResponse.json(
        { error: `No se pudo eliminar el perfil del grupo: ${profileDeleteError.message}` },
        { status: 500 },
      );
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return NextResponse.json(
        { error: `El perfil se eliminó, pero no se pudo borrar la cuenta Auth: ${authDeleteError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "edit-name") {
    const requestedName =
      typeof body === "object" && body !== null && "groupName" in body
        ? String(body.groupName ?? "").trim()
        : "";

    if (!requestedName || requestedName.length > 100) {
      return NextResponse.json(
        { error: "Debes indicar un nombre de grupo válido." },
        { status: 400 },
      );
    }

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ display_name: requestedName })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: `No se pudo actualizar el nombre del grupo: ${updateError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, groupName: requestedName });
  }

  if (action === "activate") {
    const { error: profileUpdateError } = await admin
      .from("user_profiles")
      .update({ is_active: true })
      .eq("id", userId);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: `No se pudo reactivar el grupo: ${profileUpdateError.message}` },
        { status: 500 },
      );
    }

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });

    if (authError) {
      return NextResponse.json(
        { error: `No se pudo reactivar la cuenta Auth: ${authError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
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

  if (action === "assign-existing-project") {
    const projectId =
      typeof body === "object" && body !== null && "projectId" in body
        ? String(body.projectId ?? "")
        : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
      return NextResponse.json({ error: "El proyecto seleccionado no es válido." }, { status: 400 });
    }

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      return NextResponse.json(
        { error: `No se pudo consultar el proyecto: ${projectError.message}` },
        { status: 500 },
      );
    }
    if (!project) {
      return NextResponse.json({ error: "No se encontró el proyecto seleccionado." }, { status: 404 });
    }

    const { data: currentMembership, error: currentMembershipError } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentMembershipError) {
      return NextResponse.json(
        { error: `No se pudo consultar la asignación actual: ${currentMembershipError.message}` },
        { status: 500 },
      );
    }
    if (currentMembership) {
      return NextResponse.json(
        { error: "El grupo ya tiene un proyecto asignado. Desvincula o reasigna ese proyecto antes de continuar." },
        { status: 409 },
      );
    }

    const { data: existingMembership, error: existingMembershipError } = await admin
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .maybeSingle();

    if (existingMembershipError) {
      return NextResponse.json(
        { error: `No se pudo comprobar si el proyecto ya está asignado: ${existingMembershipError.message}` },
        { status: 500 },
      );
    }
    if (existingMembership) {
      return NextResponse.json(
        { error: "El proyecto ya está asignado a otro grupo." },
        { status: 409 },
      );
    }

    const { error: assignmentError } = await admin
      .from("project_members")
      .insert({ user_id: userId, project_id: projectId });

    if (assignmentError) {
      return NextResponse.json(
        { error: `No se pudo vincular el proyecto existente: ${assignmentError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      projectName: project.name,
    });
  }

  if (action === "reassign-project") {
    const targetUserId =
      typeof body === "object" && body !== null && "targetUserId" in body
        ? String(body.targetUserId ?? "")
        : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return NextResponse.json({ error: "Debes elegir un grupo válido para recibir el proyecto." }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: "El grupo no puede reasignarse a sí mismo." }, { status: 400 });
    }

    const { data: targetGroup, error: targetError } = await admin
      .from("user_profiles")
      .select("id, role, is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json({ error: `No se pudo validar el grupo destino: ${targetError.message}` }, { status: 500 });
    }
    if (!targetGroup || targetGroup.role !== "student_group") {
      return NextResponse.json({ error: "No se encontró un grupo válido como destino." }, { status: 404 });
    }

    const { data: sourceMembership, error: sourceMembershipError } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (sourceMembershipError) {
      return NextResponse.json(
        { error: `No se pudo leer la asignación del grupo origen: ${sourceMembershipError.message}` },
        { status: 500 },
      );
    }

    if (!sourceMembership) {
      return NextResponse.json({ error: "El grupo de origen no tiene un proyecto asignado." }, { status: 409 });
    }

    const { data: targetMembership, error: targetMembershipError } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetMembershipError) {
      return NextResponse.json(
        { error: `No se pudo leer la asignación del grupo destino: ${targetMembershipError.message}` },
        { status: 500 },
      );
    }

    const sourceProjectId = sourceMembership.project_id;
    const targetProjectId = targetMembership?.project_id ?? null;

    if (sourceProjectId === targetProjectId) {
      return NextResponse.json({ error: "El grupo destino ya tiene ese proyecto asignado." }, { status: 409 });
    }

    if (targetMembership) {
      const { error: sourceDeleteError } = await admin
        .from("project_members")
        .delete()
        .eq("user_id", userId);

      if (sourceDeleteError) {
        return NextResponse.json(
          { error: `No se pudo liberar el proyecto del grupo origen: ${sourceDeleteError.message}` },
          { status: 500 },
        );
      }

      const { error: targetDeleteError } = await admin
        .from("project_members")
        .delete()
        .eq("user_id", targetUserId);

      if (targetDeleteError) {
        return NextResponse.json(
          { error: `No se pudo liberar el proyecto del grupo destino: ${targetDeleteError.message}` },
          { status: 500 },
        );
      }

      const { error: firstSwapError } = await admin
        .from("project_members")
        .upsert({ user_id: userId, project_id: targetProjectId! }, { onConflict: "user_id" });

      if (firstSwapError) {
        return NextResponse.json(
          { error: `No se pudo asignar el proyecto al grupo origen: ${firstSwapError.message}` },
          { status: 500 },
        );
      }

      const { error: secondSwapError } = await admin
        .from("project_members")
        .upsert({ user_id: targetUserId, project_id: sourceProjectId }, { onConflict: "user_id" });

      if (secondSwapError) {
        return NextResponse.json(
          { error: `No se pudo mover el proyecto al grupo destino: ${secondSwapError.message}` },
          { status: 500 },
        );
      }
    } else {
      const { error: sourceDeleteError } = await admin
        .from("project_members")
        .delete()
        .eq("user_id", userId);

      if (sourceDeleteError) {
        return NextResponse.json(
          { error: `No se pudo liberar el proyecto del grupo origen: ${sourceDeleteError.message}` },
          { status: 500 },
        );
      }

      const { error: transferError } = await admin
        .from("project_members")
        .upsert({ user_id: targetUserId, project_id: sourceProjectId }, { onConflict: "user_id" });

      if (transferError) {
        return NextResponse.json(
          { error: `No se pudo transferir el proyecto al grupo destino: ${transferError.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "reset-project") {
    const { data: currentMembership, error: currentMembershipError } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentMembershipError) {
      return NextResponse.json(
        { error: `No se pudo consultar la asignación del proyecto: ${currentMembershipError.message}` },
        { status: 500 },
      );
    }

    if (!currentMembership) {
      return NextResponse.json({ error: "El grupo no tiene un proyecto asignado para reiniciar." }, { status: 409 });
    }

    const previousProjectId = currentMembership.project_id;
    const { data: previousProject, error: previousProjectError } = await admin
      .from("projects")
      .select("id, project_type")
      .eq("id", previousProjectId)
      .maybeSingle();

    if (previousProjectError) {
      return NextResponse.json(
        { error: `No se pudo consultar el proyecto actual: ${previousProjectError.message}` },
        { status: 500 },
      );
    }

    if (!previousProject) {
      return NextResponse.json({ error: "No se encontró el proyecto actual del grupo." }, { status: 404 });
    }

    const resetName = `Proyecto reiniciado - ${new Date().toISOString().slice(0, 10)}`;

    const { data: newProject, error: projectError } = await admin
      .from("projects")
      .insert({
        name: resetName,
        description: `Proyecto reiniciado para el grupo ${userId}.`,
        status: "active",
        project_type: "group",
        owner_id: user.id,
      })
      .select("id, name")
      .single();

    if (projectError || !newProject) {
      return NextResponse.json(
        {
          error: projectError
            ? `No se pudo crear el proyecto reiniciado: ${projectError.message}`
            : "La base de datos no devolvió el proyecto creado.",
        },
        { status: 500 },
      );
    }

    const { error: transferError } = await admin
      .from("project_members")
      .update({ project_id: newProject.id })
      .eq("user_id", userId);

    if (transferError) {
      return NextResponse.json(
        { error: `No se pudo transferir la asignación al nuevo proyecto: ${transferError.message}` },
        { status: 500 },
      );
    }

    if (previousProject.project_type === "group") {
      const { error: cleanupError } = await admin
        .from("projects")
        .delete()
        .eq("id", previousProjectId);

      if (cleanupError) {
        return NextResponse.json(
          { error: `El proyecto nuevo se creó, pero no se pudo limpiar el anterior: ${cleanupError.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true, projectId: newProject.id, projectName: newProject.name });
  }

  if (action === "assign-project") {
    const projectName =
      typeof body === "object" && body !== null && "projectName" in body
        ? String(body.projectName ?? "").trim()
        : "";

    if (!projectName || projectName.length > 100) {
      return NextResponse.json(
        { error: "Debes indicar un nombre de proyecto válido para asignar al grupo." },
        { status: 400 },
      );
    }

    const { data: createdProject, error: projectError } = await admin
      .from("projects")
      .insert({
        name: projectName,
        description: `Proyecto asignado al grupo ${userId}.`,
        status: "active",
        project_type: "group",
        owner_id: user.id,
      })
      .select("id, name")
      .single();

    if (projectError || !createdProject) {
      return NextResponse.json(
        {
          error: projectError
            ? `No se pudo crear el proyecto: ${projectError.message}`
            : "La base de datos no devolvió el proyecto creado.",
        },
        { status: 500 },
      );
    }

    const { error: assignmentError } = await admin
      .from("project_members")
      .upsert(
        { user_id: userId, project_id: createdProject.id },
        { onConflict: "user_id" },
      );

    if (assignmentError) {
      const { error: cleanupError } = await admin
        .from("projects")
        .delete()
        .eq("id", createdProject.id);

      return NextResponse.json(
        {
          error: cleanupError
            ? `No se pudo asignar el proyecto: ${assignmentError.message}. Además, la limpieza del proyecto falló: ${cleanupError.message}.`
            : `No se pudo asignar el proyecto: ${assignmentError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, projectId: createdProject.id, projectName: createdProject.name });
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
