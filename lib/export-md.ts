import type { Message, Session } from "@prisma/client";
import { getModule } from "@/lib/modules";

export function buildExportMarkdown(session: Session & { messages: Message[] }): string {
  const order = JSON.parse(session.moduleOrder) as number[];
  const lines: string[] = [];

  lines.push(`# 访谈记录`);
  lines.push(``);
  lines.push(`- 会话 ID：${session.id}`);
  lines.push(`- 开始时间：${session.createdAt.toISOString()}`);
  lines.push(`- 结束/更新时间：${session.updatedAt.toISOString()}`);
  lines.push(`- 状态：${session.status}`);
  lines.push(`- 模块顺序：${order.join(" → ")}`);
  lines.push(``);

  const chronological = [...session.messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

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
      const who = msg.role === "user" ? "受访者" : "小灵";
      lines.push(`**${who}**`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
    }
  }

  return lines.join("\n");
}
