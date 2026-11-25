import type { KillzoneInfo } from './types';

/**
 * Classifies a Unix timestamp (seconds) into ICT trading sessions / killzones in UTC.
 * - Asia: 00:00 - 04:00 UTC
 * - London: 07:00 - 10:00 UTC
 * - New York: 12:00 - 15:00 UTC
 * - London Close: 15:00 - 17:00 UTC
 */
export function classifyKillzone(unixSeconds: number): KillzoneInfo {
  const date = new Date(unixSeconds * 1000);
  const utcHour = date.getUTCHours();

  if (utcHour >= 7 && utcHour < 10) {
    return {
      id: 'london_killzone',
      label: 'London Killzone',
      inKillzone: true,
      utcHour,
    };
  }

  if (utcHour >= 12 && utcHour < 15) {
    return {
      id: 'new_york_killzone',
      label: 'New York Killzone',
      inKillzone: true,
      utcHour,
    };
  }

  if (utcHour >= 0 && utcHour < 4) {
    return {
      id: 'asia_killzone',
      label: 'Asia Session',
      inKillzone: true,
      utcHour,
    };
  }

  if (utcHour >= 15 && utcHour < 17) {
    return {
      id: 'london_close',
      label: 'London Close',
      inKillzone: false,
      utcHour,
    };
  }

  return {
    id: 'off_session',
    label: 'Off-Session',
    inKillzone: false,
    utcHour,
  };
}
