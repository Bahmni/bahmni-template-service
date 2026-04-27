// =====================================================
//  DATE & AGE
// =====================================================

export function age(birthDate, asOf) {
  if (!birthDate) return null;

  const from = new Date(birthDate);
  const to = asOf ? new Date(asOf) : new Date();

  if (isNaN(from.getTime())) return null;

  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;
  const totalDays = Math.floor((to - from) / (1000 * 60 * 60 * 24));

  return {
    years,
    months,
    days,
    totalMonths,
    totalDays,
    display: `${years}y ${months}m ${days}d`,
    short: `${years}y`,
    toString() { return this.display; },
  };
}

export function ageFilter(birthDate, format) {
  const result = age(birthDate);
  if (!result) return '';

  switch (format) {
    case 'short':  return result.short;
    case 'years':  return result.years;
    case 'months': return result.totalMonths;
    case 'days':   return result.totalDays;
    default:       return result.display;
  }
}

export function dateFormat(date, locale, format) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);

  locale = locale || 'en';
  format = format || 'short';

  if (format === 'iso') {
    return d.toISOString().split('T')[0];
  }

  const options = format === 'long'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric' };

  try {
    return d.toLocaleDateString(locale, options);
  } catch {
    return d.toLocaleDateString('en', options);
  }
}

export function dateTimeFormat(datetime, locale) {
  if (!datetime) return '';
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return String(datetime);

  locale = locale || 'en';
  const options = {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  };

  try {
    return d.toLocaleDateString(locale, options);
  } catch {
    return d.toLocaleDateString('en', options);
  }
}

export function dateDiff(startDate, endDate, unit) {
  if (!startDate || !endDate) return null;
  const diffMs = new Date(endDate) - new Date(startDate);

  switch (unit) {
    case 'hours':   return Math.floor(diffMs / (1000 * 60 * 60));
    case 'minutes': return Math.floor(diffMs / (1000 * 60));
    default:        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}

// =====================================================
//  NUMBER & STRING
// =====================================================

export function numberFormat(value, locale, decimals) {
  if (value === null || value === undefined) return '';
  locale = locale || 'en';
  const options = {};
  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals;
    options.maximumFractionDigits = decimals;
  }
  try {
    return Number(value).toLocaleString(locale, options);
  } catch {
    return String(value);
  }
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str, length, suffix) {
  if (!str) return '';
  suffix = suffix || '...';
  if (str.length <= length) return str;
  return str.substring(0, length) + suffix;
}

// =====================================================
//  COLLECTIONS
// =====================================================

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

export function groupBy(array, key) {
  if (!array) return {};
  const result = {};
  for (const item of array) {
    const groupKey = getNestedValue(item, key) || 'Other';
    if (!result[groupKey]) result[groupKey] = [];
    result[groupKey].push(item);
  }
  return result;
}

export function sortBy(array, key, order) {
  if (!array) return [];
  const dir = order === 'desc' ? -1 : 1;
  return array.slice().sort((a, b) => {
    const aVal = getNestedValue(a, key);
    const bVal = getNestedValue(b, key);
    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });
}

export function take(array, n) {
  if (!array) return [];
  return array.slice(0, n);
}

export function get(obj, path) {
  return getNestedValue(obj, path);
}

// =====================================================
//  FHIR
// =====================================================

import fhirpath from 'fhirpath';

// =====================================================
//  BUNDLE (for injection into computed.js sandbox)
// =====================================================

const builtins = {
  age, ageFilter, dateFormat, dateTimeFormat, dateDiff,
  numberFormat, capitalize, truncate,
  groupBy, sortBy, take, get,
  fhirpath,
};

export default builtins;
