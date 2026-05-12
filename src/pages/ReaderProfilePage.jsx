import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearSessionAuth, getCurrentUser, getStoredToken, postJson } from '../lib/api';
import './ReaderProfilePage.css';

export default function ReaderProfilePage() {
  const navigate = useNavigate();
  const token = getStoredToken();
  const [profileId, setProfileId] = useState('');
  const [profileUserId, setProfileUserId] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileType, setProfileType] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileUpdatedAt, setProfileUpdatedAt] = useState('-');

  const post = useCallback((path, body) => postJson(path, body, token), [token]);

  function getReaderIdFromSession() {
    const currentUser = getCurrentUser();
    const ri = currentUser && currentUser.reader_info;
    if (!ri) return null;
    const v = ri.reader_id != null ? ri.reader_id : ri.id;
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  const renderProfile = useCallback(async () => {
    const currentUser = getCurrentUser();
    let res = await post('/reader_self_info_get', {});
    let info = (res && res.data) || {};
    const rid = getReaderIdFromSession();
    if ((!res || !res.success) && rid != null) {
      const adminTry = await post('/admin_reader_get', { reader_id: rid });
      if (adminTry && adminTry.success && adminTry.data) {
        res = adminTry;
        info = adminTry.data;
      }
    }
    if (!res || !res.success) {
      alert((res && res.message) || '资料加载失败');
      return;
    }
    let idVal = info.reader_id != null ? String(info.reader_id) : info.id != null ? String(info.id) : '-';
    if ((idVal === '-' || idVal === '') && rid != null) idVal = String(rid);
    setProfileId(idVal);
    setProfileUserId(info.user_id != null ? String(info.user_id) : '');
    setProfileUsername(
      info.username != null ? String(info.username) : currentUser?.username || ''
    );
    setProfileName(info.name || '');
    setProfileGender(info.gender != null && info.gender !== '' ? String(info.gender) : '未设置');
    setProfileType(
      info.reader_type != null && info.reader_type !== ''
        ? String(info.reader_type)
        : info.type != null && info.type !== ''
          ? String(info.type)
          : '普通读者'
    );
    setProfileEmail(info.email || '');
    setProfilePhone(info.tel || '');
    setProfileUpdatedAt(new Date().toLocaleString('zh-CN', { hour12: false }));
  }, [post]);

  useEffect(() => {
    document.title = '个人中心 · 墨客';
  }, []);

  useEffect(() => {
    void renderProfile();
  }, [renderProfile]);

  async function onSaveProfile() {
    const name = profileName.trim();
    const tel = profilePhone.trim();
    const email = profileEmail.trim();
    const reader_id = getReaderIdFromSession();
    let res = await post('/reader_self_info_update', { name, tel, email });
    if ((!res || !res.success) && reader_id != null) {
      res = await post('/admin_reader_update', { reader_id, name, tel, email });
    }
    alert(res.message || (res.success ? '个人资料已保存' : '保存失败'));
    if (res.success) void renderProfile();
  }

  async function onChangePwd() {
    const old_password = window.prompt('请输入当前密码');
    const new_password = window.prompt('请输入新密码');
    if (!old_password || !new_password) return;
    const res = await post('/reader_self_password_change', { old_password, new_password });
    alert(res.message || (res.success ? '密码修改成功' : '密码修改失败'));
  }

  function onLogout() {
    clearSessionAuth();
    navigate('/login');
  }

  return (
    <div className="reader-profile-page">
      <div className="sidebar">
        <div className="sidebar-title">墨客·读者</div>
        <Link className="nav-item" to="/reader">
          图书查询 / 我的借阅
        </Link>
        <Link className="nav-item active" to="/reader/profile">
          个人中心
        </Link>
        <button type="button" className="nav-item" style={{ marginTop: 40 }} onClick={onLogout}>
          注销
        </button>
      </div>
      <div className="main-content">
        <h2>个人中心（读者）</h2>
        <div className="panel">
          <div className="grid-2">
            <input className="input-field" placeholder="读者编号" disabled value={profileId} readOnly />
            <input className="input-field" placeholder="user_id" disabled title="user_id" value={profileUserId} readOnly />
            <input
              className="input-field"
              placeholder="登录用户名"
              disabled
              title="username"
              value={profileUsername}
              readOnly
            />
            <input className="input-field" placeholder="姓名" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            <input className="input-field" placeholder="性别" disabled value={profileGender} readOnly />
            <input className="input-field" placeholder="读者类型" disabled value={profileType} readOnly />
            <input className="input-field" placeholder="邮箱" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
            <input className="input-field" placeholder="电话" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
          </div>
          <input
            className="input-field"
            type="file"
            accept="image/*"
            onChange={() => alert('当前后端接口未提供头像上传，暂不支持。')}
          />
          <p>
            最近修改时间：<span>{profileUpdatedAt}</span>
          </p>
          <button type="button" className="btn-primary" onClick={() => void onSaveProfile()}>
            保存资料
          </button>
          <button type="button" className="btn-primary" style={{ marginLeft: 10 }} onClick={() => void onChangePwd()}>
            修改密码
          </button>
        </div>
      </div>
    </div>
  );
}
