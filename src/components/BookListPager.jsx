import { useEffect, useState } from 'react';
import './BookListPager.css';

/**
 * 图书列表分页：上一页 / 下一页 + 页码跳转
 */
export default function BookListPager({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false
}) {
  const safeSize = Math.max(1, Number(pageSize) || 20);
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize) || 1);
  const safePage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const [jump, setJump] = useState(String(safePage));

  useEffect(() => {
    setJump(String(safePage));
  }, [safePage]);

  function applyJump() {
    const n = parseInt(String(jump).trim(), 10);
    if (!Number.isFinite(n)) return;
    onPageChange(Math.min(totalPages, Math.max(1, n)));
  }

  return (
    <div className="book-list-pager" aria-label="分页">
      <span className="book-list-pager__meta">
        共 {safeTotal} 条，每页 {safeSize} 条，第 {safePage} / {totalPages} 页
      </span>
      <div className="book-list-pager__actions">
        <button
          type="button"
          className="book-list-pager__btn"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(1)}
        >
          首页
        </button>
        <button
          type="button"
          className="book-list-pager__btn"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          上一页
        </button>
        <button
          type="button"
          className="book-list-pager__btn"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          下一页
        </button>
        <button
          type="button"
          className="book-list-pager__btn"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          末页
        </button>
        <label className="book-list-pager__jump">
          <span>跳转到</span>
          <input
            type="text"
            inputMode="numeric"
            value={jump}
            disabled={disabled}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyJump();
            }}
          />
          <span>页</span>
        </label>
        <button type="button" className="book-list-pager__btn book-list-pager__btn--primary" disabled={disabled} onClick={applyJump}>
          跳转
        </button>
      </div>
    </div>
  );
}
