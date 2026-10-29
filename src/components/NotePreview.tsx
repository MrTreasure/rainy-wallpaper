import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Bold, Check, ChevronDown, Code2, GripHorizontal, Italic, ListTodo, Maximize2, Moon, Plus, Quote, RotateCcw, StickyNote, Sun, Trash2, Type, X } from "lucide-react";
import { PaperNote } from "@/components/PaperNote";
import { createSampleNotes, noteTitle, PAPER_COLORS } from "@/lib/notes";
import type { PaperNoteData } from "@/lib/notes";

export function NotePreview() {
  const [notes, setNotes] = useState(createSampleNotes);
  const [selectedId, setSelectedId] = useState("today");
  const [dark, setDark] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [showSyntax, setShowSyntax] = useState(false);
  const [deleted, setDeleted] = useState<PaperNoteData | null>(null);
  const [message, setMessage] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const selected = notes.find((note) => note.id === selectedId) ?? notes[0];
  const colorName = PAPER_COLORS.find((color) => color.value === selected.color)?.name ?? "自定义纸色";

  function updateNote(id: string, patch: Partial<PaperNoteData>) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, ...patch } : note));
  }

  function addNote() {
    if (notes.length >= 12) { setMessage("这张桌面最多放 12 张便利贴。"); return; }
    const id = crypto.randomUUID();
    const note: PaperNoteData = { id, markdown: "## 一个新想法\n\n写点什么吧。\n\n- [ ] 一件想做的小事", color: PAPER_COLORS[notes.length % PAPER_COLORS.length].value,
      x: 45 + (notes.length % 3) * 6, y: 40 + (notes.length % 3) * 8, width: 300, height: 340, angle: (notes.length % 2 ? 1 : -1) * 1.7, curl: 0.6, tape: true };
    setNotes((current) => [...current, note]); setSelectedId(id); setShowInspector(true);
  }

  function deleteNote() {
    if (notes.length <= 1) { setMessage("留一张纸，给接下来的灵感。"); return; }
    setDeleted(selected);
    const rest = notes.filter((note) => note.id !== selected.id);
    setNotes(rest); setSelectedId(rest[0].id); setMessage("");
  }

  function insertMarkdown(prefix: string, suffix = "", fallback = "文字") {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? selected.markdown.length;
    const end = editor?.selectionEnd ?? start;
    const selection = selected.markdown.slice(start, end) || fallback;
    updateNote(selected.id, { markdown: selected.markdown.slice(0, start) + prefix + selection + suffix + selected.markdown.slice(end) });
    requestAnimationFrame(() => { editor?.focus(); editor?.setSelectionRange(start + prefix.length, start + prefix.length + selection.length); });
  }

  function downloadNote() {
    const url = URL.createObjectURL(new Blob([selected.markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = noteTitle(selected.markdown).replace(/[\\/:*?"<>|]/g, "_") + ".md";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className={`note-app ${dark ? "dark-desk" : ""} ${showInspector ? "" : "inspector-hidden"}`}>
      <header className="app-header">
        <a className="app-brand" href="#/" aria-label="纸间便利贴预览首页"><span className="brand-icon"><StickyNote size={20} strokeWidth={1.4} /></span><span>纸间<span className="brand-english">PAPER NOTES</span></span></a>
        <div className="header-center"><span className="live-dot" />便利贴交互预览</div>
        <button type="button" className="add-note-button" onClick={addNote}><Plus size={15} /><span>贴一张</span></button>
      </header>

      <div className="workspace">
        <section className="desk" aria-label="可拖动的便利贴桌面">
          <div className="desk-heading"><p className="eyebrow">A LITTLE SPACE FOR YOUR THOUGHTS</p><h1>让想法，落在纸上<span>。</span></h1><p className="desk-subtitle">一点灵感，一件小事，或一句想记住的话。</p></div>
          <div className="desk-tools">
            <button type="button" className="icon-button" onClick={() => setDark(!dark)} aria-label={dark ? "切换浅色桌面" : "切换深色桌面"} title={dark ? "浅色桌面" : "深色桌面"}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button type="button" className={`icon-button ${!showInspector ? "is-active" : ""}`} onClick={() => setShowInspector(!showInspector)} aria-label={showInspector ? "收起编辑面板" : "打开编辑面板"} aria-expanded={showInspector} title="展开 / 收起编辑面板"><Maximize2 size={16} /></button>
          </div>
          <div className="paper-board" ref={boardRef}>
            {notes.map((note) => <PaperNote key={note.id} note={note} selected={note.id === selected.id} boardRef={boardRef}
              onSelect={() => setSelectedId(note.id)} onChange={(patch) => updateNote(note.id, patch)} />)}
          </div>
          <div className="desk-bottom">
            <p className="drag-hint"><GripHorizontal size={16} strokeWidth={1.3} /><span>拿起上沿，挪到喜欢的位置</span></p>
            <div className="note-tabs" aria-label="选择便利贴">{notes.map((note, index) => <button key={note.id} type="button" className={note.id === selected.id ? "is-active" : ""} onClick={() => setSelectedId(note.id)} aria-label={`选择第 ${index + 1} 张：${noteTitle(note.markdown)}`} aria-pressed={note.id === selected.id}><span style={{ background: note.color }} />{String(index + 1).padStart(2, "0")}</button>)}</div>
          </div>
          <div className="desk-annotation" aria-hidden="true"><span className="annotation-line" /><span>像纸一样，有一点温度。</span></div>
        </section>

        {showInspector && <aside className="note-inspector" aria-label="便利贴编辑面板">
          <div className="inspector-header"><div><p className="eyebrow">MAKE IT YOURS</p><h2>这张便利贴</h2></div><span className="note-number">{String(notes.findIndex((note) => note.id === selected.id) + 1).padStart(2, "0")}<span> / {String(notes.length).padStart(2, "0")}</span></span></div>

          <section className="inspector-section color-section"><div className="section-label"><h3>纸张颜色</h3><span>{colorName}</span></div>
            <div className="color-palette">{PAPER_COLORS.map((color) => <button key={color.value} type="button" style={{ "--swatch": color.value } as CSSProperties} className={`color-swatch ${selected.color === color.value ? "is-selected" : ""}`} aria-label={`纸色：${color.name}`} aria-pressed={selected.color === color.value} title={color.name} onClick={() => updateNote(selected.id, { color: color.value })}>{selected.color === color.value && <Check size={16} strokeWidth={1.8} />}</button>)}</div>
            <label className="custom-color"><span>也可以调一款自己的颜色</span><span className="custom-color-value"><input type="color" aria-label="自定义便利贴颜色" value={selected.color} onChange={(event) => updateNote(selected.id, { color: event.target.value })} />{selected.color.toUpperCase()}</span></label>
          </section>

          <section className="inspector-section content-section"><div className="section-label"><h3>写点什么</h3><span className="markdown-badge">MARKDOWN</span></div>
            <div className="markdown-editor-shell">
              <div className="markdown-toolbar" aria-label="Markdown 格式工具">
                <button type="button" title="标题" aria-label="插入标题" onClick={() => insertMarkdown("\n## ", "", "标题")}><Type size={16} /></button>
                <button type="button" title="粗体" aria-label="插入粗体" onClick={() => insertMarkdown("**", "**")}><Bold size={15} /></button>
                <button type="button" title="斜体" aria-label="插入斜体" onClick={() => insertMarkdown("*", "*")}><Italic size={15} /></button>
                <span className="toolbar-divider" />
                <button type="button" title="待办" aria-label="插入待办事项" onClick={() => insertMarkdown("\n- [ ] ", "", "待办事项")}><ListTodo size={16} /></button>
                <button type="button" title="引用" aria-label="插入引用" onClick={() => insertMarkdown("\n> ", "", "想记住的话")}><Quote size={15} /></button>
                <button type="button" title="代码" aria-label="插入行内代码" onClick={() => insertMarkdown("`", "`", "code")}><Code2 size={16} /></button>
              </div>
              <textarea ref={editorRef} className="markdown-source" aria-label="编辑选中便利贴的 Markdown" value={selected.markdown} spellCheck={false} maxLength={20000}
                onChange={(event) => updateNote(selected.id, { markdown: event.target.value })} placeholder="# 写下你的想法" />
              <div className="editor-status"><span><span className="live-dot" />纸上实时呈现</span><span>{selected.markdown.length.toLocaleString()} 字符</span></div>
            </div>
            <button type="button" className="syntax-toggle" onClick={() => setShowSyntax(!showSyntax)} aria-expanded={showSyntax}>Markdown 小抄<ChevronDown size={12} className={showSyntax ? "is-open" : ""} /></button>
            {showSyntax && <div className="syntax-guide"><code># 标题</code><span>标题</span><code>**重点** · *斜体*</code><span>文字强调</span><code>- [ ] 待办事项</code><span>可勾选清单</span><code>&gt; 一句话</code><span>引用</span><code>[文字](https://…)</code><span>链接</span><code>~~划掉~~ · `代码`</code><span>删除线与代码</span></div>}
          </section>

          <section className="inspector-section material-section"><div className="section-label"><h3>纸张的小细节</h3><span>一点点，就刚好</span></div>
            <div className="paper-dimensions"><label>宽度 <input type="number" min={180} max={1000} value={selected.width} onChange={(event) => updateNote(selected.id, { width: Math.min(1000, Math.max(180, Number(event.target.value))) })} /> px</label><label>高度 <input type="number" min={160} max={1000} value={selected.height} onChange={(event) => updateNote(selected.id, { height: Math.min(1000, Math.max(160, Number(event.target.value))) })} /> px</label></div>
            <label className="slider-label" htmlFor="paper-angle"><span>随手贴的角度</span><output>{selected.angle.toFixed(1)}°</output></label><input className="paper-range" id="paper-angle" type="range" min={-8} max={8} step={0.1} value={selected.angle} onChange={(event) => updateNote(selected.id, { angle: Number(event.target.value) })} />
            <label className="slider-label" htmlFor="paper-curl"><span>纸角翘起</span><output>{Math.round(selected.curl * 100)}%</output></label><input className="paper-range" id="paper-curl" type="range" min={0} max={1} step={0.01} value={selected.curl} onChange={(event) => updateNote(selected.id, { curl: Number(event.target.value) })} />
            <div className="tape-row"><span>贴一小段纸胶带</span><button type="button" className="tape-switch" role="switch" aria-checked={selected.tape} aria-label="显示纸胶带" onClick={() => updateNote(selected.id, { tape: !selected.tape })}><span /></button></div>
            <div className="position-buttons"><span>移动位置</span><button type="button" aria-label="将便利贴向左移动" onClick={() => updateNote(selected.id, { x: Math.max(20, selected.x - 8) })}><ArrowLeft size={14} /></button><button type="button" onClick={() => updateNote(selected.id, { x: 50, y: 50 })}>居中</button><button type="button" aria-label="将便利贴向右移动" onClick={() => updateNote(selected.id, { x: Math.min(80, selected.x + 8) })}><ArrowRight size={14} /></button></div>
          </section>

          <div className="inspector-footer"><button type="button" className="download-button" onClick={downloadNote}><ArrowDownToLine size={14} />下载这张 .md</button><button type="button" className="icon-button delete-note" aria-label="移除选中的便利贴" title="移除便利贴，可撤销" onClick={deleteNote}><Trash2 size={15} /></button></div>
          <p className="preview-notice">这是材质与交互样张，内容仅在当前页面保留。</p>
        </aside>}
      </div>

      <footer className="app-footer"><span>PAPER, NOT PIXELS.</span><p>选中换色 <span>·</span> Markdown 实时预览 <span>·</span> 清单可以直接勾选</p><a className="preview-platform-credit" href="https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB" target="_blank" rel="noopener noreferrer">本应用通过QMuseVibeCoding平台搭建</a></footer>
      {(deleted || message) && <div className="preview-toast" role="status"><span>{message || "已移除一张便利贴"}</span>{deleted && !message && <button type="button" onClick={() => { setNotes((current) => [...current, deleted]); setSelectedId(deleted.id); setDeleted(null); }}><RotateCcw size={13} />撤销</button>}<button type="button" aria-label="关闭提示" onClick={() => { setDeleted(null); setMessage(""); }}><X size={14} /></button></div>}
    </main>
  );
}
