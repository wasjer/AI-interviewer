# stone · AI 访谈

基于 Next.js + SQLite + MiniMax 的深度访谈系统。访谈者 stone 会引导受访者聊人生故事、重要时刻、价值观等话题，完整记录并支持导出。

## 权限模型

- **普通用户**：登录后参与访谈，只能看到自己的会话，限一个访谈。
- **管理员**：进入 `/admin` 管理用户、查看全员会话、导出全部数据。

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

用这组账号登录，若数据库里不存在该用户名，会**自动创建**管理员账号，之后可进入 `/admin`。

## 管理员功能

`/admin` 页面支持：

- 创建普通用户或管理员账号
- 查看所有用户列表
- 按用户查看会话列表
- 导出某个用户全部会话（ZIP）
- 导出全站所有会话（ZIP）
- 导出任意单场会话（Markdown，访谈者标签为 stone）

## 访谈流程

每场访谈由 8 个模块组成（开场 + 6 个随机排序的话题模块 + 收尾），每模块最多 6 轮追问，全部完成后自动标记为「已完成」。

**用户端操作：**
1. 点「发送」将回答追加到草稿区（可多条）
2. 草稿支持修改和删除
3. 按住「提交回答」按钮（约 0.6 秒）才真正发给 AI，防止手滑

## 环境变量

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | 默认 `file:./prisma/dev.db` |
| `SESSION_PASSWORD` | 生产必填，至少 32 字符 |
| `ADMIN_USERNAME` | 固定管理员用户名，默认 `admin` |
| `ADMIN_PASSWORD` | 固定管理员密码（建议强密码） |
| `COOKIE_SECURE` | 可选：`true`/`false` 强制；不设时生产默认真，Tunnel 下自动按 `x-forwarded-proto` 判断 |
| `MINIMAX_API_KEY` | MiniMax 密钥 |
| `MINIMAX_BASE_URL` | 国内默认 `https://api.minimaxi.com/v1` |
| `MINIMAX_MODEL` | 如 `MiniMax-M2.1` / `MiniMax-M2.7` |

## 用 Cloudflare Tunnel 给朋友试用

**分步说明见：** [docs/给朋友试用.md](docs/给朋友试用.md)

使用 Cloudflare **临时隧道**（Quick Tunnel），无需域名，会得到一个 `https://……trycloudflare.com` 地址。

**前置：** 本机安装 [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)（macOS：`brew install cloudflare/cloudflare/cloudflared`）。

**启动步骤：**

```bash
# 终端 A：启动应用
npm run dev

# 终端 B：启动隧道（会打印公网 URL）
npm run tunnel
```

把终端 B 打印的 `https://xxxxx.trycloudflare.com` 发给朋友即可。关闭隧道后链接失效，每次重启子域名会变。

**安全提醒：** 隧道等于公网可访问，务必在 `.env` 中设置强密码，并通过 `/admin` 为朋友创建**普通用户**账号，不要把管理员密码发出去。

## 外网部署关键点

1. 使用 HTTPS（Nginx/Caddy 反代）
2. `.env` 设置：`SESSION_PASSWORD`、`ADMIN_PASSWORD`、`COOKIE_SECURE=true`
3. 启动：`npm run build && HOSTNAME=0.0.0.0 PORT=3500 npm start`

## 备注

- 旧数据若 `userId` 为空，不属于任何账号，不会出现在用户列表里。
- `middleware` 在 Next.js 16 提示将迁移为 `proxy`，目前不影响运行。
- 修改历史见 [logs/CHANGELOG.md](logs/CHANGELOG.md)。
