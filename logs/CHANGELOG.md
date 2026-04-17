# 修改日志

记录 v1.0.0 之后的所有改动，按时间倒序排列。每条记录包含：改动目的、涉及文件、以及回溯方法。

---

## 2026-04-17

### [7] 提交按钮卡顿修复 + 文字优化

**问题**：长按提交时有卡顿感；按钮上显示「长按 2 秒」字样过时。

**改动目标**：
- 用 CSS `transition` 替代 `setInterval` 驱动进度条动画，消除卡顿
- 去掉「长按 X 秒」文字，改为「提交回答 · N 条」/ 按住时「松手取消」

**涉及文件**：
| 文件 | 改动说明 |
|------|----------|
| `app/interview/[id]/page.tsx` | 移除 `holdProgress` state 和 `holdIntervalRef`；新增 `isHolding` boolean；进度条改用 `width: isHolding ? "100%" : "0%"` + `transition: width 600ms linear` |

**回溯方法**：
- 恢复 `holdProgress` state 和 `holdIntervalRef`，在 `startHold` 里重新加 `setInterval`，进度条改回 `width: ${holdProgress}%`

---

### [6] 手机端输入框体验修复

**问题**：① 点击输入框时 iOS Safari 自动缩放页面，发送按钮被遮；② 点「修改」后文字变小，输入框不展开；③ 键盘弹出后上方有大块空白。

**改动目标**：
- 消除 iOS 缩放
- 点「修改」后输入框自动撑开至内容高度，无高度上限限制
- 布局随键盘动态收缩

**涉及文件**：
| 文件 | 改动说明 |
|------|----------|
| `app/interview/[id]/page.tsx` | textarea `font-size` 改为 `16px`（低于此值 iOS 会缩放）；容器高度改为 `100dvh`；新增 `useEffect` 监听 `input` 变化重算高度；移除 128px 高度上限，改用 CSS `max-height: 50dvh` + `overflow-y-auto` |

**回溯方法**：
- textarea 改回 `text-sm`（14px），容器改回 `h-screen`，删除 `useEffect` 高度重算，恢复 `Math.min(scrollHeight, 128)` 限制

---

### [5] 模块切换承接回应

**问题**：模块切换时直接展示下一模块开场白，对用户最后一条回答没有任何呼应，体验生硬。

**改动目标**：
- `pendingModuleAdvance` 路径不再跳过 LLM，改为先调一次 LLM 生成 1-2 句自然承接
- 承接回应 + 下一模块开场白一起返回，顺序清晰

**涉及文件**：
| 文件 | 改动说明 |
|------|----------|
| `lib/interview-state.ts` | `buildMessagesForMiniMax` 新增可选参数 `extraHint?: string` |
| `app/api/sessions/[id]/messages/route.ts` | `pendingModuleAdvance` 路径改为：保存用户消息 → 调 LLM（注入收尾提示）→ 存承接回应 → 存开场白 |

**回溯方法**：
- 删除 `extraHint` 参数；`pendingModuleAdvance` 路径改回直接保存用户消息、跳过 LLM、直接返回 opener

---

### [4] 提交回答长按时长调整

**改动**：长按触发时长 1 秒 → 0.6 秒（`HOLD_MS = 600`）。

**涉及文件**：`app/interview/[id]/page.tsx`

**回溯方法**：改回 `HOLD_MS = 1000`

---

### [3] 普通用户限制为单一访谈

**问题**：普通用户可以无限新建访谈，造成数据混乱。

**改动目标**：
- 第一次登录显示「新建访谈」
- 之后登录显示「继续访谈」，直接跳转已有 session
- 后端防止重复创建

**涉及文件**：
| 文件 | 改动说明 |
|------|----------|
| `app/page.tsx` | 根据 sessions 是否为空切换按钮；有记录时去掉列表，只显示「继续访谈」+ 状态时间 |
| `app/api/sessions/route.ts` | POST 时先查询已有 session，有则直接返回，不新建 |

**回溯方法**：
- `app/page.tsx`：把「继续访谈/新建访谈」条件渲染还原为原来的「新建访谈」按钮 + session 列表
- `app/api/sessions/route.ts`：删除 POST 开头的 `existing` 查询和提前返回逻辑

---

### [2] 草稿多发言机制（发送 → 草稿 → 长按提交）

**问题**：用户每次只有一次发言机会，手滑发送无法修改。

**改动目标**：
- 「发送」追加到草稿区，不直接调 AI
- 草稿气泡显示虚线边框，下方有「修改」「删除」小按钮
- 「提交回答」按钮长按后才提交所有草稿给 LLM
- 后端接受 `contents: string[]`，多条草稿逐条入库，只调一次 LLM

**涉及文件**：
| 文件 | 改动说明 |
|------|----------|
| `app/interview/[id]/page.tsx` | 新增 `drafts` 状态、`addDraft` / `editDraft` / `deleteDraft` / `submit` 函数；草稿气泡 UI；长按进度条按钮（pointer 事件） |
| `app/api/sessions/[id]/messages/route.ts` | body 解析改为支持 `contents: string[]`；循环保存多条用户消息；单次调用 LLM |

**细节修正（同日）**：
- 草稿提交后气泡保持显示，等服务端返回后再清除（修复提交后消息消失的 bug）
- 「修改」「删除」按钮改为无背景浅灰文字，`sending` 期间隐藏

**回溯方法**：
- `page.tsx`：去掉 `drafts` 相关状态和草稿 UI，把「发送」的 `onClick` 改回原来直接调 `send()`
- `messages/route.ts`：把 body 解析改回 `{ content: string }`，去掉 `for` 循环，恢复单条 `prisma.message.create`

---

### [1] 修复模块切换时跳过用户回答的 Bug

**问题**：AI 在模块最后一个问题里同时输出了 `[[NEXT_MODULE]]`，服务端立即把下一模块开场白追加到同一次响应，用户来不及回答就看到下一个话题。

**改动目标**：
- AI 回复含 `[[NEXT_MODULE]]` 且仍有问号 → 设 `pendingModuleAdvance = true`，等用户回答后再推进
- AI 回复含 `[[NEXT_MODULE]]` 且是收尾话（无问号）→ 立即推进（原行为）
- 提示词明确禁止在同一条消息里既提问又输出标记

**涉及文件**：
| 文件 | 改动说明 |
|------|----------|
| `prisma/schema.prisma` | `Session` 表新增 `pendingModuleAdvance Boolean @default(false)` |
| `prisma/migrations/20260416233117_add_pending_module_advance/migration.sql` | 自动生成的迁移文件（勿手动修改） |
| `app/api/sessions/[id]/messages/route.ts` | POST 开头新增 `pendingModuleAdvance` 路径处理；`shouldAdvanceMid` 逻辑改为检测问号决定立即推进还是延迟 |
| `lib/prompts/interviewer.txt` | 新增规则：输出 `[[NEXT_MODULE]]` 的消息绝对不能包含新问题 |

**回溯方法**：
- 删除 schema 中的 `pendingModuleAdvance` 字段，执行 `npx prisma migrate dev --name remove_pending_module_advance`
- `messages/route.ts`：删除开头的 `pendingModuleAdvance` 分支；把 `shouldAdvanceMid` 块还原为直接 push opener，不检测问号
- `interviewer.txt`：删除「极其重要」那段新增规则

---

## v1.0.0（基线）

**提交**：`81e4acf`

包含：UI 重设计、管理功能、角色权限、MiniMax 接入、模块化访谈流程。后续所有改动均基于此版本。
