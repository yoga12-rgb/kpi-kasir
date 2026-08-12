import { Bug, Gauge, Plus, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth/guards';
import { appUpdates, type UpdateCategory } from '@/content/updates';
import { APP_VERSION } from '@/lib/app-meta';
import { formatDate } from '@/lib/utils';

const categoryIcons: Record<UpdateCategory, typeof Plus> = {
  added: Plus,
  changed: Wrench,
  fixed: Bug,
  performance: Gauge,
  security: ShieldCheck,
};

const categoryVariants: Record<UpdateCategory, 'info' | 'default' | 'danger' | 'success' | 'warning'> = {
  added: 'info',
  changed: 'default',
  fixed: 'danger',
  performance: 'success',
  security: 'warning',
};

export default async function UpdatesPage() {
  await requireUser();

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-900">Update Aplikasi</h1>
          <p className="mt-0.5 text-sm text-surface-500">Perkembangan fitur dan perbaikan terbaru</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {appUpdates.map((update) => (
          <Card key={`${update.version}-${update.date}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="info">v{update.version}</Badge>
                {update.version === APP_VERSION && <Badge variant="success">Versi saat ini</Badge>}
              </div>
              <time dateTime={update.date} className="text-xs text-surface-500">
                {formatDate(update.date)}
              </time>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-surface-900">{update.title}</h2>
            <p className="mt-1 text-sm text-surface-600">{update.summary}</p>

            <div className="mt-4 space-y-4">
              {update.sections.map((section) => {
                const Icon = categoryIcons[section.category];
                return (
                  <section key={`${update.version}-${section.category}`}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary-600" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-surface-900">{section.label}</h3>
                      <Badge variant={categoryVariants[section.category]}>{section.items.length}</Badge>
                    </div>
                    <ul className="mt-2 space-y-1.5 pl-6 text-sm text-surface-600">
                      {section.items.map((item) => (
                        <li key={item} className="list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
