import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from "react";
import { Check, GripHorizontal, Pencil, MoveDiagonal2 } from "lucide-react";
import { reachablePosition } from "@/lib/note-layout";
import { MarkdownNote } from "./MarkdownNote";
import { noteTitle, paperInk, toggleMarkdownTask } from "@/lib/notes";
import type { PaperNoteData } from "@/lib/notes";

interface Props {
  note: PaperNoteData;
  selected: boolean;
  boardRef: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onChange: (patch: Partial<PaperNoteData>) => void;
  allowOverflow?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function PaperNote({ note, selected, boardRef, onSelect, onChange, allowOverflow = false, editing: externalEditing, onEditingChange }: Props) {
  const [localEditing, setLocalEditing] = useState(false);
  const editing = externalEditing ?? localEditing;
  const setEditing = (value: boolean) => { setLocalEditing(value); onEditingChange?.(value); };
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number; width: number; height: number; halfWidth: number; halfHeight: number; left: number; top: number } | null>(null);
  const paperRef = useRef<HTMLElement>(null);
  const resize = useRef<{ id: number; x: number; y: number; width: number; height: number; centerX: number; centerY: number; boardWidth: number; boardHeight: number } | null>(null);

  const current = useRef({note,onChange}); current.current={note,onChange};
  function bound(x:number,y:number,width?:number,height?:number){
    const board=boardRef.current?.getBoundingClientRect(),paper=paperRef.current?.getBoundingClientRect();
    if(!board||!paper)return {x,y};
    return reachablePosition(x,y,board,{width:width??paper.width,height:height??paper.height},{width:innerWidth,height:innerHeight},allowOverflow);
  }
  useEffect(()=>{
    if(!allowOverflow)return;
    const recover=()=>{const n=current.current.note,board=boardRef.current?.getBoundingClientRect(),paper=paperRef.current?.getBoundingClientRect();if(!board||!paper)return;const p=reachablePosition(n.x,n.y,board,paper,{width:innerWidth,height:innerHeight},true);if(Math.abs(p.x-n.x)>.01||Math.abs(p.y-n.y)>.01)current.current.onChange(p)};
    recover();window.addEventListener('resize',recover);return()=>window.removeEventListener('resize',recover);
  },[allowOverflow,boardRef]);

