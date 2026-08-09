import { createAdminClient } from '@/lib/supabase/server';
import type { Invite, UserRole } from '@/types/database';
import { generateToken } from '@/lib/utils';

export interface InviteCursor {
  createdAt: string;
  id: string;
}

export function encodeInviteCursor(cursor: InviteCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeInviteCursor(value: string | null): InviteCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<InviteCursor>;
    if (
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id) ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export async function getInviteByToken(token: string) {
  const supabase = await createAdminClient();
  const { data } = await supabase.from('invite').select('*').eq('token', token).maybeSingle();

  return data;
}

export async function listInvites(input: {
  limit?: number;
  search?: string;
  cursor?: InviteCursor | null;
}) {
  const supabase = await createAdminClient();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  let query = supabase
    .from('invite')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  const search = input.search?.trim().replace(/[\\%_]/g, (value) => `\\${value}`);
  if (search) query = query.ilike('invite_name', `%${search}%`);

  if (input.cursor) {
    query = query.or(
      `created_at.lt.${input.cursor.createdAt},and(created_at.eq.${input.cursor.createdAt},id.lt.${input.cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const invites = (data ?? []) as Invite[];
  const hasMore = invites.length > limit;
  const page = hasMore ? invites.slice(0, limit) : invites;
  const last = page.at(-1);

  return {
    invites: page,
    nextCursor:
      hasMore && last ? encodeInviteCursor({ createdAt: last.created_at, id: last.id }) : null,
  };
}

export function isInviteValid(invite: { used_at: string | null; expires_at: string }): {
  valid: boolean;
  reason?: string;
} {
  if ('revoked_at' in invite && invite.revoked_at) {
    return { valid: false, reason: 'Link undangan sudah dicabut' };
  }
  if (invite.used_at) {
    return { valid: false, reason: 'Link undangan sudah digunakan' };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { valid: false, reason: 'Link undangan sudah kedaluwarsa' };
  }
  return { valid: true };
}

export async function consumeInviteRegistration(input: {
  token: string;
  userId: string;
  email: string;
  fullName: string;
}) {
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('consume_invite', {
    p_token: input.token,
    p_user_id: input.userId,
    p_email: input.email,
    p_full_name: input.fullName,
  });

  if (error) throw error;
  return data;
}

export async function completeGoogleInvite(input: {
  token: string;
  userId: string;
  email: string;
  fullName: string;
}) {
  const invite = await getInviteByToken(input.token);
  if (!invite) throw new Error('Link undangan tidak ditemukan');

  const check = isInviteValid(invite);
  if (!check.valid) throw new Error(check.reason ?? 'Link undangan tidak valid');

  const supabase = await createAdminClient();
  const { data: emailOwner } = await supabase
    .from('users')
    .select('id')
    .ilike('email', input.email)
    .neq('id', input.userId)
    .maybeSingle();

  if (emailOwner) throw new Error('Email Google sudah terdaftar pada akun lain');

  await consumeInviteRegistration(input);
}

export async function createInvite(input: {
  inviteName: string;
  role: UserRole;
  branchIds: string[];
  createdBy: string;
  expiresInDays?: number;
}) {
  const supabase = await createAdminClient();
  const branchIds = [...new Set(input.branchIds)];
  if (branchIds.length !== input.branchIds.length) {
    throw new Error('Cabang undangan tidak boleh duplikat');
  }

  const { data: branches, error: branchError } = await supabase
    .from('branch')
    .select('id')
    .in('id', branchIds)
    .eq('is_active', true);
  if (branchError) throw branchError;
  if ((branches ?? []).length !== branchIds.length) {
    throw new Error('Semua cabang undangan harus aktif dan valid');
  }

  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 7));

  const { data, error } = await supabase
    .from('invite')
    .insert({
      invite_name: input.inviteName.trim(),
      role: input.role,
      token,
      branch_ids: branchIds,
      expires_at: expiresAt.toISOString(),
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function revokeInvite(inviteId: string, actorId: string) {
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('revoke_invite', {
    p_invite_id: inviteId,
    p_actor_id: actorId,
  });
  if (error) throw error;
  return data;
}

export async function regenerateInvite(input: {
  inviteId: string;
  actorId: string;
  expiresInDays?: number;
}) {
  const supabase = await createAdminClient();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 7));
  const { data, error } = await supabase.rpc('regenerate_invite', {
    p_invite_id: input.inviteId,
    p_actor_id: input.actorId,
    p_new_token: generateToken(32),
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  return data;
}
