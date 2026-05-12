import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postJson, setSessionAuth } from '../lib/api';
import './LoginPage.css';

async function requestVerifyCode(username, email, onResult) {
  if (!username || !email) {
    onResult({ text: '请先填写用户名和邮箱', ok: false });
    return;
  }
  const result = await postJson('/get_verify_code', { username, email });
  onResult({
    text: result.message || (result.success ? '验证码已发送' : '验证码发送失败'),
    ok: !!result.success
  });
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('login');
  const [selectedRole, setSelectedRole] = useState('reader');
  const [loginMessage, setLoginMessage] = useState('');
  const [regMessage, setRegMessage] = useState('');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regName, setRegName] = useState('');
  const [regTel, setRegTel] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regVerifyCode, setRegVerifyCode] = useState('');

  useEffect(() => {
    document.title = '墨客 · 登录';
  }, []);

  const [loginMsgColor, setLoginMessageStyle] = useState('#c74545');

  async function onLoginSubmit(e) {
    e.preventDefault();
    const username = loginUsername.trim();
    const password = loginPassword;
    const verify_code = captchaInput.trim();
    if (!username || !password) {
      setLoginMessageStyle('#c74545');
      setLoginMessage('请填写用户名和密码');
      return;
    }
    if (!verify_code) {
      setLoginMessageStyle('#c74545');
      setLoginMessage('请输入邮箱验证码');
      return;
    }
    const result = await postJson('/login', { username, password, verify_code });
    if (!result.success) {
      setLoginMessageStyle('#c74545');
      setLoginMessage(result.message || '登录失败');
      return;
    }
    const { token, user_role, reader_info } = result.data || {};
    const role = Number(user_role) === 2 ? 'admin' : 'reader';
    if (role !== selectedRole) {
      setLoginMessageStyle('#c74545');
      setLoginMessage(`该账号不是${selectedRole === 'admin' ? '管理员' : '读者'}`);
      return;
    }
    setSessionAuth(token || '', { username, role, user_role, reader_info });
    if (role === 'admin') navigate('/admin');
    else navigate('/reader');
  }

  async function onRegisterSubmit(e) {
    e.preventDefault();
    const username = regUsername.trim();
    const pwd = regPassword;
    const confirm = regConfirm;
    const name = regName.trim();
    const tel = regTel.trim();
    const email = regEmail.trim();
    const verify_code = regVerifyCode.trim();
    if (username.length < 3) {
      setRegMessage('用户名至少3位');
      setRegMsgColor('#c74545');
      return;
    }
    if (pwd.length < 6) {
      setRegMessage('密码至少6位');
      setRegMsgColor('#c74545');
      return;
    }
    if (pwd !== confirm) {
      setRegMessage('两次密码不一致');
      setRegMsgColor('#c74545');
      return;
    }
    const result = await postJson('/register', {
      username,
      password: pwd,
      name,
      tel,
      email,
      verify_code
    });
    setRegMsgColor(result.success ? '#1b6b4c' : '#c74545');
    if (!result.success) {
      setRegMessage(result.message || '注册失败');
      return;
    }
    const { token, user_role, reader_info } = result.data || {};
    setSessionAuth(token || '', {
      username,
      role: Number(user_role) === 2 ? 'admin' : 'reader',
      user_role,
      reader_info
    });
    navigate('/reader');
  }

  const [regMsgColor, setRegMsgColor] = useState('#c74545');

  return (
    <div className="login-page">
      <div className="auth-card">
        <div className={view === 'login' ? '' : 'hidden'} id="loginView">
          <div className="brand">
            <div className="brand-icon">
              <i className="fas fa-book-open" />
            </div>
            <div className="brand-text">
              墨客<span>· 书阁</span>
            </div>
          </div>
          <div className="role-tabs">
            <button
              type="button"
              className={`role-tab${selectedRole === 'reader' ? ' active' : ''}`}
              onClick={() => setSelectedRole('reader')}
            >
              <i className="fas fa-user-graduate" /> 读者
            </button>
            <button
              type="button"
              className={`role-tab${selectedRole === 'admin' ? ' active' : ''}`}
              onClick={() => setSelectedRole('admin')}
            >
              <i className="fas fa-user-shield" /> 管理员
            </button>
          </div>
          <form onSubmit={onLoginSubmit}>
            <div className="input-group">
              <div className="input-label">
                <i className="far fa-user" /> 用户名
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="用户名"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              />
            </div>
            <div className="input-group">
              <div className="input-label">
                <i className="fas fa-lock" /> 密码
              </div>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <div className="input-group">
              <div className="input-label">
                <i className="fas fa-shield-alt" /> 验证码
              </div>
              <div className="captcha-row">
                <input
                  type="text"
                  className="input-field captcha-input"
                  placeholder="邮箱"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
                <button
                  type="button"
                  className="captcha-display small-text"
                  onClick={() => {
                    void requestVerifyCode(loginUsername.trim(), emailInput.trim(), (o) => {
                      setLoginMessageStyle(o.ok ? '#1b6b4c' : '#c74545');
                      setLoginMessage(o.text);
                    });
                  }}
                >
                  获取验证码
                </button>
              </div>
            </div>
            <div className="input-group">
              <div className="input-label">
                <i className="fas fa-envelope-open-text" /> 邮箱验证码
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="输入邮箱收到的验证码"
                maxLength={8}
                required
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
              />
            </div>
            <div className="form-extra">
              <a
                href="#"
                className="forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  alert('请联系管理员重置密码。测试账号：reader/123456 ； admin/admin123');
                }}
              >
                <i className="far fa-question-circle" /> 忘记密码？
              </a>
            </div>
            <button type="submit" className="btn-login">
              <i className="fas fa-arrow-right-to-bracket" /> 登录
            </button>
            <div className="message-area" style={{ color: loginMsgColor }}>
              {loginMessage}
            </div>
          </form>
          <div className="register-hint">
            还没有账号？
            <button type="button" className="register-link" onClick={() => setView('register')}>
              立即注册
            </button>
          </div>
        </div>

        <div className={view === 'register' ? '' : 'hidden'} id="registerView">
          <div className="brand brand-tight">
            <div className="brand-icon">
              <i className="fas fa-user-plus" />
            </div>
            <div className="brand-text">
              注册<span>· 新读者</span>
            </div>
          </div>
          <p className="register-sub">创建账号，默认成为读者</p>
          <form onSubmit={onRegisterSubmit}>
            <div className="input-group">
              <div className="input-label">用户名</div>
              <input
                type="text"
                className="input-field"
                placeholder="设置用户名"
                required
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
              />
            </div>
            <div className="input-group">
              <div className="input-label">密码</div>
              <input
                type="password"
                className="input-field"
                placeholder="至少6位"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <div className="input-group">
              <div className="input-label">确认密码</div>
              <input
                type="password"
                className="input-field"
                placeholder="再次输入密码"
                required
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
              />
            </div>
            <div className="input-group">
              <div className="input-label">姓名</div>
              <input
                type="text"
                className="input-field"
                placeholder="真实姓名"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <div className="input-label">手机号</div>
              <input
                type="text"
                className="input-field"
                placeholder="11位手机号"
                required
                value={regTel}
                onChange={(e) => setRegTel(e.target.value)}
              />
            </div>
            <div className="input-group">
              <div className="input-label">邮箱</div>
              <div className="captcha-row">
                <input
                  type="email"
                  className="input-field captcha-input"
                  placeholder="邮箱地址"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
                <button
                  type="button"
                  className="captcha-display small-text"
                  onClick={() => {
                    void requestVerifyCode(regUsername.trim(), regEmail.trim(), (o) => {
                      setRegMsgColor(o.ok ? '#1b6b4c' : '#c74545');
                      setRegMessage(o.text);
                    });
                  }}
                >
                  获取验证码
                </button>
              </div>
            </div>
            <div className="input-group">
              <div className="input-label">邮箱验证码</div>
              <input
                type="text"
                className="input-field"
                placeholder="输入注册验证码"
                required
                value={regVerifyCode}
                onChange={(e) => setRegVerifyCode(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-login btn-login-mt">
              注册
            </button>
            <div className="message-area" style={{ color: regMsgColor }}>
              {regMessage}
            </div>
          </form>
          <div className="register-hint register-hint-tight">
            <button type="button" className="register-link" onClick={() => setView('login')}>
              <i className="fas fa-arrow-left" /> 返回登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
