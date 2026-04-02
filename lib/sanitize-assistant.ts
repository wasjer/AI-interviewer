/**
 * Remove model "thinking" / planning text so only the spoken reply remains.
 */
export function sanitizeAssistantContent(raw: string): string {
  let s = raw.trim();

  // MiniMax 等可能用 think 标签；闭合标签含 "/"，不宜写在 /.../ 正则里
  const openThink = "\u003cthink\u003e";
  const closeThink = "\u003c/think\u003e";
  s = s.replace(new RegExp(`${openThink}[\\s\\S]*?${closeThink}`, "gs"), "").trim();

  s = stripLeadingMetaParagraphs(s);

  return s || raw.trim();
}

/**
 * Drop leading paragraphs that read like internal analysis (no think tags).
 */
function stripLeadingMetaParagraphs(text: string): string {
  const parts = text.split(/\n\n+/);
  let i = 0;

  while (i < parts.length) {
    const p = parts[i]!.trim();
    if (!p) {
      i++;
      continue;
    }

    const looksLikePlanning =
      /受访者|对方的回答|这个回答|简洁的回答|少于\d+|我可以追问|我会追问|我需要选择|让我选择|从以下|追问方向|选择\d+-\d+个|最有可能展开|这是一个比较/.test(
        p,
      ) && (p.length > 35 || /追问|选择|分析|模块|字数|提纲|计划/.test(p));

    if (!looksLikePlanning) break;
    i++;
  }

  const out = parts.slice(i).join("\n\n").trim();
  return out || text.trim();
}
