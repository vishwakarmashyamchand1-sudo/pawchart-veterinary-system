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
  
  const parseToLocalDateString = (val) => {
    if (!val) return '';
    let dateObj;
    if (val instanceof Date) {
      dateObj = val;
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      // If it matches exactly YYYY-MM-DD, return it to bypass UTC parsing shifts
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      dateObj = new Date(val);
    } else {
      dateObj = new Date(val);
    }
    
    if (isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  return parseToLocalDateString(d1) === parseToLocalDateString(d2);
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


export function format12h(t) {
  if (!t) return '';
  if (t.includes('-')) {
    const parts = t.split('-');
    const formatSingle = (singleT) => {
      const [h, m] = singleT.split(':');
      if (!h || !m) return singleT;
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const hr12 = hr % 12 || 12;
      return `${hr12}:${m} ${ampm}`;
    };
    return `${formatSingle(parts[0])} - ${formatSingle(parts[1])}`;
  }
  const [h, m] = t.split(':');
  if (!h || !m) return t;
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
}

export function formatDateClean(dateStr) {
  if (!dateStr) return '—';
  const trimmed = String(dateStr).trim();
  // Handle ISO timestamp string (e.g. 2026-05-27T10:00:00.000Z)
  const cleanDateStr = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
    const [y, m, d] = cleanDateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(m, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${months[monthIndex]} ${parseInt(d, 10)}, ${y}`;
    }
  }
  try {
    const dObj = new Date(dateStr);
    if (isNaN(dObj.getTime())) return dateStr;
    return dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

export function getCompactPurpose(purpose) {
  if (!purpose) return 'Routine Checkup';
  const lower = purpose.toLowerCase();
  
  if (lower.includes('vaccin') || lower.includes('injection') || lower.includes('booster') || lower.includes('shot')) return 'Vaccination Follow-up';
  if (lower.includes('skin') || lower.includes('itch') || lower.includes('rash') || lower.includes('allergy') || lower.includes('hair') || lower.includes('fur')) return 'Skin Recheck';
  if (lower.includes('weight') || lower.includes('diet') || lower.includes('obese') || lower.includes('nutrition') || lower.includes('lbs') || lower.includes('kg') || lower.includes('fat') || lower.includes('thin')) return 'Weight Review';
  if (lower.includes('surgery') || lower.includes('suture') || lower.includes('stitch') || lower.includes('wound') || lower.includes('post-op') || lower.includes('operation') || lower.includes('incision')) return 'Post Surgery Review';
  if (lower.includes('dental') || lower.includes('teeth') || lower.includes('mouth') || lower.includes('gum')) return 'Dental Recheck';
  if (lower.includes('ear') || lower.includes('otitis') || lower.includes('discharge') || lower.includes('scratching')) return 'Ear Exam';
  if (lower.includes('fever') || lower.includes('infection') || lower.includes('cough') || lower.includes('cold') || lower.includes('sneeze') || lower.includes('antibiotic')) return 'Infection Follow-up';
  if (lower.includes('vomit') || lower.includes('diarrhea') || lower.includes('motion') || lower.includes('stomach') || lower.includes('gut')) return 'Gastro Recheck';

  // Clean medical prefixes
  const clean = purpose
    .replace(/subjective:|objective:|assessment:|plan:/gi, '')
    .replace(/[\n\r]+/g, ' ')
    .trim();
    
  // Capitalize first letter of each word to make it a neat keyword
  const words = clean.split(' ').filter(w => w.length > 0).slice(0, 3);
  if (words.length > 0) {
    const formatted = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (clean.split(' ').length > 3) {
      return formatted + ' Recheck';
    }
    return formatted;
  }
  return 'Clinical Review';
}
