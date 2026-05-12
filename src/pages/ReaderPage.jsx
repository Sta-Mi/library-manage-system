import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BookListPager from '../components/BookListPager';
import { clearSessionAuth, getStoredToken, postJson } from '../lib/api';
import { getBorrowableCount, getBorrowableDisplay, normalizeBookRow } from '../lib/bookUtils';
import './ReaderPage.css';

const READER_BOOK_PAGE_SIZE = 20;

export default function ReaderPage() {
  const navigate = useNavigate();
  const token = getStoredToken();
  const [activeNav, setActiveNav] = useState('home');
  const [books, setBooks] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [libraryKeyword, setLibraryKeyword] = useState('');
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [quickBorrowCode, setQuickBorrowCode] = useState('');
  const [quickReturnCode, setQuickReturnCode] = useState('');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [myRecords, setMyRecords] = useState([]);

  const post = useCallback(
    (path, body, withToken = true) => postJson(path, body, withToken ? token : ''),
    [token]
  );

  const loadLibraryBooks = useCallback(async () => {
    const q = libraryKeyword.trim();
    const pageRequest = {
      page: libraryPage,
      page_size: READER_BOOK_PAGE_SIZE,
      exact: false
    };
    const body = q ? { ...pageRequest, title: q } : pageRequest;
    try {
      const result = await post('/get_book_list', body);
      const d = result?.data || {};
      const raw = d.books ?? d.Books ?? [];
      const list = Array.isArray(raw) ? raw : [];
      setBooks(list.map(normalizeBookRow));
      const total = Number(d.total ?? d.Total ?? 0);
      setLibraryTotal(Number.isFinite(total) ? total : list.length);
    } catch (e) {
      console.error(e);
      setBooks([]);
      setLibraryTotal(0);
    }
  }, [post, libraryKeyword, libraryPage]);

  const renderMyRecords = useCallback(async () => {
    const statusMap = { borrowed: 0, returned: 1, overdue: 2 };
    const status = statusFilter ? statusMap[statusFilter] : undefined;
    const search = recordSearch.toLowerCase();
    const fineResult = await post('/fine_record_list', {});
    const unpaidFineMap = (fineResult?.data?.fines || []).reduce((acc, f) => {
      if (Number(f.paid) === 0) acc[f.borrow_record_id] = Number(f.amount || 0);
      return acc;
    }, {});
    const result = await post('/borrow_record_list', { status });
    const list = (result?.data?.records || []).filter(
      (r) => !search || (r.book_title || '').toLowerCase().includes(search)
    );
    setMyRecords(
      list.map((r) => ({
        ...r,
        _fine: unpaidFineMap[r.id]
      }))
    );
  }, [post, statusFilter, recordSearch]);

  useEffect(() => {
    document.title = '读者中心 · 墨客';
  }, []);

  useEffect(() => {
    void loadLibraryBooks();
  }, [loadLibraryBooks]);

  function runLibrarySearch() {
    setLibraryPage(1);
    setLibraryKeyword(searchInput.trim());
  }

  useEffect(() => {
    if (activeNav !== 'records') return;
    void renderMyRecords();
  }, [activeNav, renderMyRecords]);

  async function borrowBookById(bookId) {
    const due = String(Math.floor(Date.now() / 1000 + 14 * 24 * 3600));
    const res = await post('/borrow_book', { book_id: Number(bookId), due_date: due });
    alert(res.message || (res.success ? `借阅成功，副本条码：${res?.data?.barcode ?? '-'}` : '借阅失败'));
    await renderMyRecords();
    if (res.success) await loadLibraryBooks();
  }

  async function returnBookByRecordId(recordId) {
    const res = await post('/return_book', { borrow_record_id: Number(recordId) });
    alert(res.message || (res.success ? `归还成功，副本条码：${res?.data?.barcode ?? '-'}` : '归还失败'));
    await renderMyRecords();
    if (res.success) await loadLibraryBooks();
  }

  async function renewBook(recordId) {
    const due = String(Math.floor(Date.now() / 1000 + 7 * 24 * 3600));
    const res = await post('/keep_book', { borrow_record_id: Number(recordId), due_date: due });
    alert(res.message || (res.success ? '续借成功' : '续借失败'));
    await renderMyRecords();
  }

  async function onQuickBorrow() {
    const bookId = Number(quickBorrowCode.trim());
    if (!bookId) return alert('请输入有效的书目ID');
    const due = String(Math.floor(Date.now() / 1000 + 14 * 24 * 3600));
    const res = await post('/borrow_book', { book_id: bookId, due_date: due });
    alert(res.message || (res.success ? `借阅成功，副本条码：${res?.data?.barcode ?? '-'}` : '借阅失败'));
    await renderMyRecords();
    if (res.success) await loadLibraryBooks();
  }

  async function onQuickReturn() {
    const recordId = Number(quickReturnCode.trim());
    if (!recordId) return alert('请输入有效的借阅记录ID');
    const res = await post('/return_book', { borrow_record_id: recordId });
    alert(res.message || (res.success ? `归还成功，副本条码：${res?.data?.barcode ?? '-'}` : '归还失败'));
    await renderMyRecords();
    if (res.success) await loadLibraryBooks();
  }

  function confirmLogout() {
    clearSessionAuth();
    navigate('/login');
  }

  return (
    <div className="reader-page">
      <div className="sidebar">
        <div className="logo">
          <i className="fas fa-book-open" />
          <h2>墨客·读者</h2>
        </div>
        <button
          type="button"
          className={`nav-item${activeNav === 'home' ? ' active' : ''}`}
          onClick={() => setActiveNav('home')}
        >
          <i className="fas fa-home" /> 图书查询
        </button>
        <button
          type="button"
          className={`nav-item${activeNav === 'records' ? ' active' : ''}`}
          onClick={() => setActiveNav('records')}
        >
          <i className="fas fa-history" /> 我的借阅
        </button>
        <Link className="nav-item" to="/reader/profile">
          <i className="fas fa-user-circle" /> 个人中心
        </Link>
        <button type="button" className="nav-item" style={{ marginTop: 40 }} onClick={() => setLogoutOpen(true)}>
          <i className="fas fa-sign-out-alt" /> 注销
        </button>
      </div>

      <div className="main-content">
        <div className={activeNav === 'home' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-search" /> 图书综合查询
            </h1>
          </div>
          <div className="search-section">
            <input
              type="text"
              placeholder="书名关键词（服务端分页；与 get_book_list 的 title 条件一致）"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runLibrarySearch();
              }}
            />
            <button type="button" className="btn-primary" onClick={() => void runLibrarySearch()}>
              <i className="fas fa-search" /> 搜索
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>书名</th>
                <th>作者</th>
                <th>分类</th>
                <th>可借数量</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {books.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                    暂无图书
                  </td>
                </tr>
              ) : (
                books.map((b) => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td>{b.category_name || '-'}</td>
                    <td>
                      <span className="badge returned">{getBorrowableDisplay(b)}</span>
                    </td>
                    <td>
                      {getBorrowableCount(b) > 0 ? (
                        <button type="button" className="btn-primary" onClick={() => void borrowBookById(Number(b.id))}>
                          借阅
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <BookListPager
            page={libraryPage}
            pageSize={READER_BOOK_PAGE_SIZE}
            total={libraryTotal}
            onPageChange={setLibraryPage}
          />
        </div>

        <div className={activeNav === 'records' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-history" /> 我的借阅
            </h1>
          </div>
          <div className="records-toolbar">
            <div className="records-row">
              <input
                placeholder="输入书目ID快速借阅"
                value={quickBorrowCode}
                onChange={(e) => setQuickBorrowCode(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={() => void onQuickBorrow()}>
                快速借阅
              </button>
              <input
                placeholder="输入借阅记录ID快速归还"
                value={quickReturnCode}
                onChange={(e) => setQuickReturnCode(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={() => void onQuickReturn()}>
                快速归还
              </button>
            </div>
            <div className="records-filter-row">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">全部状态</option>
                <option value="borrowed">借阅中</option>
                <option value="returned">已归还</option>
                <option value="overdue">逾期</option>
              </select>
              <input
                type="text"
                placeholder="搜索书名..."
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
              />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>书名</th>
                  <th>借阅日期</th>
                  <th>应还日期</th>
                  <th>实际归还</th>
                  <th>状态</th>
                  <th>罚款</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {myRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                      暂无借阅记录
                    </td>
                  </tr>
                ) : (
                  myRecords.map((r) => (
                    <tr key={r.id}>
                      <td>{r.book_title}</td>
                      <td>{new Date(Number(r.borrow_date) * 1000).toLocaleString()}</td>
                      <td>{new Date(Number(r.due_date) * 1000).toLocaleString()}</td>
                      <td>
                        {r.return_date ? new Date(Number(r.return_date) * 1000).toLocaleString() : '-'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            Number(r.status) === 0 ? 'borrowed' : Number(r.status) === 1 ? 'returned' : 'overdue'
                          }`}
                        >
                          {Number(r.status) === 0 ? '借阅中' : Number(r.status) === 1 ? '已归还' : '逾期'}
                        </span>
                      </td>
                      <td>{r._fine ? `¥${r._fine}` : '-'}</td>
                      <td>
                        {Number(r.status) !== 1 ? (
                          <>
                            <button type="button" className="btn-primary" onClick={() => void renewBook(r.id)}>
                              续借
                            </button>{' '}
                            <button type="button" className="btn-primary" onClick={() => void returnBookByRecordId(r.id)}>
                              归还
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {logoutOpen ? (
        <div className="modal">
          <div className="modal-card" style={{ textAlign: 'center' }}>
            <i className="fas fa-door-open" style={{ fontSize: '2.5rem' }} />
            <h3>确认注销</h3>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button type="button" style={{ flex: 1, padding: 12 }} onClick={() => setLogoutOpen(false)}>
                取消
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: 12, background: '#1e4459', color: 'white' }}
                onClick={confirmLogout}
              >
                退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
