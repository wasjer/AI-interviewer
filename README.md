# 小灵 · AI 访谈

基于 Next.js + SQLite + MiniMax 的访谈系统。当前权限模型：

- **普通用户**：只能登录、参与访谈、查看自己的会话。
- **管理员**：进入 `/admin` 管理用户，查看全员会话，并导出全部数据。
- **导出权限**：仅管理员可导出（普通用户无导出按钮，API 也会 403）。

## 快速开始（本机）

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 首个管理员账号

在 `.env` 里配置：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请换成你自己的强密码
```

然后在登录页用这组账号密码登录：

- 如果数据库里还没有这个用户名，会**自动创建**该管理员账号。
- 创建后可进入 `/admin`。

## 管理员功能

`/admin` 页面支持：

- 创建普通用户或管理员账号
- 查看所有用户列表
- 按用户查看会话列表
- 导出某个用户全部会话（ZIP）
- 导出全站所有会话（ZIP）
- 导出任意单场会话（Markdown）

## 环境变量

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | 默认 `file:./prisma/dev.db` |
| `SESSION_PASSWORD` | 生产必填，至少 32 字符 |
| `ADMIN_USERNAME` | 固定管理员用户名，默认 `admin` |
| `ADMIN_PASSWORD` | 固定管理员密码（建议强密码） |
| `COOKIE_SECURE` | HTTPS 场景建议 `true`；本机 http 请用 `false` 或不设置 |
| `MINIMAX_API_KEY` | MiniMax 密钥 |
| `MINIMAX_BASE_URL` | 国内默认 `https://api.minimaxi.com/v1` |
| `MINIMAX_MODEL` | 如 `MiniMax-M2.1` / `MiniMax-M2.7` |

## 外网部署关键点

1. 使用 HTTPS（Nginx/Caddy 反代）
2. 生产 `.env` 设置：`SESSION_PASSWORD`、`ADMIN_PASSWORD`、`COOKIE_SECURE=true`
3. 启动：`npm run build && HOSTNAME=0.0.0.0 PORT=3000 npm start`

## 备注

- 旧数据若 `userId` 为空，不属于任何账号，不会出现在普通用户列表里。
- `middleware` 在 Next.js 16 提示将迁移为 `proxy`，目前不影响运行，后续可按官方建议迁移。
