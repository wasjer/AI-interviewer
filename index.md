# 项目结构索引

> AI 访谈工具，基于 Next.js 15 + Prisma + MiniMax LLM。
> 当前版本：v1.0.0 | 更新时间：2026-04-13

---

## 顶层文件

| 文件 | 说明 |
|------|------|
| `.env` | 环境变量（MINIMAX_API_KEY、DATABASE_URL 等），**不提交 git** |
| `.env.example` | 环境变量模板，供新成员参考 |
| `middleware.ts` | Next.js 中间件：检查登录态，未登录跳 `/login`；管理员访问 `/` 跳 `/admin` |
| `next.config.ts` | Next.js 构建配置 |
| `package.json` | 依赖声明（Next.js、Prisma、iron-session、jszip 等） |
| `prisma/schema.prisma` | 数据库模型（User、Session、Message、SeedProfile、SeedJob） |
| `prisma/prisma/dev.db` | SQLite 本地数据库文件，**不提交 git** |
| `tsconfig.json` | TypeScript 配置 |
| `启动服务.command` | 双击启动开发服务器的 macOS shell 脚本 |
| `README.md` | 项目简介 |
| `AGENTS.md` / `CLAUDE.md` | AI 编程助手的项目约定 |
| `index.md` | 本文件：项目结构索引与注释 |

---

## app/ — 页面与 API 路由（Next.js App Router）

```
app/
├── layout.tsx          # 根布局：设置 <html lang="zh-CN">、全局字体、globals.css
├── globals.css         # 全局样式：Tailwind 导入、CSS 变量（Parchment 暖米色背景）、光标闪烁动画
├── page.tsx            # 首页：用户会话列表 + 新建访谈按钮（普通用户主界面）
│
├── login/
│   └── page.tsx        # 登录页：打字机动画欢迎语 + 用户名/密码表单 + 版本号（v1.0.0）
│
├── admin/
│   └── page.tsx        # 管理员界面：创建用户、用户列表（导出+删除）、Prompt 编辑器
│
├── interview/
│   └── [id]/
│       └── page.tsx    # 访谈聊天界面：气泡消息流、乐观更新、AI 打字动画
│
└── api/
    ├── auth/
    │   ├── login/route.ts       # POST：验证密码，写 iron-session cookie
    │   ├── logout/route.ts      # POST：清除 session cookie
    │   └── me/route.ts          # GET：返回当前登录用户信息
    │
    ├── sessions/
    │   ├── route.ts             # GET：列出当前用户的所有会话；POST：新建会话（随机排列模块顺序）
    │   └── [id]/
    │       ├── route.ts         # GET：获取单个会话详情（含消息列表）
    │       ├── messages/route.ts # POST：发送消息 → 调用 MiniMax → 返回 AI 回复；处理模块推进逻辑
    │       └── export/route.ts  # GET：导出单个会话为 Markdown 文件
    │
    └── admin/
        ├── users/
        │   ├── route.ts         # GET：列出所有用户；POST：创建新用户
        │   └── [id]/
        │       ├── route.ts     # DELETE：删除用户（含其全部会话）
        │       └── sessions/route.ts  # GET：列出某用户的全部会话
        ├── export/
        │   ├── all/route.ts     # GET：打包全站所有会话为 ZIP 下载
        │   └── user/[id]/route.ts     # GET：打包某用户所有会话为 ZIP 下载
        └── prompt/route.ts      # GET：读取 interviewer.txt；PUT：覆写 interviewer.txt
```

---

## components/ — 共享 UI 组件

| 文件 | 说明 |
|------|------|
| `AnimatedHello.tsx` | 打字机动画"Hello"组件：每 300ms 显示一个字母，打完暂停后循环，用于首页和访谈页顶栏 |

---

## lib/ — 业务逻辑与工具函数

| 文件 | 说明 |
|------|------|
| `db.ts` | Prisma Client 单例（防止开发热重载时多次实例化） |
| `auth-session.ts` | iron-session 配置（cookie 名、密钥、过期时间） |
| `session-options.ts` | iron-session 配置的中间件版本（适配 Next.js middleware 环境） |
| `guards.ts` | `requireAdmin()` / `requireUser()`：API 路由权限检查工具函数 |
| `password.ts` | SHA-256 密码哈希（用于存储和验证密码） |
| `modules.ts` | **⭐ AI 开场白在这里！** 定义所有访谈模块（id、标题、开场白文本）和模块随机排列逻辑 |
| `interview-state.ts` | 构建发给 MiniMax 的消息列表；解析 `[[NEXT_MODULE]]` / `[[INTERVIEW_END]]` 控制标记 |
| `minimax.ts` | MiniMax API 封装：发送消息、处理错误、返回 AI 回复文本 |
| `sanitize-assistant.ts` | 清洗 AI 回复：去掉 reasoning_split 产生的内部思考内容 |
| `export-md.ts` | 将会话（消息列表）格式化为 Markdown 导出文本 |
| `seed-generator.ts` | 访谈结束后调用 MiniMax 生成用户"人物档案"（basicInfo / soulSeed / eventsSeed），存入 SeedProfile |
| `prompts/interviewer.ts` | 读取 interviewer.txt 文件内容，暴露为 `INTERVIEWER_BASE_SYSTEM` 常量 |
| `prompts/interviewer.txt` | **⭐ AI 行为规则 Prompt**：定义追问逻辑、模块结束标记格式。可在管理员界面直接编辑 |

---

## 关键数据流：用户发一条消息时发生了什么

```
用户点击「发送」
  → app/interview/[id]/page.tsx（乐观更新：先显示用户气泡）
  → POST /api/sessions/[id]/messages
      → 读取 DB 中历史消息
      → lib/interview-state.ts: buildMessagesForMiniMax()
          → 组合 system prompt（interviewer.txt 内容 + 当前模块提示）
          → 拼接历史消息
      → lib/minimax.ts: minimaxChat() → 调用 MiniMax API
      → 检测回复中是否含 [[NEXT_MODULE]] 或 [[INTERVIEW_END]]
      → 更新 DB（保存用户消息 + AI 回复，推进模块）
      → 返回更新后的完整 session
  → page.tsx: setSession() 更新界面，AI 气泡显示
```

---

## ⭐ 修改 AI 开场白

**文件：`lib/modules.ts`**

- `MODULES[0].cannedOpener`：**访谈第一句话**，用户进入后 AI 自动发出的第一条消息
- `MODULES[1–6].cannedOpener`：每个话题模块开始时 AI 说的第一句话
- `MODULES[7].cannedOpener`：收尾模块的开场白
- 修改后立即生效（不需重启），新会话使用新开场白，已存在会话不受影响

---

## 环境变量说明（.env）

| 变量 | 说明 |
|------|------|
| `MINIMAX_API_KEY` | MiniMax 平台 API 密钥（必填） |
| `MINIMAX_BASE_URL` | API 地址，默认 `https://api.minimaxi.com/v1`（国内）；国际站用 `https://api.minimax.io/v1` |
| `MINIMAX_MODEL` | 模型名，默认 `MiniMax-M2.1` |
| `MINIMAX_REASONING_SPLIT` | 设为 `false` 可关闭 reasoning 模式（遇到回复为空时尝试） |
| `DATABASE_URL` | Prisma 数据库连接，默认 `file:../prisma/prisma/dev.db` |
| `SESSION_SECRET` | iron-session 加密密钥（至少 32 位随机字符串） |
