import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { CONFIGURABLE_PERMISSIONS } from '@/lib/auth/permissions';
import { withApiRoute } from '@/lib/api/route';

const configurableRoles = ['manager', 'supervisor'] as const;
const permissionSchema = z.enum(CONFIGURABLE_PERMISSIONS);
const updateSchema = z.object({
  role: z.enum(configurableRoles),
  permission: permissionSchema,
  enabled: z.boolean(),
});

async function handleGET() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permission')
    .select('role, permission, enabled')
    .in('role', configurableRoles);

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat hak akses role' }, { status: 500 });
  }

  const roles = configurableRoles.map((role) => ({
    role,
    permissions: Object.fromEntries(
      CONFIGURABLE_PERMISSIONS.map((permission) => [
        permission,
        data?.find((row) => row.role === role && row.permission === permission)?.enabled ?? false,
      ])
    ),
  }));

  return NextResponse.json({ roles });
}

async function handlePATCH(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data permission tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permission')
    .upsert(parsed.data, { onConflict: 'role,permission' })
    .select('role, permission, enabled')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Gagal menyimpan hak akses role' }, { status: 500 });
  }

  return NextResponse.json({ permission: data });
}

export const GET = withApiRoute(handleGET);
export const PATCH = withApiRoute(handlePATCH, {
  rateLimit: { name: 'role-permission-write', limit: 60, windowMs: 10 * 60_000 },
});
