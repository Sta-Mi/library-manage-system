/**
 * 从读者相关对象中解析「未还 / 在借」册数（列表项或 check_unreturned 响应）。
 */
const UNRETURNED_KEYS = [
  'unreturned_count',
  'unreturnedCount',
  'UnreturnedCount',
  'Unreturned_count',
  'active_borrow_count',
  'activeBorrowCount',
  'borrowing_count',
  'borrowingCount',
  'not_returned_count',
  'notReturnedCount',
  'current_borrow_count',
  'currentBorrowCount',
  'loan_count',
  'on_loan_count',
  'onLoanCount',
  'borrowed_not_returned',
  'un_returned_count',
  'pending_return_count',
  'pendingReturnCount',
  'outstanding_borrow_count',
  'outstandingBorrowCount'
];

function mergeReaderFlat(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const e = obj.extend && typeof obj.extend === 'object' ? obj.extend : {};
  const s = obj.stats && typeof obj.stats === 'object' ? obj.stats : {};
  const ri = obj.reader_info && typeof obj.reader_info === 'object' ? obj.reader_info : {};
  return { ...e, ...s, ...ri, ...obj };
}

export function pickUnreturnedCount(obj) {
  const flat = mergeReaderFlat(obj);
  for (const k of UNRETURNED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(flat, k)) continue;
    const raw = flat[k];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  for (const k of Object.keys(flat)) {
    const lk = String(k).toLowerCase();
    if (/returned_total|return_count|returned_count|history|fine/.test(lk)) continue;
    if (!/(unreturn|not_?return|active.*borrow|borrow(ing)?|on_?loan|在借|未还)/.test(lk)) continue;
    const raw = flat[k];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return undefined;
}

/** 解析 admin_reader_check_unreturned 等接口的 data 或整段响应 */
export function pickUnreturnedFromCheckResponse(res) {
  if (!res || typeof res !== 'object') return undefined;
  const d = res.data != null ? res.data : res;
  let n = pickUnreturnedCount(d);
  if (n !== undefined) return n;
  if (res.data != null && typeof res.data === 'object') {
    n = pickUnreturnedCount({ ...res, ...res.data });
    if (n !== undefined) return n;
  }
  return undefined;
}
