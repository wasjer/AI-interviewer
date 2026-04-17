import type { Message, Session } from "@prisma/client";
import { getModule } from "@/lib/modules";

export function buildExportMarkdown(session: Session & { messages: Message[] }): string {
  const order = JSON.parse(session.moduleOrder) as number[];
  const lines: string[] = [];
  const chronological = [...session.messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const completedModules = [...new Set(chronological.map((m) => m.moduleId))];
  const durationMin = Math.max(
    0,
    Math.round((session.updatedAt.getTime() - session.createdAt.getTime()) / 60000),
  );

  lines.push(`---`);
  lines.push(`session_id: ${session.id}`);
  lines.push(`user_id: ${session.userId ?? "unknown"}`);
  lines.push(`status: ${session.status}`);
  lines.push(`completed_at: ${session.updatedAt.toISOString()}`);
  lines.push(`modules_completed: [${completedModules.join(", ")}]`);
  lines.push(`interview_duration_minutes: ${durationMin}`);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# 访谈记录`);
  lines.push(``);
  lines.push(`- 会话 ID：${session.id}`);
  lines.push(`- 用户 ID：${session.userId ?? "unknown"}`);
  lines.push(`- 开始时间：${session.createdAt.toISOString()}`);
  lines.push(`- 结束/更新时间：${session.updatedAt.toISOString()}`);
  lines.push(`- 状态：${session.status}`);
  lines.push(`- 模块顺序：${order.join(" → ")}`);
  lines.push(``);

  const sectionOrder: number[] = [];
  const seen = new Set<number>();
  for (const m of chronological) {
    if (!seen.has(m.moduleId)) {
      seen.add(m.moduleId);
      sectionOrder.push(m.moduleId);
    }
  }

  const byModule = new Map<number, Message[]>();
  for (const m of chronological) {
    const list = byModule.get(m.moduleId) ?? [];
    list.push(m);
    byModule.set(m.moduleId, list);
  }

  for (const modId of sectionOrder) {
    const title = getModule(modId).title;
    lines.push(`## 模块 ${modId}：${title}`);
    lines.push(``);
    const msgs = byModule.get(modId) ?? [];
    for (const msg of msgs) {
      const who = msg.role === "user" ? "受访者" : "stone";
      lines.push(`**${who}**`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
    }
  }

  return lines.join("\n");
}
