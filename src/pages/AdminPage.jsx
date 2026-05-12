import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearSessionAuth,
  getCurrentUser,
  getStoredToken,
  postJson
} from '../lib/api';
import BookListPager from '../components/BookListPager';
import { getBorrowableCount, normalizeBookRow } from '../lib/bookUtils';
import AdminBookEntry from './AdminBookEntry';
import AdminReaderEntry from './AdminReaderEntry';
import './AdminPage.css';

const statusTextMap = { 0: 'borrowed', 1: 'returned', 2: 'overdue' };
const statusCodeMap = { borrowed: 0, returned: 1, overdue: 2 };

function formatTs(ts) {
  return ts ? new Date(Number(ts) * 1000).toLocaleDateString('zh-CN') : '-';
}

function toUnixString(dateText, end = false) {
  if (!dateText) return undefined;
  const date = new Date(`${dateText}T${end ? '23:59:59' : '00:00:00'}`);
  return String(Math.floor(date.getTime() / 1000));
}

const ADMIN_BOOK_LIST_PAGE_SIZE = 20;

function getFine(record) {
  if (!record || !record.dueDate) return 0;
  const end = record.returnDate || new Date().toISOString().split('T')[0];
  const overdueDays = Math.max(0, Math.ceil((new Date(end) - new Date(record.dueDate)) / 86400000));
  return overdueDays;
}

const RECORD_PAGE_SIZE = 8;
const USER_PAGE_SIZE = 20;

/** 将 admin_user_list 单条记录映射为表格用结构 */
function mapUserFromApi(item) {
  const id = item.id != null ? String(item.id) : '';
  const roleRaw = item.role;
  const role =
    Number(roleRaw) === 2 || roleRaw === '2' || roleRaw === 'admin' || roleRaw === 'ADMIN' ? 'admin' : 'reader';
  const en = item.enabled;
  const active = !(en === 0 || en === false || en === '0');
  let lastLogin = '-';
  const ll = item.last_login ?? item.lastLogin ?? item.login_time;
  if (ll != null && ll !== '') {
    const s = String(ll).trim();
    if (/^\d{9,13}$/.test(s)) lastLogin = formatTs(s);
    else lastLogin = s;
  }
  return {
    id,
    username: String(item.username ?? ''),
    role,
    status: active ? 'active' : 'inactive',
    lastLogin
  };
}

