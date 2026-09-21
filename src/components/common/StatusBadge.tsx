import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { humanize } from '@/utils/dateFormatter'

const TONE: Record<string, BadgeTone> = {
  EARNED: 'good',
  PAID: 'good',
  ACTIVE: 'good',
  PENDING: 'warn',
  DEACTIVATED: 'warn',
  CANCELLED: 'critical',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? 'neutral'}>{humanize(status)}</Badge>
}
