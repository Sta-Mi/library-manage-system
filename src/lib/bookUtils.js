/**
 * 将单条书目记录上的常见别名统一到 available_count / total，便于前端读取。
 *（protobuf / 部分网关会输出 PascalCase）
 */
export function normalizeBookRow(b) {
  if (!b || typeof b !== 'object') return b;
  const m = { ...b };
  const ac =
    m.available_count ??
    m.availableCount ??
    m.AvailableCount ??
    m.Available_count ??
    m.availCount ??
    m.AvailCount;
  if (ac != null && m.available_count == null) m.available_count = Number(ac);
  const tt = m.total ?? m.Total ?? m.TotalCount;
  if (tt != null && m.total == null) m.total = Number(tt);
  return m;
}

/**
 * 合并嵌套对象（部分后端把可借数放在 stats / stock_info 等里）
 */
function mergeBookFields(book) {
  if (!book || typeof book !== 'object') return book;
  const a = book.stats && typeof book.stats === 'object' ? book.stats : {};
  const b = book.stock_info && typeof book.stock_info === 'object' ? book.stock_info : {};
  const c = book.extend && typeof book.extend === 'object' ? book.extend : {};
  return { ...a, ...b, ...c, ...book };
}

/** get_book_list 文档：books[].available_count 为在架可借；优先读该字段 */
const AVAIL_KEYS = [
  'available_count',
  'availableCount',
  'avail_count',
  'available_qty',
  'borrowable_count',
  'borrowable',
  'loanable_count',
  'in_stock',
  'on_shelf_count',
  'remain',
  'remaining',
  'stock_available',
  'could_borrow',
  'can_borrow'
];

function pickAvailableRaw(flat) {
  for (const k of AVAIL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(flat, k)) continue;
    const raw = flat[k];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  for (const k of Object.keys(flat)) {
    const lk = String(k).toLowerCase();
    if (/unavail|not_?avail|unavailable/.test(lk)) continue;
    if (!/(^|_)avail|borrowable|loanable|remain(ing)?|in_stock|on_shelf|可借/.test(lk)) continue;
    const raw = flat[k];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * 在架可借册数：仅当接口显式给出「可借」类字段时用该值；否则回退 total（兼容旧接口）。
 */
export function getBorrowableCount(book) {
  const flat = mergeBookFields(book);
  if (!flat) return 0;
  const avail = pickAvailableRaw(flat);
  if (avail !== undefined) return Math.max(0, avail);
  const t = flat.total;
  if (t != null && t !== '') {
    const n = Number(t);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

/** 表格展示：无任何数量信息时 "-" */
export function getBorrowableDisplay(book) {
  const flat = mergeBookFields(book);
  if (!flat) return '-';
  if (pickAvailableRaw(flat) !== undefined) return String(getBorrowableCount(book));
  if (flat.total != null && flat.total !== '') return String(getBorrowableCount(book));
  return '-';
}

/** 是否解析到了「可借」专用字段（非仅用 total 回退） */
export function isUsingAvailableCount(book) {
  const flat = mergeBookFields(book);
  return flat != null && pickAvailableRaw(flat) !== undefined;
}
