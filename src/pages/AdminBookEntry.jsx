import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, getStoredToken, postJson } from '../lib/api';
import './AdminBookEntry.css';

function toast(msg) {
  alert(msg);
}

function extractCategoryListFromResponse(res) {
  const d = res && res.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.categories)) return d.categories;
  if (d && Array.isArray(d.list)) return d.list;
  if (d && Array.isArray(d.items)) return d.items;
  if (res && Array.isArray(res.categories)) return res.categories;
  return [];
}

export default function AdminBookEntry() {
  const token = getStoredToken();
  const post = useCallback((path, body) => postJson(path, body, token), [token]);

  const [apiCategories, setApiCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('');

  function categoryLabelForBook(cid, categoryName) {
    if (categoryName) return String(categoryName);
    const idStr = String(cid || '');
    if (!idStr) return '';
    for (let i = 0; i < apiCategories.length; i++) {
      const c = apiCategories[i];
      const id = c.id != null ? String(c.id) : String(c.category_id || '');
      if (id === idStr) return String(c.name || c.title || id);
    }
    return idStr;
  }

  const applyCategoryRawListToSelect = useCallback((raw) => {
    if (!Array.isArray(raw)) raw = [];
    setApiCategories(raw);
  }, []);

  const loadCategoriesFromApi = useCallback(async () => {
    const res = await post('/admin_category_list', {});
    if (res && res.success === false) throw new Error(res.message || '分类加载失败');
    applyCategoryRawListToSelect(extractCategoryListFromResponse(res));
  }, [post, applyCategoryRawListToSelect]);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u || u.role !== 'admin') {
      /* 与 iframe 版一致：不强制跳转 */
    }
    (async () => {
      try {
        await loadCategoriesFromApi();
      } catch (e) {
        console.warn(e);
        toast((e && e.message) || '分类列表加载失败，请检查网络与后端是否提供 POST /api/admin_category_list');
        applyCategoryRawListToSelect([]);
      }
    })();
  }, [loadCategoriesFromApi, applyCategoryRawListToSelect]);

  async function saveBookToBackendFromForm(f) {
    const qty = f.stock != null && !Number.isNaN(Number(f.stock)) ? Number(f.stock) : 0;
    const cid = parseInt(String(f.categoryId), 10);
    const body = {
      title: f.title,
      author: f.author,
      category_id: Number.isNaN(cid) ? f.categoryId : cid,
      isbn: f.isbn,
      total: qty
    };
    return post('/admin_book_create', body);
  }

  async function addBook() {
    const f = {
      isbn: isbn.trim(),
      title: title.trim(),
      author: author.trim(),
      categoryId,
      stock: stock === '' ? null : Number(stock)
    };
    if (!f.isbn || !f.title || !f.author) {
      toast('ISBN、书名、作者不能为空');
      return;
    }
    if (!f.categoryId) {
      toast('请选择分类');
      return;
    }
    try {
      const res = await saveBookToBackendFromForm(f);
      if (!res || !res.success) {
        toast((res && res.message) || '录入失败');
        return;
      }
      setIsbn('');
      setTitle('');
      setAuthor('');
      setCategoryId('');
      setStock('');
      toast('图书录入成功');
    } catch (e) {
      console.error(e);
      toast(`网络错误：${e && e.message ? e.message : '请检查后端'}`);
    }
  }

  function exportJson() {
    const booksPayload = books.map((b) => ({
      id: b.id || undefined,
      title: b.title,
      author: b.author,
      category_id: b.category_id || undefined,
      isbn: b.isbn,
      stock: b.stock,
      status: b.status || undefined
    }));
    const payload = { books: booksPayload, apiCategories };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      (async () => {
        try {
          const p = JSON.parse(e.target.result);
          if (Array.isArray(p.apiCategories) && p.apiCategories.length) {
            applyCategoryRawListToSelect(p.apiCategories);
          } else {
            try {
              await loadCategoriesFromApi();
            } catch {
              applyCategoryRawListToSelect([]);
            }
          }
          if (Array.isArray(p.books)) {
            setBooks(
              p.books.map((raw) => {
                const cid = raw.category_id != null ? String(raw.category_id) : '';
                return {
                  id: raw.id != null ? String(raw.id) : '',
                  isbn: String(raw.isbn || ''),
                  title: String(raw.title || ''),
                  author: String(raw.author || ''),
                  cover: raw.cover || '',
                  category_id: cid,
                  categoryLabel: categoryLabelForBook(cid, raw.category_name),
                  stock: raw.stock != null ? Number(raw.stock) : 0,
                  status: raw.status != null ? String(raw.status) : '',
                  active: true
                };
              })
            );
          }
          if (
            window.confirm('是否在服务端执行 admin_book_batch_import（将上传 JSON 中的 books 数组）')
          ) {
            const items = (p.books || []).map((raw) => {
              const n =
                raw.total != null ? Number(raw.total) : raw.stock != null ? Number(raw.stock) : 0;
              const cat = raw.category_id != null ? parseInt(String(raw.category_id), 10) : NaN;
              return {
                title: raw.title || raw.name,
                author: raw.author || '',
                category_id: Number.isNaN(cat) ? raw.category_id : cat,
                isbn: raw.isbn || '',
                total: n
              };
            });
            const bir = await post('/admin_book_batch_import', { books: items });
            if (bir && bir.success) {
              toast('批量导入已提交');
              try {
                await loadCategoriesFromApi();
              } catch {
                /* ignore */
              }
            } else {
              toast((bir && bir.message) || '批量导入失败');
            }
          } else {
            toast('数据导入成功（仅本地）');
          }
        } catch {
          toast('数据导入失败：JSON 格式不正确');
        }
      })().catch((err) => {
        console.error(err);
        toast('导入处理异常');
      });
    };
    r.readAsText(file, 'utf-8');
  }

  return (
    <div className="admin-book-entry">
      <div className="management-panel">
        <h2>图书录入（管理员）</h2>
        <div className="grid-3">
          <input placeholder="ISBN" autoComplete="off" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
          <input placeholder="书名 title" autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="作者" autoComplete="off" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">请选择分类</option>
            {apiCategories.map((c) => {
              const id = c.id != null ? String(c.id) : String(c.category_id || '');
              const name = c.name || c.title || id;
              return id ? (
                <option key={id} value={id}>
                  {name}
                </option>
              ) : null;
            })}
          </select>
          <input type="number" placeholder="库存 stock" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="action-bar">
          <button type="button" className="btn-primary" onClick={() => void addBook()}>
            录入图书
          </button>
          <button type="button" onClick={exportJson}>
            导出 JSON
          </button>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => importJson(e.target.files && e.target.files[0])}
          />
        </div>
      </div>
    </div>
  );
}
