export interface RangeParse {
  /** groups of 0-based page positions */
  groups: number[][];
  labels: string[];
  error?: { token: string; reason: 'syntax' | 'bounds' };
}

/**
 * Parses "1-3, 5, 8-" against a page count. Each comma-separated part becomes
 * one output file. Open ends ("8-", "-3") run to the last/first page.
 */
export function parseRanges(input: string, total: number): RangeParse {
  const groups: number[][] = [];
  const labels: string[] = [];
  const parts = input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    const m = /^(\d*)\s*(?:[-–—]|\.\.)\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part);
    if (!m) return { groups, labels, error: { token: part, reason: 'syntax' } };
    const single = m.length === 2;
    const a = m[1] ? parseInt(m[1], 10) : 1;
    const b = single ? a : m[2] ? parseInt(m[2], 10) : total;
    if (!m[1] && !single && !m[2]) return { groups, labels, error: { token: part, reason: 'syntax' } };
    if (a < 1 || b < 1 || a > total || b > total) return { groups, labels, error: { token: part, reason: 'bounds' } };
    const step = a <= b ? 1 : -1;
    const g: number[] = [];
    for (let i = a; i !== b + step; i += step) g.push(i - 1);
    groups.push(g);
    labels.push(a === b ? `${a}` : `${a}-${b}`);
  }
  return { groups, labels };
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const size = Math.max(1, Math.floor(n));
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Lenient page picker for flow steps: "1-3, 5, 8-", "odd"/"ganjil",
 * "even"/"genap", "last"/"akhir". Numbers beyond the document are ignored so
 * one rule can be applied to documents of different lengths.
 */
export function pickPages(input: string, total: number): { indices: Set<number>; error?: string } {
  const indices = new Set<number>();
  const parts = input
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const part of parts) {
    if (part === 'odd' || part === 'ganjil') {
      for (let i = 0; i < total; i += 2) indices.add(i);
      continue;
    }
    if (part === 'even' || part === 'genap') {
      for (let i = 1; i < total; i += 2) indices.add(i);
      continue;
    }
    if (part === 'last' || part === 'akhir' || part === 'terakhir') {
      if (total) indices.add(total - 1);
      continue;
    }
    const m = /^(\d*)\s*(?:[-–—]|\.\.)\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part);
    if (!m || (m.length === 3 && !m[1] && !m[2])) return { indices, error: part };
    const a = m[1] ? parseInt(m[1], 10) : 1;
    const b = m.length === 2 ? a : m[2] ? parseInt(m[2], 10) : total;
    if (a < 1 || b < 1) return { indices, error: part };
    const lo = Math.min(a, b);
    const hi = Math.min(Math.max(a, b), total);
    for (let i = lo; i <= hi; i++) indices.add(i - 1);
  }
  return { indices };
}
