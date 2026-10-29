export const PAPER_COLORS = [
  { name: "奶油黄", value: "#f2de8e" },
  { name: "樱花粉", value: "#edbdc4" },
  { name: "鼠尾草", value: "#c8d7b7" },
  { name: "雾蓝", value: "#bed2df" },
  { name: "丁香紫", value: "#d3c4df" },
  { name: "杏子橙", value: "#edc49e" },
  { name: "暖白", value: "#f0eadb" },
  { name: "石墨", value: "#465151" },
] as const;

export interface PaperNoteData {
  id: string;
  markdown: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  curl: number;
  tape: boolean;
}

export function noteTitle(markdown: string) {
  return markdown.split("\n").find((line) => line.trim())?.replace(/^#+\s*/, "").slice(0, 28) || "还没写下的想法";
}

export function paperInk(hex: string) {
  const rgb = hex.slice(1).match(/.{2}/g)?.map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb && rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 0.24 ? "#f7f1df" : "#3c392c";
}

/** Keep task state in Markdown, so checking a task also updates its source. */
export function toggleMarkdownTask(markdown: string, offset: number) {
  const match = markdown.slice(offset).match(/^(?:[-+*]|\d+[.)])\s+\[([ xX])\]/);
  if (!match) return markdown;
  const index = offset + match[0].lastIndexOf("[") + 1;
  return markdown.slice(0, index) + (match[1] === " " ? "x" : " ") + markdown.slice(index + 1);
}

export function createSampleNotes(): PaperNoteData[] {
  return [
    {
      id: "today", color: PAPER_COLORS[0].value, x: 34, y: 43, width: 326, height: 440, angle: -2.2, curl: 0.65, tape: true,
      markdown: "# 今天，慢一点\n\n把重要的小事，\n一件一件放在心上。\n\n- [x] 泡一杯喜欢的茶\n- [ ] 专注写完手头的事\n- [ ] 傍晚出去走走\n\n> 不必赶路，也能抵达。\n\n留一点 **空白**，给自己。",
    },
    {
      id: "inspiration", color: PAPER_COLORS[1].value, x: 77, y: 25, width: 246, height: 295, angle: 3.5, curl: 0.8, tape: false,
      markdown: "## 一点灵感\n\n把窗外的雨声，\n折进一张小小的纸里。\n\n*Keep a little room\nfor the unexpected.*\n\n—— 写给此刻",
    },
    {
      id: "weekend", color: PAPER_COLORS[2].value, x: 72, y: 76, width: 264, height: 270, angle: -3.1, curl: 0.45, tape: true,
      markdown: "## 周末的小计划\n\n- [ ] 去逛一家旧书店\n- [x] 给植物浇水\n- [ ] 做一顿认真的早餐\n\n`生活，也需要留白。`",
    },
  ];
}
