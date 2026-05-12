import { useCallback, useEffect, useState } from 'react';
import { getStoredToken, postJson } from '../lib/api';
import { pickUnreturnedCount, pickUnreturnedFromCheckResponse } from '../lib/readerUtils';
import './AdminReaderEntry.css';

function toast(msg) {
  alert(msg);
}

function isValidEmail(v) {
  return /^\S+@\S+\.\S+$/.test(v || '');
}

function extractReaderList(res) {
  const data = (res && res.data) != null ? res.data : res;
  const list = (data && (data.list || data.readers || data.items)) || [];
  const total = data && data.total != null ? Number(data.total) : list.length;
  return { list: Array.isArray(list) ? list : [], total };
}

function mapReaderRow(item) {
  const rid = item.reader_id != null ? item.reader_id : item.id;
  const fromList = pickUnreturnedCount(item);
  return {
    reader_id: rid != null ? Number(rid) : null,
    user_id: item.user_id != null ? item.user_id : '',
    username: String(item.username || ''),
    name: String(item.name || ''),
    tel: String(item.tel || ''),
    email: String(item.email || ''),
    /** 列表接口已带未还数则用数字；否则 null 表示再调 check_unreturned */
    unreturned_count: fromList !== undefined ? fromList : null
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function AdminReaderEntry() {
  const token = getStoredToken();
  const post = useCallback((path, body) => postJson(path, body, token), [token]);

  const [readers, setReaders] = useState([]);
  const [listPage, setListPage] = useState(1);
  const [listPageSize] = useState(10);
  const [listTotal, setListTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');

  const [rowEdits, setRowEdits] = useState({});

  async function fetchUnreturned(readerId) {
    const res = await post('/admin_reader_check_unreturned', { reader_id: Number(readerId) });
    if (!res || !res.success) return undefined;
    return pickUnreturnedFromCheckResponse(res);
  }

  const loadReaderList = useCallback(
    async (forcedPage) => {
      const page = forcedPage != null ? forcedPage : listPage;
      const res = await post('/admin_reader_list', {
        page,
        page_size: listPageSize,
        keyword: appliedKeyword.trim() || undefined
      });
    if (res && res.success === false) throw new Error(res.message || '列表加载失败');
    const pack = extractReaderList(res);
    setListTotal(pack.total);
    const rows = pack.list.map(mapReaderRow);
    await Promise.all(
      rows.map(async (r) => {
        if (r.reader_id == null) return;
        if (r.unreturned_count !== null) return;
        const n = await fetchUnreturned(r.reader_id);
        r.unreturned_count = n !== undefined ? n : '-';
      })
    );
    setReaders(rows);
    const edits = {};
    rows.forEach((r) => {
      edits[r.reader_id] = { name: r.name, tel: r.tel, email: r.email };
    });
    setRowEdits(edits);
    if (forcedPage != null) setListPage(forcedPage);
  },
    [post, listPage, listPageSize, appliedKeyword]
  );

  useEffect(() => {
    (async () => {
      try {
        await loadReaderList();
      } catch (e) {
        console.warn(e);
        setReaders([]);
      }
    })();
  }, [loadReaderList]);

  const pages = Math.max(1, Math.ceil(listTotal / listPageSize) || 1);

  async function submitRegister() {
    const u = username.trim();
    const p = password;
    const n = name.trim();
    const t = tel.trim();
    const em = email.trim();
    if (!u || !p || !n || !t || !em) {
      toast('请填写用户名、密码、读者姓名、电话、邮箱');
      return;
    }
    if (!isValidEmail(em)) {
      toast('邮箱格式不正确');
      return;
    }
    try {
      const res = await post('/admin_reader_create', { username: u, password: p, name: n, tel: t, email: em });
      if (!res || !res.success) {
        toast((res && res.message) || '登记失败');
        return;
      }
      setUsername('');
      setPassword('');
      setName('');
      setTel('');
      setEmail('');
      toast('读者登记成功');
      await loadReaderList(1);
    } catch (e) {
      console.error(e);
      toast('网络错误');
    }
  }

  async function saveReaderRow(reader_id) {
    const v = rowEdits[reader_id];
    if (!v) return;
    if (!reader_id) return toast('缺少读者编号');
    if (!isValidEmail(v.email)) return toast('邮箱格式不正确');
    try {
      const res = await post('/admin_reader_update', {
        reader_id,
        name: v.name.trim(),
        tel: v.tel.trim(),
        email: v.email.trim()
      });
      if (!res || !res.success) {
        toast((res && res.message) || '更新失败');
        return;
      }
      toast('已保存');
      await loadReaderList();
    } catch (e) {
      console.error(e);
      toast('网络错误');
    }
  }

  async function deleteReaderRow(reader_id) {
    if (!reader_id) return;
    const r = readers.find((x) => Number(x.reader_id) === reader_id);
    const un =
      r && r.unreturned_count != null && r.unreturned_count !== '-' ? Number(r.unreturned_count) : 0;
    if (un > 0) {
      toast('该读者有未还图书，无法删除');
      return;
    }
    if (!window.confirm(`确定删除读者编号=${reader_id} ?`)) return;
    try {
      const res = await post('/admin_reader_delete', { reader_id });
      if (!res || !res.success) {
        toast((res && res.message) || '删除失败');
        return;
      }
      toast('已删除');
      await loadReaderList();
    } catch (e) {
      console.error(e);
      toast('网络错误');
    }
  }

  function setRowField(reader_id, field, value) {
    setRowEdits((prev) => ({
      ...prev,
      [reader_id]: { ...prev[reader_id], [field]: value }
    }));
  }

  return (
    <div className="admin-reader-entry">
      <div className="management-panel">
        <h2>新建读者</h2>
        <div className="grid-3">
          <input placeholder="登录用户名" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="密码" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input placeholder="用户姓名" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="电话" autoComplete="off" value={tel} onChange={(e) => setTel(e.target.value)} />
          <input type="email" placeholder="邮箱" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-primary" onClick={() => void submitRegister()}>
            登记读者
          </button>
        </div>
      </div>

      <div className="management-panel">
        <h2>读者列表</h2>
        <div className="row" style={{ marginTop: 8 }}>
          <input placeholder="搜索关键词" style={{ minWidth: 200 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setListPage(1);
              setAppliedKeyword(keyword);
            }}
          >
            查询
          </button>
        </div>
        <p className="muted">
          共 {listTotal} 条 · 第 {listPage} / {pages} 页
        </p>
        <table>
          <thead>
            <tr>
              <th>读者编号</th>
              <th>用户编号</th>
              <th>用户名称</th>
              <th>姓名</th>
              <th>电话</th>
              <th>邮箱</th>
              <th>未还</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!readers.length ? (
              <tr>
                <td colSpan={8}>暂无数据</td>
              </tr>
            ) : (
              readers.map((r) => {
                const rid = r.reader_id;
                const un = r.unreturned_count != null && r.unreturned_count !== '-' ? r.unreturned_count : '-';
                const ed = rowEdits[rid] || { name: r.name, tel: r.tel, email: r.email };
                return (
                  <tr key={String(rid)}>
                    <td>{rid}</td>
                    <td>{r.user_id}</td>
                    <td>{escapeHtml(r.username)}</td>
                    <td>
                      <input
                        type="text"
                        value={ed.name}
                        onChange={(e) => setRowField(rid, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input type="text" value={ed.tel} onChange={(e) => setRowField(rid, 'tel', e.target.value)} />
                    </td>
                    <td>
                      <input
                        type="email"
                        value={ed.email}
                        onChange={(e) => setRowField(rid, 'email', e.target.value)}
                      />
                    </td>
                    <td>{un}</td>
                    <td>
                      <button type="button" className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => void saveReaderRow(rid)}>
                        保存
                      </button>{' '}
                      <button type="button" className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => void deleteReaderRow(rid)}>
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          {listPage > 1 ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setListPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost"
            disabled={listPage >= pages}
            style={listPage >= pages ? { opacity: 0.5 } : undefined}
            onClick={() => {
              if (listPage < pages) setListPage((p) => p + 1);
            }}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
