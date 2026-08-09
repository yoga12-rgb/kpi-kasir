import { createAdminClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';
import { generateToken } from '@/lib/utils';

export async function getInviteByToken(token: string) {
  const supabase = await createAdminClient();
  const { data } = await supabase.from('invite').select('*').eq('token', token).maybeSingle();

  return data;
}

export function isInviteValid(invite: { used_at: string | null; expires_at: string }): {
  valid: boolean;
  reason?: string;
} {
  if (invite.used_at) {
    return { valid: false, reason: 'Link undangan sudah digunakan' };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { valid: false, reason: 'Link undangan sudah kedaluwarsa' };
  }
  return { valid: true };
}

export async function markInviteUsed(token: string, acceptedUserId: string) {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('invite')
    .update({
      used_at: new Date().toISOString(),
      accepted_user_id: acceptedUserId,
    })
    .eq('token', token)
    .is('used_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function assignUserBranches(userId: string, branchIds: string[]) {
  const supabase = await createAdminClient();
  const rows = branchIds.map((branchId) => ({ user_id: userId, branch_id: branchId }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('user_branch').insert(rows);
  if (error) throw error;
}

export async function setUserRole(userId: string, role: UserRole) {
  const supabase = await createAdminClient();
  const { error } = await supabase.from('users').update({ role }).eq('id', userId);
  if (error) throw error;
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

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('id', input.userId)
    .maybeSingle();
  if (!profile) throw new Error('Profil pengguna Google belum tersedia');

  await setUserRole(input.userId, invite.role);
  const { error: profileError } = await supabase
    .from('users')
    .update({ full_name: input.fullName })
    .eq('id', input.userId);
  if (profileError) throw profileError;

  await assignUserBranches(input.userId, invite.branch_ids);

  const marked = await markInviteUsed(input.token, input.userId);
  if (!marked) throw new Error('Link undangan sudah digunakan');
}

export async function createInvite(input: {
  inviteName: string;
  role: UserRole;
  branchIds: string[];
  createdBy: string;
  expiresInDays?: number;
}) {
  const supabase = await createAdminClient();
  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 7));

  const { data, error } = await supabase
    .from('invite')
    .insert({
      invite_name: input.inviteName.trim(),
      role: input.role,
      token,
      branch_ids: input.branchIds,
      expires_at: expiresAt.toISOString(),
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
