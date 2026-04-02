import type { Message } from "@prisma/client";
import { INTERVIEWER_BASE_SYSTEM } from "@/lib/prompts/interviewer";
import { getModule } from "@/lib/modules";

export const MAX_LLM_TURNS_PER_MODULE = 6;

export type OpenAIStyleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function parseModuleOrder(raw: string): number[] {
  const arr = JSON.parse(raw) as unknown;
  if (!Array.isArray(arr) || arr.some((n) => typeof n !== "number")) {
    throw new Error("Invalid moduleOrder");
  }
  return arr;
}

export function getCurrentModuleId(order: number[], phaseIndex: number): number {
  if (phaseIndex < 0 || phaseIndex >= order.length) {
    throw new Error("modulePhaseIndex out of range");
  }
  return order[phaseIndex]!;
}

function moduleFocusLine(moduleId: number): string {
  const m = getModule(moduleId);
  if (moduleId === 7) {
    return `当前模块：${m.title}。请温柔倾听对方的补充，并真诚致谢、结束访谈。结束时必须在最后一行输出 [[INTERVIEW_END]]。`;
  }
  return `当前模块：${m.title}。只讨论与本模块相关的内容；需要进入下一模块时，在最后一行输出 [[NEXT_MODULE]]。`;
}

export function buildMessagesForMiniMax(
  dbMessages: Message[],
  moduleId: number,
  followUpsInModule: number,
): OpenAIStyleMessage[] {
  const followHint =
    followUpsInModule >= MAX_LLM_TURNS_PER_MODULE - 1
      ? "\n\n（提示：本模块对话轮次已较多，请在本轮自然收尾，并按要求输出模块结束标记。）"
      : "";

  const system = `${INTERVIEWER_BASE_SYSTEM}\n\n---\n${moduleFocusLine(moduleId)}${followHint}`;

  const out: OpenAIStyleMessage[] = [{ role: "system", content: system }];

  for (const row of dbMessages) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    out.push({
      role: row.role as "user" | "assistant",
      content: row.content,
    });
  }

  return out;
}

export function stripControlMarkers(text: string): {
  cleaned: string;
  nextModule: boolean;
  interviewEnd: boolean;
} {
  const end = /\[\[INTERVIEW_END\]\]/g.test(text);
  const next = /\[\[NEXT_MODULE\]\]/g.test(text);
  const cleaned = text
    .replace(/\s*\[\[INTERVIEW_END\]\]\s*$/g, "")
    .replace(/\s*\[\[NEXT_MODULE\]\]\s*$/g, "")
    .replace(/\[\[INTERVIEW_END\]\]/g, "")
    .replace(/\[\[NEXT_MODULE\]\]/g, "")
    .trim();
  return { cleaned, nextModule: next, interviewEnd: end };
}
