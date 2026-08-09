import { describe, expect, it } from 'vitest';
import {
  CONFIGURABLE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  hasPermission,
} from '@/lib/auth/permissions';

describe('permission matrix', () => {
  it('keeps permission keys unique and role defaults valid', () => {
    expect(new Set(CONFIGURABLE_PERMISSIONS).size).toBe(CONFIGURABLE_PERMISSIONS.length);

    for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      expect(new Set(permissions).size).toBe(permissions.length);
      expect(permissions.every((permission) => CONFIGURABLE_PERMISSIONS.includes(permission))).toBe(
        true
      );
    }
  });

  it('keeps manager capabilities above supervisor without granting sensitive name/photo edits by default', () => {
    const manager = DEFAULT_ROLE_PERMISSIONS.manager;
    const supervisor = DEFAULT_ROLE_PERMISSIONS.supervisor;

    expect(hasPermission(manager, 'cashiers.create')).toBe(true);
    expect(hasPermission(manager, 'outlets.create')).toBe(true);
    expect(hasPermission(manager, 'cashiers.update')).toBe(false);
    expect(hasPermission(manager, 'cashier_photos.update')).toBe(false);
    expect(hasPermission(supervisor, 'cashiers.create')).toBe(false);
    expect(hasPermission(supervisor, 'outlets.create')).toBe(false);
    expect(hasPermission(supervisor, 'assessment')).toBe(true);
  });
});
