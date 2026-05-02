import type { FrequencyType } from '@/types/database';

export const CATEGORY_MAP: Record<string, { label: string; emoji: string }> = {
  cleaning: { label: '掃除', emoji: '🧹' },
  cooking: { label: '料理', emoji: '🍳' },
  laundry: { label: '洗濯', emoji: '👕' },
  storage: { label: '収納', emoji: '📦' },
  other: { label: 'その他', emoji: '📝' },
};

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  none: '頻度なし',
  daily: '毎日',
  weekly: '週次',
  monthly: '月次',
  seasonal: '季節ごと',
  custom: 'カスタム',
};

export function calcNextScheduledDate(
  frequencyType: FrequencyType,
  frequencyConfig: Record<string, unknown> | null,
  baseDate: Date,
): Date | null {
  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  switch (frequencyType) {
    case 'none':
      return null;

    case 'daily': {
      const next = new Date(base);
      next.setDate(next.getDate() + 1);
      return next;
    }

    case 'weekly': {
      const days = ((frequencyConfig as { days?: number[] })?.days ?? []) as number[];
      if (days.length === 0) {
        const next = new Date(base);
        next.setDate(next.getDate() + 7);
        return next;
      }
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(base);
        candidate.setDate(candidate.getDate() + i);
        const dow = candidate.getDay() === 0 ? 7 : candidate.getDay();
        if (days.includes(dow)) return candidate;
      }
      const fallback = new Date(base);
      fallback.setDate(fallback.getDate() + 7);
      return fallback;
    }

    case 'monthly': {
      const day = ((frequencyConfig as { day?: number })?.day ?? 1) as number;
      const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      nextMonth.setDate(Math.min(day, lastDay));
      return nextMonth;
    }

    case 'seasonal': {
      const next = new Date(base);
      next.setMonth(next.getMonth() + 3);
      return next;
    }

    case 'custom': {
      const intervalDays = ((frequencyConfig as { interval_days?: number })?.interval_days ?? 1) as number;
      const next = new Date(base);
      next.setDate(next.getDate() + intervalDays);
      return next;
    }

    default:
      return null;
  }
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(nextScheduledDate: string | null): boolean {
  if (!nextScheduledDate) return false;
  return getDaysUntil(nextScheduledDate) < 0;
}

export function getDueDateLabel(nextScheduledDate: string | null): string | null {
  if (!nextScheduledDate) return null;
  const days = getDaysUntil(nextScheduledDate);
  if (days < 0) return '期限超過';
  if (days === 0) return '今日';
  if (days === 1) return '明日';
  return `${days}日後`;
}
