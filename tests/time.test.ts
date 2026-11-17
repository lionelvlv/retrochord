import { describe, expect, it } from 'vitest';
import { formatTime, formatDate, formatDateTime } from '../src/lib/time';

describe('time utils', () => {
  const now = Date.now();

  it('formatTime shows time only for today', () => {
    // 5:30 PM today
    const date = new Date();
    date.setHours(17, 30, 0, 0);
    expect(formatTime(date.getTime())).toMatch(/5:30 PM/);
  });

  it('formatDate shows Today for current day', () => {
    expect(formatDate(now)).toBe('Today');
  });

  it('formatDateTime includes date for old messages', () => {
    const old = new Date(now - 1000 * 60 * 60 * 24 * 5); // 5 days ago
    expect(formatDateTime(old.getTime())).toMatch(/at/);
  });
});
