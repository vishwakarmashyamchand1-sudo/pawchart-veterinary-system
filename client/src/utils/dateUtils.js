/**
 * Date calculation and formatting utilities for the Doctor Calendar Dashboard.
 */

export function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, etc.
  // If Sunday (0), we subtract 6 days to get to Monday. Otherwise, subtract (day - 1) days.
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getWeekDates(date, viewMode) {
  const start = getStartOfWeek(date);
  const dates = [];
  
  if (viewMode === 'Day' || viewMode === 'Today') {
    const single = new Date(date);
    single.setHours(0, 0, 0, 0);
    return [single];
  }
  
  const limit = viewMode === 'Work week' ? 5 : 7; // 5 days (Mon-Fri) or 7 days (Mon-Sun)
  for (let i = 0; i < limit; i++) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    dates.push(next);
  }
  return dates;
}

export function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function formatMonthHeader(dates) {
  if (!dates || dates.length === 0) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];
  
  const options = { month: 'long', year: 'numeric' };
  const firstStr = first.toLocaleDateString('en-US', options);
  const lastStr = last.toLocaleDateString('en-US', options);
  
  if (firstStr === lastStr) {
    return firstStr;
  }
  
  // Format as "Month1 Year1 — Month2 Year2" (or "Month1 — Month2 Year" if same year)
  if (first.getFullYear() === last.getFullYear()) {
    const m1 = first.toLocaleDateString('en-US', { month: 'long' });
    return `${m1} — ${lastStr}`;
  }
  
  return `${firstStr} — ${lastStr}`;
}

export function getTodayDate() {
  // Safe simulated today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
