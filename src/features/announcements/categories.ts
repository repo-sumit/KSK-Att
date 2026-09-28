import type { IconName } from '@/components/ui/icons/Icon';
import type { Tone } from '@/components/ui/Badge';
import type { AnnouncementCategory } from '@/domain/announcement';

/**
 * Each category keeps one colour, icon and word everywhere (brief §3): never
 * colour alone. Important = amber, Holiday = green, OJT = blue, Info = grey.
 */
export const CATEGORY_STYLE: Readonly<Record<AnnouncementCategory, { readonly tone: Tone; readonly icon: IconName }>> = {
  important: { tone: 'warning', icon: 'alert' },
  holiday: { tone: 'success', icon: 'calendar' },
  ojt: { tone: 'info', icon: 'briefcase' },
  info: { tone: 'neutral', icon: 'info' },
};
