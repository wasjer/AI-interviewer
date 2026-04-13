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

浏览器打开 `http://localhost:3500`。

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
| `COOKIE_SECURE` | 可选：`true`/`false` 强制；不设时生产默认真，开发则按 `x-forwarded-proto` 自动（Tunnel 下等同 HTTPS） |
| `MINIMAX_API_KEY` | MiniMax 密钥 |
| `MINIMAX_BASE_URL` | 国内默认 `https://api.minimaxi.com/v1` |
| `MINIMAX_MODEL` | 如 `MiniMax-M2.1` / `MiniMax-M2.7` |

## 用 Cloudflare Tunnel 给朋友试（不在同一局域网）

**分步小白说明（你与朋友各自要做什么、装什么）：** 见 [docs/给朋友试用.md](docs/给朋友试用.md)。

使用 Cloudflare 的**临时隧道**（Quick Tunnel），无需把域名托管到 Cloudflare，会得到一个 `https://……trycloudflare.com` 地址。

**前置：** 本机已安装 [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)（macOS 可用 `brew install cloudflare/cloudflare/cloudflared`）。

**1. 安全相关（隧道等于公网可访问，务必配置）**

在 `.env` 中建议至少设置：

```env
SESSION_PASSWORD=请用至少32位随机串，例如 openssl rand -base64 32
```

开发模式下，若反代带有 `x-forwarded-proto: https`（Cloudflare Tunnel 会带），应用会**自动**为会话 Cookie 加上 `Secure`，手机通过 `https://……trycloudflare.com` 登录可保持会话；本机 `http://localhost:3500` 仍为普通 Cookie。若需强制行为，可用 `COOKIE_SECURE=true` / `COOKIE_SECURE=false` 覆盖。

并保证 `ADMIN_PASSWORD` 为强密码；给朋友用时在 `/admin` 建**普通用户**，不要把管理员密码发给对方。

**2. 开两个终端**

终端 A（应用）：

```bash
npm run dev
```

终端 B（隧道，会打印公网 URL）：

```bash
npm run tunnel
```

把终端 B 里形如 `https://xxxxx.trycloudflare.com` 的链接发给朋友即可。关闭隧道或断网后链接即失效；每次重启隧道子域名一般会变。

**说明：** 开发默认端口为 **3500**；`npm run tunnel` 对应 `cloudflared tunnel --url http://127.0.0.1:3500`。若改用别的端口，请同步改 `package.json` 里的 `dev` / `tunnel` 脚本，或本地执行  
`cloudflared tunnel --url http://127.0.0.1:你的端口`。

若你已有域名托管在 Cloudflare、需要固定子域名，可再配置 [Named Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/)（需 `cloudflared tunnel login` 与配置文件）。

## 外网部署关键点

1. 使用 HTTPS（Nginx/Caddy 反代）
2. 生产 `.env` 设置：`SESSION_PASSWORD`、`ADMIN_PASSWORD`、`COOKIE_SECURE=true`
3. 启动：`npm run build && HOSTNAME=0.0.0.0 PORT=3500 npm start`（端口可按部署环境调整，与 `next start -p` 或反代目标一致即可）

## 备注

- 旧数据若 `userId` 为空，不属于任何账号，不会出现在普通用户列表里。
- `middleware` 在 Next.js 16 提示将迁移为 `proxy`，目前不影响运行，后续可按官方建议迁移。
