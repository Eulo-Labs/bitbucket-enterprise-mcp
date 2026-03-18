import { describe, it, expect } from 'vitest';
import { formatTimestamp } from '../../static/admin/datetime';

describe('formatTimestamp', () => {
  it('formats date as abbreviated month, day, year in UTC', () => {
    const { date } = formatTimestamp('2026-03-13T21:05:00.000Z');
    expect(date).toBe('Mar 13, 2026');
  });

  it('formats time as 24-hour HH:MM UTC', () => {
    const { time } = formatTimestamp('2026-03-13T21:05:00.000Z');
    expect(time).toBe('21:05 UTC');
  });

  it('uses UTC not local time (hour differs across timezones)', () => {
    // Midnight UTC is still the same UTC day regardless of local tz
    const { date, time } = formatTimestamp('2026-01-01T00:00:00.000Z');
    expect(date).toBe('Jan 1, 2026');
    expect(time).toBe('00:00 UTC');
  });

  it('pads single-digit minutes with a leading zero', () => {
    const { time } = formatTimestamp('2026-06-15T09:05:00.000Z');
    expect(time).toBe('09:05 UTC');
  });

  it('handles end of day (23:59)', () => {
    const { time } = formatTimestamp('2026-12-31T23:59:00.000Z');
    expect(time).toBe('23:59 UTC');
  });

  it('returns correct month abbreviations for all months', () => {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    months.forEach((abbr, i) => {
      const month = String(i + 1).padStart(2, '0');
      const { date } = formatTimestamp(`2026-${month}-15T12:00:00.000Z`);
      expect(date).toMatch(new RegExp(`^${abbr}`));
    });
  });
});