  function beginResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation(); onSelect();
    const board = boardRef.current?.getBoundingClientRect();
    if (!board) return;
    resize.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: note.width, height: note.height, centerX: note.x, centerY: note.y, boardWidth: board.width, boardHeight: board.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const start = resize.current;
    if (!start || start.id !== event.pointerId) return;
    const a = note.angle * Math.PI / 180;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    const width = Math.round(Math.min(1000, Math.max(180, start.width + dx * Math.cos(a) + dy * Math.sin(a))));
    const height = Math.round(Math.min(1000, Math.max(160, start.height - dx * Math.sin(a) + dy * Math.cos(a))));
    const dw = (width - start.width) / 2, dh = (height - start.height) / 2;
    onChange({ width, height, ...bound(
      start.centerX + (dw * Math.cos(a) - dh * Math.sin(a)) / start.boardWidth * 100,
      start.centerY + (dw * Math.sin(a) + dh * Math.cos(a)) / start.boardHeight * 100,
      width*Math.abs(Math.cos(a))+height*Math.abs(Math.sin(a)),height*Math.abs(Math.cos(a))+width*Math.abs(Math.sin(a))) });
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !boardRef.current || !paperRef.current) return;
    event.preventDefault(); onSelect();
    const board = boardRef.current.getBoundingClientRect();
    const paper = paperRef.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: note.x, y: note.y,
      width: board.width, height: board.height, halfWidth: Math.max(96, paper.width - 2 * paperRef.current.offsetHeight * Math.abs(Math.sin(note.angle * Math.PI / 180))) / 2, halfHeight: paper.height / 2, left: board.left, top: board.top };
    event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    onChange(reachablePosition(start.x + (event.clientX - start.startX) / start.width * 100,
      start.y + (event.clientY - start.startY) / start.height * 100,
      {width:start.width,height:start.height,left:start.left,top:start.top},
      {width:start.halfWidth*2,height:start.halfHeight*2},{width:innerWidth,height:innerHeight},allowOverflow));
  }

  function endDrag() { drag.current = null; setDragging(false); }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key]; if (!direction) return;
    event.preventDefault(); const step = event.shiftKey ? 5 : 1;
    onChange(bound(note.x + direction[0] * step,note.y + direction[1] * step));
  }

  const style = { "--note-left": `${note.x}%`, "--note-top": `${note.y}%`, "--paper-color": note.color, "--paper-ink": paperInk(note.color), "--paper-angle": `${note.angle}deg`,
    "--paper-curl": note.curl, "--paper-width": `${note.width}px`, "--paper-height": `${note.height}px`, left: `${note.x}%`, top: `${note.y}%` } as CSSProperties;

  return (
    <article ref={paperRef} style={style} className={`paper-note ${selected ? "is-selected" : ""} ${dragging ? "is-dragging" : ""} ${editing ? "is-editing" : ""}`}
      aria-label={`便利贴：${noteTitle(note.markdown)}`} onPointerDown={onSelect}>
      {allowOverflow && <button type="button" className="paper-drag-surface" aria-label="拖动便利贴顶部或胶带，方向键微调" title="拖动顶部或胶带移动"
        onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={moveWithKeyboard} />}
      <div className="paper-cast-shadow" aria-hidden="true" />
      <div className="paper-sheet">
        <div className="paper-glue" aria-hidden="true" />
        <div className="paper-topbar">
          <button type="button" className="paper-grip" tabIndex={allowOverflow ? -1 : 0} aria-hidden={allowOverflow || undefined} aria-label="移动便利贴，可拖动或使用方向键" title="拖动移动 · 方向键微调"
            onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={moveWithKeyboard}>
            <GripHorizontal size={20} strokeWidth={1.3} aria-hidden="true" />
          </button>
          <button type="button" className="paper-edit-button" aria-label={editing ? "预览 Markdown" : "在纸上编辑 Markdown"}
            title={editing ? "预览 Markdown" : "在纸上编辑 Markdown"} onClick={() => { onSelect(); setEditing(!editing); }}>
            {editing ? <Check size={14} /> : <Pencil size={13} />}
          </button>
        </div>
        {editing ? (
          <textarea className="paper-inline-editor" aria-label="便利贴 Markdown 原文" autoFocus spellCheck={false}
            value={note.markdown} placeholder="# 写下你的想法" maxLength={20000} onChange={(event) => onChange({ markdown: event.target.value })}
            onKeyDown={(event) => { if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) setEditing(false); }} />
        ) : <MarkdownNote markdown={note.markdown || "*写下你的第一句话……*"}
          onToggleTask={(offset) => onChange({ markdown: toggleMarkdownTask(note.markdown, offset) })} />}
        <div className="paper-bottom-light" aria-hidden="true" />
      </div>
      {note.tape && <div className="paper-tape" aria-hidden="true" />}
      <span className="paper-corner" aria-hidden="true" />
      {selected && editing && <button type="button" className="paper-resize-handle" aria-label="调整便利贴宽度和高度" title="拖动调整宽高；方向键微调"
        onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={() => { resize.current = null; }} onPointerCancel={() => { resize.current = null; }} onLostPointerCapture={() => { resize.current = null; }}
        onKeyDown={(event) => { const steps: Record<string, [number, number]> = { ArrowLeft: [-10,0], ArrowRight: [10,0], ArrowUp: [0,-10], ArrowDown: [0,10] }; const d = steps[event.key]; if (d) { event.preventDefault(); onChange({ width: Math.min(1000, Math.max(180, note.width + d[0])), height: Math.min(1000, Math.max(160, note.height + d[1])) }); } }}><MoveDiagonal2 size={17} /></button>}
    </article>
  );
}
