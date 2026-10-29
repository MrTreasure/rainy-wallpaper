import type {PaperNoteData} from './notes';

type Area={width:number;height:number;left:number;top:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** Keep a usable piece of the top edge on screen, including on rotated papers. */
export function reachablePosition(x:number,y:number,area:Area,paper:{width:number;height:number},viewport:{width:number;height:number},overflow:boolean){
 const edge=Math.min(96,paper.width/2);
 const minX=overflow?(edge-paper.width/2-area.left)/area.width*100:Math.min(48,paper.width/2/area.width*100);
 const maxX=overflow?(viewport.width-edge+paper.width/2-area.left)/area.width*100:100-minX;
 const minY=overflow?clamp((paper.height/2-area.top)/area.height*100,0,100):Math.min(50,(paper.height/2+22)/area.height*100);
 const maxY=Math.max(minY,100-Math.min(48,paper.height/2/area.height*100));
 return {x:clamp(x,minX,maxX),y:clamp(y,minY,maxY)};
}

/** Size-aware shelves; crowded rows overlap at their bottoms, leaving their tops available. */
export function arrangeNotePositions(notes:PaperNoteData[],width:number,height:number,viewport:{width:number;height:number}){
 if(!notes.length||width<=0||height<=0)return [];
 const gap=26,padding=20,available=Math.max(1,width-padding*2);
 const rows:{items:{note:PaperNoteData;width:number;height:number}[];width:number;height:number}[]=[];
 for(const note of notes){
  const angle=Math.abs(note.angle)*Math.PI/180;
  const w=Math.min(note.width,viewport.width-42),h=Math.min(note.height,viewport.height-(viewport.width<=760?210:170));
  const item={note,width:w*Math.cos(angle)+h*Math.sin(angle),height:h*Math.cos(angle)+w*Math.sin(angle)};
  let row=rows.find(r=>r.width+gap+item.width<=available);
  if(!row){row={items:[],width:0,height:0};rows.push(row)}
  row.width+=(row.items.length?gap:0)+item.width;row.height=Math.max(row.height,item.height);row.items.push(item);
 }
 const fullHeight=rows.reduce((sum,r)=>sum+r.height,0)+gap*(rows.length-1);
 const tallest=Math.max(...rows.map(row=>row.height));
 const naturalAdvance=rows.slice(0,-1).reduce((sum,r)=>sum+r.height+gap,0);
 const factor=naturalAdvance?Math.min(1,Math.max(0,height-padding*2-tallest)/naturalAdvance):1;
 let top=fullHeight<=height-padding*2?(height-fullHeight)/2:padding;
 return rows.flatMap(row=>{
  let left=(width-row.width)/2;
  const result=row.items.map(item=>{const pos={id:item.note.id,x:(left+item.width/2)/width*100,y:clamp((top+item.height/2)/height*100,0,100)};left+=item.width+gap;return pos});
  top+=(row.height+gap)*factor;
  return result;
 });
}
