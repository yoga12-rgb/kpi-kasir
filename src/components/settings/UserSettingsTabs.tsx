'use client';

import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

type TabId = 'users' | 'permissions' | 'invite';

export function UserSettingsTabs({
  userList,
  rolePermissions,
  invite,
}: {
  userList: ReactNode;
  rolePermissions: ReactNode;
  invite: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const tabs = [
    { id: 'users' as const, label: 'Pengguna', icon: Users },
    { id: 'permissions' as const, label: 'Hak Akses', icon: ShieldCheck },
    { id: 'invite' as const, label: 'Undang', icon: UserPlus },
  ];
  const content = {
    users: userList,
    permissions: rolePermissions,
    invite,
  }[activeTab];

  return (
    <div className="mt-4">
      <div
        role="tablist"
        aria-label="Pengaturan pengguna"
        className="flex overflow-x-auto rounded-xl border border-surface-200 bg-surface-100 p-1"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`user-settings-tabpanel-${id}`}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                active
                  ? 'bg-surface-200 text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:bg-surface-200/60 hover:text-surface-800'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`user-settings-tabpanel-${activeTab}`}
        role="tabpanel"
        aria-label={tabs.find((tab) => tab.id === activeTab)?.label}
        className="mt-4"
      >
        {content}
      </div>
    </div>
  );
}
