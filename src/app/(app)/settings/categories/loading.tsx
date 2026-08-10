import { ListPageSkeleton } from '@/components/ui/PageSkeleton';

export default function Loading() {
  return <ListPageSkeleton rows={3} search={false} />;
}
