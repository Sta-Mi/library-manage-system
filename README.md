# Library Manage System（前端静态页）

本仓库是一个基于原生 HTML/CSS/JavaScript 的图书管理前端页面集合，已从本地 `localStorage` 模拟逻辑迁移为**后端 API 驱动**（POST + JSON + JWT）。

---

## 1. 页面说明

- `login.html`：登录/注册页（保存 `accessToken`、`currentUser` 到 `sessionStorage`）。  
- `reader.html`：读者图书查询、借阅记录、借还书、续借、罚款展示。  
- `reader-profile.html`：读者个人资料、自助改资料/改密码/借阅历史。  
- `admin.html`：管理员图书查询、借阅流通、借阅记录、用户管理（新增/编辑/禁用/删用户/重置密码/改角色）。  

---

## 2. 后端对接约定

- Base URL：`http://127.0.0.1:8082`  
- 接口路径：`/api/<name>`  
- 方法：`POST`  
- 请求头：`Content-Type: application/json`  
- 鉴权：
  - 游客接口：不带 token
  - User/Admin：`Authorization: Bearer <token>`
- 响应结构：`{ success, code, message, data }`

---

## 3. 已接入接口总览

### 3.1 Login&Register（api01）

- `POST /api/get_verify_code`
- `POST /api/login`
- `POST /api/register`
- `POST /api/findback_account`
- `POST /api/change_password`

### 3.2 Reader（api01）

- `POST /api/get_book_list`
- `POST /api/borrow_book`
- `POST /api/return_book`
- `POST /api/borrow_record_list`
- `POST /api/keep_book`
- `POST /api/fine_record_list`

### 3.3 Admin（api01）

- `POST /api/admin_borrow_book`
- `POST /api/admin_return_book`
- `POST /api/admin_borrow_record_list`
- `POST /api/admin_keep_book`
- `POST /api/admin_fine_record_list`
- `POST /api/admin_pay_fine`
- `POST /api/admin_note_expired`
- `POST /api/admin_create_fine_record`
- `POST /api/admin_change_password`
- `POST /api/admin_add_user`
- `POST /api/admin_edit_user_info`
- `POST /api/admin_set_user_state`
- `POST /api/admin_delete_user`
- `POST /api/admin_set_user_role`
- `POST /api/account_manage`

### 3.4 Reader Self（api02）

- `POST /api/reader_self_info_get`
- `POST /api/reader_self_info_update`
- `POST /api/reader_self_borrow_history`
- `POST /api/reader_self_password_change`

---

## 4. 关键改造点（相对旧版）

1. **去除主要业务本地模拟**
   - 图书、借阅、续借、归还、罚款、用户管理动作改由后端接口处理。
2. **统一 API 调用方式**
   - 页面内使用 `postJson` 统一封装 JSON POST + Bearer Token。
3. **字段与后端契约对齐**
   - 图书列表按 `category_name`、`total` 渲染。
   - 借阅状态按 `0/1/2` 映射为 借阅中/已归还/逾期。
   - 时间字段使用 Unix 秒时间戳并在前端格式化显示。
4. **读者个人中心 API 化**
   - 支持读取/更新个人信息、修改密码、拉取个人借阅历史。
5. **管理员用户操作 API 化**
   - 支持新增、编辑、启停、删用户、重置密码、改角色。

---

## 5. 本地运行

这是静态页面项目，可直接用任意静态服务器启动，例如：

```bash
python -m http.server 5500
```

然后访问：

- `http://127.0.0.1:5500/login.html`

> 注意：需确保后端服务 `http://127.0.0.1:8082` 正常启动并允许当前前端来源（CORS）。

---

## 6. 当前限制与说明

- 当前提供的接口文档中未包含“管理员用户列表查询”接口；因此用户表格的“列表来源”能力仍受接口可用性约束，新增/编辑/状态变更/删除等动作已接入后端接口。  
- `reader-profile.html` 中头像上传后端暂无对应接口，前端保留提示，不执行上传。  