export default function AdminPage() {
  const navigate = useNavigate();
  const token = getStoredToken();
  const currentUser = getCurrentUser();

  const post = useCallback((path, body) => postJson(path, body, token), [token]);

  const [page, setPage] = useState('circulation');
  const [adminName, setAdminName] = useState(currentUser?.username || '');
  const [users, setUsers] = useState([]);
  const [userFilterOptions, setUserFilterOptions] = useState([]);
  const [userListPage, setUserListPage] = useState(1);
  const [userListTotal, setUserListTotal] = useState(0);
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userKeywordApplied, setUserKeywordApplied] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [directoryUserTotal, setDirectoryUserTotal] = useState(0);
  const [books, setBooks] = useState([]);
  const [records, setRecords] = useState([]);
  const [fines, setFines] = useState([]);

  const [bookSearchInput, setBookSearchInput] = useState('');
  const [bookListPage, setBookListPage] = useState(1);
  const [bookListTotal, setBookListTotal] = useState(0);
  const bookSearchPrevRef = useRef(bookSearchInput);
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [currentRecordPage, setCurrentRecordPage] = useState(1);

  const [borrowUserId, setBorrowUserId] = useState('');
  const [borrowBookId, setBorrowBookId] = useState('');
  /** 借阅管理页：归还列表筛选（读者 user_id，可选） */
  const [circulationReaderFilter, setCirculationReaderFilter] = useState('');
  const [circulationBorrows, setCirculationBorrows] = useState([]);
  const circulationReaderFilterRef = useRef('');
  circulationReaderFilterRef.current = circulationReaderFilter;

  const [fineUserIdFilter, setFineUserIdFilter] = useState('');
  const [finePaidFilter, setFinePaidFilter] = useState('');

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增用户');
  const [editUserId, setEditUserId] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('reader');

  const [bookUpdateOpen, setBookUpdateOpen] = useState(false);
  const [updBookId, setUpdBookId] = useState(null);
  const [updTitle, setUpdTitle] = useState('');
  const [updAuthor, setUpdAuthor] = useState('');
  const [updIsbn, setUpdIsbn] = useState('');
  const [updCategoryId, setUpdCategoryId] = useState('');
  const [updTotal, setUpdTotal] = useState('');
  const [updSnapshot, setUpdSnapshot] = useState(null);

  useEffect(() => {
    document.title = '管理员系统 · 墨客';
  }, []);

  useEffect(() => {
    void post('/account_manage', {}).then((res) => {
      if (res?.success && res?.data?.user?.username) setAdminName(res.data.user.username);
    });
  }, [post]);

  const renderBookTable = useCallback(async () => {
    const q = bookSearchInput.trim();
    const searchChanged = bookSearchPrevRef.current !== bookSearchInput;
    if (searchChanged) {
      bookSearchPrevRef.current = bookSearchInput;
      if (bookListPage !== 1) {
        setBookListPage(1);
        return;
      }
    }
    const pageToFetch = bookListPage;
    const body = {
      page: pageToFetch,
      page_size: ADMIN_BOOK_LIST_PAGE_SIZE
    };
    if (q) body.title_keyword = q;
    let list = [];
    try {
      const result = await post('/admin_book_list', body);
      if (!result?.success) {
        alert(result?.message || '加载书目失败');
        setBooks([]);
        setBookListTotal(0);
        return;
      }
      const d = result.data || {};
      const raw = d.list ?? d.List ?? d.books ?? [];
      list = Array.isArray(raw) ? raw : [];
      const total = Number(d.total ?? d.Total ?? 0);
      setBookListTotal(Number.isFinite(total) ? total : list.length);
    } catch (e) {
      console.error(e);
      list = [];
      setBookListTotal(0);
    }
    setBooks(list.map(normalizeBookRow));
  }, [post, bookSearchInput, bookListPage]);

  const deleteBook = useCallback(
    async (bookId) => {
      if (bookId == null || bookId === '') return;
      if (!window.confirm('确定要下架该书目吗？下架后列表默认将不再返回该书。')) return;
      const res = await post('/admin_book_delete', { book_id: Number(bookId) });
      alert(res.message || (res.success ? '操作成功' : '操作失败'));
      if (res.success) await renderBookTable();
    },
    [post, renderBookTable]
  );

  const loadUserFilterOptions = useCallback(async () => {
    const res = await post('/admin_user_list', { page: 1, page_size: 500 });
    if (!res?.success) return;
    const d = res.data || {};
    const list = Array.isArray(d.list) ? d.list : Array.isArray(d.users) ? d.users : [];
    setUserFilterOptions(list.map(mapUserFromApi));
    if (d.total != null && !Number.isNaN(Number(d.total))) setDirectoryUserTotal(Number(d.total));
  }, [post]);

  const loadUserList = useCallback(async () => {
    const body = {
      page: userListPage,
      page_size: USER_PAGE_SIZE,
      ...(userKeywordApplied ? { keyword: userKeywordApplied } : {})
    };
    if (userRoleFilter === 'admin') body.role = 2;
    else if (userRoleFilter === 'reader') body.role = 1;
    const res = await post('/admin_user_list', body);
    if (!res?.success) {
      alert(res?.message || '用户列表加载失败');
      setUsers([]);
      setUserListTotal(0);
      return;
    }
    const d = res.data || {};
    const list = Array.isArray(d.list) ? d.list : Array.isArray(d.users) ? d.users : [];
    setUsers(list.map(mapUserFromApi));
    const tot = Number(d.total);
    setUserListTotal(Number.isFinite(tot) ? tot : list.length);
  }, [post, userListPage, userKeywordApplied, userRoleFilter]);

  function openBookUpdate(b) {
    const t = String(b.title ?? '');
    const a = String(b.author ?? '');
    const i = String(b.isbn ?? '');
    const c = b.category_id != null && b.category_id !== '' ? String(b.category_id) : '';
    const tot = b.total != null && b.total !== '' ? String(b.total) : '';
    setUpdBookId(b.id);
    setUpdTitle(t);
    setUpdAuthor(a);
    setUpdIsbn(i);
    setUpdCategoryId(c);
    setUpdTotal(tot);
    setUpdSnapshot({ title: t, author: a, isbn: i, category_id: c, total: tot });
    setBookUpdateOpen(true);
  }

  async function submitBookUpdate(e) {
    e.preventDefault();
    const snap = updSnapshot;
    if (updBookId == null || !snap) return;
    const body = { book_id: Number(updBookId) };
    if (updTitle.trim() !== snap.title) body.title = updTitle.trim();
    if (updAuthor.trim() !== snap.author) body.author = updAuthor.trim();
    if (updIsbn.trim() !== snap.isbn) body.isbn = updIsbn.trim();
    const catTrim = updCategoryId.trim();
    if (catTrim !== snap.category_id) {
      if (catTrim !== '') {
        const catNum = parseInt(catTrim, 10);
        body.category_id = Number.isFinite(catNum) ? catNum : catTrim;
      }
    }
    const totalTrim = updTotal.trim();
    if (totalTrim !== snap.total) {
      if (totalTrim !== '') {
        const n = Number(totalTrim);
        if (Number.isFinite(n)) body.total = n;
      }
    }
    if (body.title !== undefined && body.isbn === undefined) {
      const isbnVal = updIsbn.trim() || snap.isbn.trim();
      if (!isbnVal) {
        alert('说明：若只修改书名，请填写 ISBN（或与书名同传已有 ISBN），否则接口可能无法处理。');
        return;
      }
      body.isbn = isbnVal;
    }
    const extraKeys = Object.keys(body).filter((k) => k !== 'book_id');
    if (extraKeys.length === 0) {
      alert('请至少修改一项后再保存。');
      return;
    }
    const res = await post('/admin_book_update', body);
    alert(res.message || (res.success ? '更新成功' : '更新失败'));
    if (res.success) {
      setBookUpdateOpen(false);
      setUpdSnapshot(null);
      await renderBookTable();
    }
  }

  const renderRecordTable = useCallback(async () => {
    const search = recordSearch.toLowerCase();
    const result = await post('/admin_borrow_record_list', {
      target_user_id: userFilter ? Number(userFilter) : undefined,
      status: statusFilter ? statusCodeMap[statusFilter] : undefined,
      from: toUnixString(dateFrom),
      to: toUnixString(dateTo, true)
    });
    const mapped = (result?.data?.records || []).map((r) => ({
      id: r.id,
      userId: String(r.reader_id || ''),
      userName: `用户#${r.reader_id ?? '-'}`,
      bookTitle: r.book_title || '-',
      barcode: r.barcode,
      borrowDate: formatTs(r.borrow_date),
      dueDate: formatTs(r.due_date),
      returnDate: formatTs(r.return_date),
      status: statusTextMap[Number(r.status)] || 'borrowed'
    }));
    const filtered = mapped.filter((r) => {
      if (userFilter && r.userId !== userFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (
        search &&
        !(r.bookTitle.toLowerCase().includes(search) || r.userName.toLowerCase().includes(search))
      )
        return false;
      return true;
    });
    setRecords(filtered);
  }, [post, userFilter, statusFilter, dateFrom, dateTo, recordSearch]);

  /** 借阅管理：未归还记录（借阅中 + 逾期），供逐条归还 */
  const loadCirculationBorrowList = useCallback(async () => {
    const uidTrim = circulationReaderFilterRef.current.trim();
    const target =
      uidTrim && Number.isFinite(Number(uidTrim)) && Number(uidTrim) > 0 ? Number(uidTrim) : undefined;
    const base = target != null ? { target_user_id: target } : {};
    try {
      const [r0, r2] = await Promise.all([
        post('/admin_borrow_record_list', { ...base, status: 0 }),
        post('/admin_borrow_record_list', { ...base, status: 2 })
      ]);
      const raw0 = r0?.data?.records || [];
      const raw2 = r2?.data?.records || [];
      const byId = new Map();
      [...raw0, ...raw2].forEach((r) => {
        if (r && r.id != null) byId.set(Number(r.id), r);
      });
      const merged = [...byId.values()].sort((a, b) => Number(b.borrow_date || 0) - Number(a.borrow_date || 0));
      setCirculationBorrows(
        merged.map((r) => ({
          id: r.id,
          readerId: r.reader_id ?? '-',
          bookTitle: r.book_title || '-',
          barcode: r.barcode ?? '-',
          borrowDate: formatTs(r.borrow_date),
          dueDate: formatTs(r.due_date),
          status: statusTextMap[Number(r.status)] || 'borrowed'
        }))
      );
    } catch (e) {
      console.error(e);
      setCirculationBorrows([]);
    }
  }, [post]);

  useEffect(() => {
    if (page !== 'circulation') return;
    void loadCirculationBorrowList();
  }, [page, loadCirculationBorrowList]);

  useEffect(() => {
    void renderBookTable();
  }, [renderBookTable]);

  useEffect(() => {
    void renderRecordTable();
  }, [renderRecordTable]);

  useEffect(() => {
    setCurrentRecordPage(1);
  }, [userFilter, statusFilter, dateFrom, dateTo, recordSearch]);

  const { pageRecords, totalPages } = useMemo(() => {
    const totalPagesInner = Math.max(1, Math.ceil(records.length / RECORD_PAGE_SIZE) || 1);
    const start = (currentRecordPage - 1) * RECORD_PAGE_SIZE;
    const pageRecordsInner = records.slice(start, start + RECORD_PAGE_SIZE);
    return { pageRecords: pageRecordsInner, totalPages: totalPagesInner };
  }, [records, currentRecordPage]);

  const borrowedBooks = records.filter((r) => r.status === 'borrowed').length;
  const overdueBooks = records.filter((r) => r.status === 'overdue').length;

  const usersForLookup = useMemo(() => {
    const m = new Map();
    userFilterOptions.forEach((u) => {
      if (u.id) m.set(String(u.id), u);
    });
    users.forEach((u) => {
      if (u.id) m.set(String(u.id), u);
    });
    return [...m.values()];
  }, [userFilterOptions, users]);

  const borrowUserInfo = useMemo(() => {
    const uid = borrowUserId.trim();
    const user = usersForLookup.find((u) => u.id === uid || u.username === uid);
    const borrowedCount = records.filter((r) => r.userId === user?.id && r.status !== 'returned').length;
    return user
      ? `当前读者：${user.username}（${user.id}），借阅数量/上限：${borrowedCount}/5`
      : '请输入读者证号查看信息';
  }, [borrowUserId, usersForLookup, records]);

  useEffect(() => {
    if (!['records', 'circulation', 'users', 'dashboard'].includes(page)) return;
    void loadUserFilterOptions();
  }, [page, loadUserFilterOptions]);

  useEffect(() => {
    if (page !== 'users') return;
    void loadUserList();
  }, [page, userListPage, userKeywordApplied, userRoleFilter, loadUserList]);

  async function markReturned(id) {
    const res = await post('/admin_return_book', { borrow_record_id: Number(id) });
    alert(res.message || (res.success ? `归还成功，副本条码：${res?.data?.barcode ?? '-'}` : '归还失败'));
    await renderRecordTable();
    await loadCirculationBorrowList();
    if (res.success) await renderBookTable();
  }

  function viewRecordDetail(id) {
    const r = records.find((rec) => String(rec.id) === String(id));
    if (!r) return;
    window.alert(`借阅详情\n读者：${r.userName}\n图书：${r.bookTitle}\n借阅日期：${r.borrowDate}\n应还日期：${r.dueDate}`);
  }

  async function renewRecord(id) {
    const record = records.find((r) => String(r.id) === String(id));
    if (!record || record.status === 'returned') return alert('该记录已归还');
    const due = String(Math.floor(Date.now() / 1000 + 7 * 24 * 3600));
    const res = await post('/admin_keep_book', { borrow_record_id: Number(id), due_date: due });
    alert(res.message || (res.success ? '续借成功' : '续借失败'));
    await renderRecordTable();
    await loadCirculationBorrowList();
  }

  async function noteExpired(id) {
    const res = await post('/admin_note_expired', { borrow_record_id: Number(id) });
    alert(res.message || (res.success ? '已标记逾期' : '标记失败'));
    await renderRecordTable();
    await loadCirculationBorrowList();
  }

  const loadFinesAndSet = useCallback(async () => {
    const res = await post('/admin_fine_record_list', {
      target_user_id: fineUserIdFilter.trim() ? Number(fineUserIdFilter) : undefined,
      paid: finePaidFilter === '' ? undefined : Number(finePaidFilter)
    });
    setFines(res?.data?.fines || []);
  }, [post, fineUserIdFilter, finePaidFilter]);

  async function adminPayFine(fineId) {
    const res = await post('/admin_pay_fine', { fine_id: Number(fineId) });
    alert(res.message || (res.success ? '代缴成功' : '代缴失败'));
    await loadFinesAndSet();
  }

  useEffect(() => {
    if (page === 'fines') void loadFinesAndSet();
  }, [page, loadFinesAndSet]);

  function onNav(p) {
    setPage(p);
    if (p === 'books') void renderBookTable();
    if (p === 'records') void renderRecordTable();
    if (p === 'fines') void loadFinesAndSet();
    if (p === 'circulation') void loadCirculationBorrowList();
  }

  async function onBorrowConfirm() {
    const uid = borrowUserId.trim();
    const bookId = Number(borrowBookId.trim());
    if (!Number(uid) || !bookId) return alert('请输入有效的用户ID和书目ID');
    const due = String(Math.floor(Date.now() / 1000 + 14 * 24 * 3600));
    const res = await post('/admin_borrow_book', { target_user_id: Number(uid), book_id: bookId, due_date: due });
    alert(res.message || (res.success ? `借阅办理成功，副本条码：${res?.data?.barcode ?? '-'}` : '借阅办理失败'));
    await renderRecordTable();
    if (res.success) await renderBookTable();
    await loadCirculationBorrowList();
  }

  function toggleStatus(id) {
    const user = users.find((u) => String(u.id) === String(id));
    if (!user) return;
    void post('/admin_set_user_state', {
      target_user_id: Number(id),
      enabled: user.status === 'active' ? 0 : 1
    }).then(async (res) => {
      alert(res.message || (res.success ? '状态更新成功' : '状态更新失败'));
      if (res.success) {
        await loadUserList();
        await loadUserFilterOptions();
      }
    });
  }

  function resetPassword(id) {
    const next = window.prompt('请输入新密码（至少6位）');
    if (!next) return;
    void post('/admin_change_password', { target_user_id: Number(id), new_password: next }).then((res) =>
      alert(res.message || (res.success ? '密码已重置' : '密码重置失败'))
    );
  }

  function deleteUser(id) {
    if (!window.confirm(`确认删除用户 ${id} ?`)) return;
    void post('/admin_delete_user', { target_user_id: Number(id) }).then(async (res) => {
      alert(res.message || (res.success ? '删除成功' : '删除失败'));
      if (res.success) {
        await loadUserList();
        await loadUserFilterOptions();
      }
    });
  }

  function openEditUser(id) {
    const u = users.find((x) => String(x.id) === String(id));
    setModalTitle('编辑用户');
    setEditUserId(String(id));
    setEditUsername(u?.username || '');
    setEditPassword('');
    setEditRole(u?.role === 'admin' ? 'admin' : 'reader');
    setUserModalOpen(true);
  }

  function openAddUser() {
    setModalTitle('新增用户');
    setEditUserId('');
    setEditUsername('');
    setEditPassword('');
    setEditRole('reader');
    setUserModalOpen(true);
  }

  async function onUserFormSubmit(e) {
    e.preventDefault();
    const id = editUserId.trim();
    const username = editUsername.trim();
    const password = editPassword.trim();
    const roleText = editRole;
    const role = roleText === 'admin' ? 2 : 1;
    if (!id) {
      const name = window.prompt('姓名');
      const tel = window.prompt('电话');
      const email = window.prompt('邮箱');
      const res = await post('/admin_add_user', { username, password, role, name, tel, email });
      alert(res.message || (res.success ? '新增成功' : '新增失败'));
      if (res.success) {
        setUserModalOpen(false);
        setUserListPage(1);
        await loadUserList();
        await loadUserFilterOptions();
      }
      return;
    }
    const resInfo = await post('/admin_edit_user_info', { target_user_id: Number(id), username });
    const resRole = await post('/admin_set_user_role', { target_user_id: Number(id), role });
    alert(resRole.message || resInfo.message || (resInfo.success && resRole.success ? '保存成功' : '保存失败'));
    if (resInfo.success && resRole.success) {
      setUserModalOpen(false);
      await loadUserList();
      await loadUserFilterOptions();
    }
  }

  function confirmLogout() {
    clearSessionAuth();
    navigate('/login');
  }

  const navClass = (p) => `nav-item${page === p ? ' active' : ''}`;

  return (
    <div className="admin-page">
      <div className="sidebar">
        <div className="logo">
          <i className="fas fa-user-shield" />
          <h2>墨客·管理</h2>
        </div>
        <div className="nav-menu">
          <button type="button" className={navClass('dashboard')} onClick={() => onNav('dashboard')}>
            <i className="fas fa-chart-pie" /> 仪表盘
          </button>
          <button type="button" className={navClass('books')} onClick={() => onNav('books')}>
            <i className="fas fa-book" /> 图书查询
          </button>
          <button type="button" className={navClass('book-entry')} onClick={() => onNav('book-entry')}>
            <i className="fas fa-square-plus" /> 图书录入
          </button>
          <button type="button" className={navClass('reader-entry')} onClick={() => onNav('reader-entry')}>
            <i className="fas fa-address-card" /> 读者管理
          </button>
          <button type="button" className={navClass('circulation')} onClick={() => onNav('circulation')}>
            <i className="fas fa-right-left" /> 借阅管理
          </button>
          <button type="button" className={navClass('records')} onClick={() => onNav('records')}>
            <i className="fas fa-clock-rotate-left" /> 借阅记录查询
          </button>
          <button type="button" className={navClass('users')} onClick={() => onNav('users')}>
            <i className="fas fa-users-gear" /> 用户管理
          </button>
          <button type="button" className={navClass('roles')} onClick={() => onNav('roles')}>
            <i className="fas fa-user-tag" /> 角色权限
          </button>
          <button type="button" className={navClass('fines')} onClick={() => onNav('fines')}>
            <i className="fas fa-file-invoice-dollar" /> 罚款管理
          </button>
        </div>
        <div className="user-info">
          <div>
            <i className="far fa-user-circle" /> <span>{adminName}</span>
          </div>
          <button type="button" className="btn-logout" onClick={() => setLogoutOpen(true)}>
            <i className="fas fa-sign-out-alt" /> 注销
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className={page === 'dashboard' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>仪表盘</h1>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <i className="fas fa-users" style={{ fontSize: '2rem' }} />
              <h2>{directoryUserTotal || 0}</h2>
              <p>总用户</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-book" />
              <h2>{bookListTotal || books.length}</h2>
              <p>馆藏</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-hand-holding" />
              <h2>{borrowedBooks}</h2>
              <p>借阅中</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-clock" />
              <h2>{overdueBooks}</h2>
              <p>逾期</p>
            </div>
          </div>
        </div>

        <div className={page === 'books' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-search" /> 图书综合查询
            </h1>
          </div>
          <div className="book-search-section">
            <div className="search-box" style={{ width: '100%' }}>
              <i className="fas fa-search" />
              <input
                type="text"
                placeholder="书名关键词（admin_book_list · title_keyword，模糊）"
                style={{ width: '100%' }}
                value={bookSearchInput}
                onChange={(e) => setBookSearchInput(e.target.value)}
              />
            </div>
            <table className="data-table" style={{ marginTop: 20 }}>
              <thead>
                <tr>
                  <th>书名</th>
                  <th>作者</th>
                  <th>书目ID</th>
                  <th>可借数量</th>
                  <th>分类</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {books.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                      暂无图书
                    </td>
                  </tr>
                ) : (
                  books.map((b) => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>{b.id ?? '-'}</td>
                      <td>
                        <span className="badge returned">可借数量：{getBorrowableCount(b)}</span>
                      </td>
                      <td>{b.category_name || '-'}</td>
                      <td>
                        {b.id != null ? (
                          <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                              onClick={() => void deleteBook(b.id)}
                            >
                              删除
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                              onClick={() => openBookUpdate(b)}
                            >
                              更新
                            </button>
                          </span>
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
              page={bookListPage}
              pageSize={ADMIN_BOOK_LIST_PAGE_SIZE}
              total={bookListTotal}
              onPageChange={setBookListPage}
            />
          </div>
        </div>

        <div className={page === 'book-entry' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-square-plus" /> 图书录入与管理
            </h1>
          </div>
          <div className="management-panel iframe-panel">
            <AdminBookEntry />
          </div>
        </div>

        <div className={page === 'reader-entry' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-address-card" /> 读者录入与管理
            </h1>
          </div>
          <div className="management-panel iframe-panel">
            <AdminReaderEntry />
          </div>
        </div>

        <div className={page === 'circulation' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-right-left" /> 借阅/归还办理
            </h1>
          </div>
          <div className="management-panel" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12 }}>借阅办理</h3>
            <div className="action-bar">
              <input
                className="search-box"
                style={{ padding: 10 }}
                placeholder="读者证号/用户ID"
                value={borrowUserId}
                onChange={(e) => setBorrowUserId(e.target.value)}
              />
              <input
                className="search-box"
                style={{ padding: 10 }}
                placeholder="书目ID（book_id）"
                value={borrowBookId}
                onChange={(e) => setBorrowBookId(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={() => void onBorrowConfirm()}>
                一键借阅确认
              </button>
            </div>
            <div style={{ color: '#3b6079' }}>{borrowUserInfo}</div>
          </div>
          <div className="management-panel">
            <h3 style={{ marginBottom: 12 }}>归还办理</h3>
            <p style={{ color: '#3b6079', fontSize: '0.9rem', marginBottom: 12, lineHeight: 1.5 }}>
              以下为未归还借阅（借阅中、逾期）。点击右侧「归还」即可办理，无需输入记录 ID。
            </p>
            <div className="action-bar" style={{ marginBottom: 12 }}>
              <input
                className="search-box"
                style={{ padding: 10, minWidth: 200 }}
                placeholder="筛选读者用户 ID（可选，留空为全部）"
                value={circulationReaderFilter}
                onChange={(e) => setCirculationReaderFilter(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={() => void loadCirculationBorrowList()}>
                刷新列表
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>记录 ID</th>
                  <th>读者 ID</th>
                  <th>图书</th>
                  <th>条码</th>
                  <th>借阅日</th>
                  <th>应还日</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {circulationBorrows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 36 }}>
                      暂无未归还借阅
                    </td>
                  </tr>
                ) : (
                  circulationBorrows.map((row) => (
                    <tr key={String(row.id)}>
                      <td>{row.id}</td>
                      <td>{row.readerId}</td>
                      <td>{row.bookTitle}</td>
                      <td>{row.barcode}</td>
                      <td>{row.borrowDate}</td>
                      <td>{row.dueDate}</td>
                      <td>
                        <span
                          className={`badge ${row.status === 'overdue' ? 'overdue' : 'borrowed'}`}
                        >
                          {row.status === 'overdue' ? '逾期' : '借阅中'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                          onClick={() => void markReturned(row.id)}
                        >
                          归还
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={page === 'records' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-history" /> 借阅记录查询
            </h1>
            <button type="button" className="btn-primary">
              <i className="fas fa-download" /> 导出记录
            </button>
          </div>
          <div className="management-panel">
            <div className="action-bar">
              <div className="filter-group">
                <select
                  className="search-box"
                  style={{ padding: '10px 20px' }}
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                >
                  <option value="">全部用户</option>
                  {userFilterOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.role === 'admin' ? '管理员' : '读者'})
                    </option>
                  ))}
                </select>
                <select
                  className="search-box"
                  style={{ padding: '10px 20px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">全部状态</option>
                  <option value="borrowed">借阅中</option>
                  <option value="returned">已归还</option>
                  <option value="overdue">逾期</option>
                </select>
                <input
                  type="date"
                  className="search-box"
                  style={{ padding: 10 }}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <input
                  type="date"
                  className="search-box"
                  style={{ padding: 10 }}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="search-box">
                <i className="fas fa-search" />
                <input
                  type="text"
                  placeholder="搜索书名或读者..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                />
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>读者</th>
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
                {pageRecords.map((r) => (
                  <tr key={String(r.id)}>
                    <td>{r.userName}</td>
                    <td>{r.bookTitle}</td>
                    <td>{r.borrowDate}</td>
                    <td>{r.dueDate}</td>
                    <td>{r.returnDate || '-'}</td>
                    <td>
                      <span className={`badge ${r.status}`}>
                        {r.status === 'borrowed' ? '借阅中' : r.status === 'returned' ? '已归还' : '逾期'}
                      </span>
                    </td>
                    <td>¥{getFine(r)}</td>
                    <td>
                      {r.status !== 'returned' ? (
                        <i
                          className="fas fa-rotate action-icon"
                          title="续借"
                          role="presentation"
                          onClick={() => void renewRecord(r.id)}
                        />
                      ) : null}
                      {r.status !== 'returned' ? (
                        <i
                          className="fas fa-check-circle action-icon"
                          title="标记归还"
                          role="presentation"
                          onClick={() => void markReturned(r.id)}
                        />
                      ) : null}
                      {r.status === 'borrowed' ? (
                        <i
                          className="fas fa-triangle-exclamation action-icon"
                          title="标记逾期"
                          role="presentation"
                          onClick={() => void noteExpired(r.id)}
                        />
                      ) : null}
                      <i
                        className="fas fa-info-circle action-icon"
                        role="presentation"
                        onClick={() => viewRecordDetail(r.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((i) => (
                <button
                  key={i}
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: 20 }}
                  onClick={() => setCurrentRecordPage(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={page === 'users' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-users-gear" /> 用户管理
            </h1>
            <button type="button" className="btn-primary" onClick={openAddUser}>
              <i className="fas fa-plus" /> 新增用户
            </button>
          </div>
          <div className="management-panel">
            <div className="action-bar">
              <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                <i className="fas fa-search" />
                <input
                  type="text"
                  placeholder="搜索用户名（keyword）…"
                  value={userSearchInput}
                  onChange={(e) => setUserSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setUserKeywordApplied(userSearchInput.trim());
                      setUserListPage(1);
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setUserKeywordApplied(userSearchInput.trim());
                  setUserListPage(1);
                }}
              >
                查询
              </button>
              <select
                style={{ padding: 10, borderRadius: 30, border: '1px solid #d5e2ec' }}
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUserListPage(1);
                }}
              >
                <option value="">全部角色</option>
                <option value="admin">管理员</option>
                <option value="reader">读者</option>
              </select>
            </div>
            <p style={{ color: '#3b6079', fontSize: '0.85rem', marginBottom: 12 }}>
              共 {userListTotal} 条 · 第 {userListPage} / {Math.max(1, Math.ceil(userListTotal / USER_PAGE_SIZE) || 1)} 页
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>最后登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                      暂无用户数据
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>
                        <span className={`badge ${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        <div
                          className={`status-toggle${u.status === 'active' ? ' active' : ''}`}
                          role="presentation"
                          onClick={() => toggleStatus(u.id)}
                        />
                      </td>
                      <td>{u.lastLogin || '-'}</td>
                      <td>
                        <i className="fas fa-edit action-icon" role="presentation" onClick={() => openEditUser(u.id)} />
                        <i className="fas fa-key action-icon" role="presentation" onClick={() => resetPassword(u.id)} />
                        <i
                          className="fas fa-user-slash action-icon"
                          title="删除用户"
                          role="presentation"
                          onClick={() => deleteUser(u.id)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="pagination">
              {Array.from({ length: Math.max(1, Math.ceil(userListTotal / USER_PAGE_SIZE) || 1) }, (_, i) => i + 1).map(
                (i) => (
                  <button
                    key={i}
                    type="button"
                    style={{ padding: '8px 16px', borderRadius: 20 }}
                    onClick={() => setUserListPage(i)}
                  >
                    {i}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className={page === 'roles' ? '' : 'hidden'}>
          <h2>角色权限管理</h2>
          <p style={{ marginTop: 20 }}>管理员拥有全部权限，读者仅可修改个人密码和查看个人借阅记录。</p>
        </div>

        <div className={page === 'fines' ? '' : 'hidden'}>
          <div className="page-header">
            <h1>
              <i className="fas fa-file-invoice-dollar" /> 罚款管理
            </h1>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void (async () => {
                  const target_user_id = Number(window.prompt('目标用户ID'));
                  const amount = Number(window.prompt('罚款金额（正整数）', '10'));
                  if (!target_user_id || !amount || amount <= 0) return;
                  const borrow_record_id = Number(window.prompt('借阅记录ID（可选，填0表示不关联）', '0'));
                  const note = window.prompt('备注（可选）') || undefined;
                  const res = await post('/admin_create_fine_record', {
                    target_user_id,
                    amount,
                    note,
                    borrow_record_id
                  });
                  alert(res.message || (res.success ? `罚款创建成功：#${res?.data?.fine_id ?? '-'}` : '创建失败'));
                  await loadFinesAndSet();
                })();
              }}
            >
              <i className="fas fa-plus" /> 新建罚款
            </button>
          </div>
          <div className="management-panel">
            <div className="action-bar">
              <div className="filter-group">
                <input
                  type="number"
                  className="search-box"
                  style={{ padding: 10 }}
                  placeholder="用户ID(可选)"
                  value={fineUserIdFilter}
                  onChange={(e) => setFineUserIdFilter(e.target.value)}
                />
                <select
                  className="search-box"
                  style={{ padding: '10px 20px' }}
                  value={finePaidFilter}
                  onChange={(e) => setFinePaidFilter(e.target.value)}
                >
                  <option value="">全部状态</option>
                  <option value="0">未缴</option>
                  <option value="1">已缴</option>
                </select>
              </div>
              <button type="button" className="btn-primary" onClick={() => void loadFinesAndSet()}>
                查询罚款
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户ID</th>
                  <th>借阅记录ID</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>备注</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {fines.map((f) => (
                  <tr key={f.id}>
                    <td>{f.id}</td>
                    <td>{f.reader_id ?? '-'}</td>
                    <td>{f.borrow_record_id ?? '-'}</td>
                    <td>¥{f.amount}</td>
                    <td>{Number(f.paid) === 1 ? '已缴' : '未缴'}</td>
                    <td>{f.note || '-'}</td>
                    <td>{formatTs(f.create_date)}</td>
                    <td>
                      {Number(f.paid) === 0 ? (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '6px 10px' }}
                          onClick={() => void adminPayFine(f.id)}
                        >
                          代缴
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {bookUpdateOpen ? (
        <div className="modal">
          <div className="modal-content" style={{ width: 480, maxWidth: '95%' }}>
            <h3>更新图书信息</h3>
            <p style={{ color: '#3b6079', fontSize: '0.88rem', marginTop: 8, lineHeight: 1.5 }}>
              书目 ID：{updBookId}。可选字段：ISBN、书名、作者、分类 ID、馆藏总册数（total）。若仅修改书名，请确保填写 ISBN。
            </p>
            <form onSubmit={(ev) => void submitBookUpdate(ev)}>
              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>书名</label>
                <input
                  value={updTitle}
                  onChange={(e) => setUpdTitle(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 30, border: '1px solid #d5e2ec' }}
                />
              </div>
              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>作者</label>
                <input
                  value={updAuthor}
                  onChange={(e) => setUpdAuthor(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 30, border: '1px solid #d5e2ec' }}
                />
              </div>
              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>ISBN</label>
                <input
                  value={updIsbn}
                  onChange={(e) => setUpdIsbn(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 30, border: '1px solid #d5e2ec' }}
                />
              </div>
              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>分类 ID（category_id）</label>
                <input
                  value={updCategoryId}
                  onChange={(e) => setUpdCategoryId(e.target.value)}
                  placeholder="数字，可不修改则保持原值"
                  style={{ width: '100%', padding: 12, borderRadius: 30, border: '1px solid #d5e2ec' }}
                />
              </div>
              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  馆藏总册数（total，非列表中的在架可借）
                </label>
                <input
                  value={updTotal}
                  onChange={(e) => setUpdTotal(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 30, border: '1px solid #d5e2ec' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  保存
                </button>
                <button
                  type="button"
                  style={{ flex: 1, borderRadius: 36, border: '1px solid #ccc' }}
                  onClick={() => {
                    setBookUpdateOpen(false);
                    setUpdSnapshot(null);
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {userModalOpen ? (
        <div className="modal">
          <div className="modal-content">
            <h3>{modalTitle}</h3>
            <form onSubmit={onUserFormSubmit}>
              <div style={{ margin: '20px 0' }}>
                <label>用户名</label>
                <input
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 30, border: '1px solid #d5e2ec' }}
                />
              </div>
              <div style={{ margin: '20px 0' }}>
                <label>密码</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 30, border: '1px solid #d5e2ec' }}
                />
              </div>
              <div style={{ margin: '20px 0' }}>
                <label>角色</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 30 }}
                >
                  <option value="reader">读者</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  保存
                </button>
                <button
                  type="button"
                  style={{ flex: 1, borderRadius: 36, border: '1px solid #ccc' }}
                  onClick={() => setUserModalOpen(false)}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {logoutOpen ? (
        <div className="modal">
          <div className="modal-content" style={{ width: 320, textAlign: 'center' }}>
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
