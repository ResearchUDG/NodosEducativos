import type { ConceptEdge, ConceptNode } from './types';

export const NODE_VARIANTS = ['academic','minimal','border','double','rounded','solid','shadow','glass','glow'] as const;
export type NodeVariant = (typeof NODE_VARIANTS)[number];
export const NODE_VARIANT_LABELS: Record<NodeVariant,string> = {
  academic:'Académico', minimal:'Minimalista', border:'Borde grueso', double:'Doble borde', rounded:'Redondeado',
  solid:'Relleno sólido', shadow:'Sombra marcada', glass:'Glass', glow:'Brillo',
};
export const ACCENTS = ['wine','gold','sage','navy','slate','violet'] as const;
export type Accent = (typeof ACCENTS)[number];
export const ACCENT_LABELS: Record<Accent,string> = { wine:'Vino', gold:'Dorado', sage:'Verde salvia', navy:'Azul', slate:'Grafito', violet:'Violeta' };
export type TextAlign = 'left'|'center'|'right';
export type VerticalAlign = 'top'|'center'|'bottom';
export type NodeVisual = {
  variant: NodeVariant; accent: Accent; titleSize: number; bodySize: number;
  textAlign: TextAlign; verticalAlign: VerticalAlign; padding: number; radius: number;
};
export const DEFAULT_NODE_VISUAL: NodeVisual = { variant:'academic', accent:'wine', titleSize:14, bodySize:11, textAlign:'left', verticalAlign:'top', padding:18, radius:7 };
export function readNodeVisual(raw: unknown): NodeVisual {
  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string,unknown> : {};
  const oneOf = <T extends readonly string[]>(arr:T, value:unknown, fallback:T[number]) => typeof value === 'string' && arr.includes(value) ? value as T[number] : fallback;
  const number = (value:unknown, min:number, max:number, fallback:number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback;
  return {
    variant: oneOf(NODE_VARIANTS,v.variant,DEFAULT_NODE_VISUAL.variant), accent: oneOf(ACCENTS,v.accent,DEFAULT_NODE_VISUAL.accent),
    titleSize:number(v.titleSize,10,30,14), bodySize:number(v.bodySize,9,20,11),
    textAlign:oneOf(['left','center','right'] as const,v.textAlign,'left'), verticalAlign:oneOf(['top','center','bottom'] as const,v.verticalAlign,'top'),
    padding:number(v.padding,8,34,18), radius:number(v.radius,0,28,7),
  };
}

export const EDGE_ROUTES = ['curve','straight','step'] as const;
export type EdgeRoute=(typeof EDGE_ROUTES)[number];
export const EDGE_LINE_STYLES=['solid','dashed','dotted'] as const;
export type EdgeLineStyle=(typeof EDGE_LINE_STYLES)[number];
export type EdgeVisual={ route:EdgeRoute; lineStyle:EdgeLineStyle; width:number; accent:Accent; labelSize:number; bendX:number; bendY:number; labelX:number; labelY:number };
export const DEFAULT_EDGE_VISUAL:EdgeVisual={ route:'curve',lineStyle:'solid',width:1.6,accent:'slate',labelSize:10,bendX:0,bendY:0,labelX:0,labelY:0 };
export function readEdgeVisual(raw:unknown):EdgeVisual{
  const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const route=typeof v.route==='string'&&EDGE_ROUTES.includes(v.route as EdgeRoute)?v.route as EdgeRoute:'curve';
  const lineStyle=typeof v.lineStyle==='string'&&EDGE_LINE_STYLES.includes(v.lineStyle as EdgeLineStyle)?v.lineStyle as EdgeLineStyle:'solid';
  const accent=typeof v.accent==='string'&&ACCENTS.includes(v.accent as Accent)?v.accent as Accent:'slate';
  const width=typeof v.width==='number'&&Number.isFinite(v.width)?Math.min(6,Math.max(.7,v.width)):1.6;
  const labelSize=typeof v.labelSize==='number'&&Number.isFinite(v.labelSize)?Math.min(18,Math.max(8,v.labelSize)):10;
  const offset=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.min(500,Math.max(-500,value)):0;
  return {route,lineStyle,width,accent,labelSize,bendX:offset(v.bendX),bendY:offset(v.bendY),labelX:offset(v.labelX),labelY:offset(v.labelY)};
}
export const ACCENT_HEX:Record<Accent,string>={wine:'#7A2742',gold:'#C79A4B',sage:'#718977',navy:'#284D73',slate:'#665E63',violet:'#7156A8'};
export function edgePresentation(edge:ConceptEdge){
  const visual=readEdgeVisual((edge.data as Record<string,unknown>|undefined)?.visual);
  const strokeDasharray = visual.lineStyle==='dashed' ? '9 7' : visual.lineStyle==='dotted' ? '2 6' : '';
  const style = { ...edge.style, stroke:ACCENT_HEX[visual.accent], strokeWidth:visual.width } as Record<string, unknown>;
  if (strokeDasharray) style.strokeDasharray = strokeDasharray;
  else delete style.strokeDasharray;
  return {
    ...edge,
    type: 'styled',
    style,
    labelStyle:{...edge.labelStyle,fontSize:visual.labelSize,fill:'#675B61',fontWeight:650},
  } as ConceptEdge;
}
export function normalizeVisualNode(node:ConceptNode):ConceptNode{
  const width = typeof node.style?.width==='number' ? node.style.width : typeof node.width==='number' ? node.width : 250;
  const height = typeof node.style?.height==='number' ? node.style.height : typeof node.height==='number' ? node.height : 150;
  return {...node,style:{...node.style,width:Math.max(140,Math.min(900,width)),height:Math.max(70,Math.min(650,height))},data:{...node.data,visual:readNodeVisual(node.data.visual)}};
}
export function normalizeVisualGraph(nodes:ConceptNode[],edges:ConceptEdge[]){return {nodes:nodes.map(normalizeVisualNode),edges:edges.map(edge=>edgePresentation({...edge,data:{...edge.data,visual:readEdgeVisual((edge.data as Record<string,unknown>|undefined)?.visual)}} as ConceptEdge))};}

/** Elimina un nodo y todas las conexiones que lo mencionan. La autorización final la imponen las reglas de Firestore sobre el borrador privado del creador. */
export function removeVisualNode(nodes:ConceptNode[],edges:ConceptEdge[],nodeId:string){
  return {
    nodes:nodes.filter(node=>node.id!==nodeId),
    edges:edges.filter(edge=>edge.source!==nodeId&&edge.target!==nodeId),
  };
}

export const EXPORT_PRESETS = {
  article:{label:'Artículo horizontal',width:1600,height:1000}, presentation:{label:'Presentación 16:9',width:1920,height:1080},
  square:{label:'Cuadrado',width:1400,height:1400}, portrait:{label:'Vertical editorial',width:1080,height:1350},
  a4landscape:{label:'A4 horizontal',width:1754,height:1240}, a4portrait:{label:'A4 vertical',width:1240,height:1754},
  custom:{label:'Personalizado',width:1600,height:1000},
} as const;
export type ExportPreset=keyof typeof EXPORT_PRESETS;
export const EXPORT_THEMES=['academic','journal','minimal','blueprint','warm'] as const;
export type ExportTheme=(typeof EXPORT_THEMES)[number];
export const EXPORT_THEME_LABELS:Record<ExportTheme,string>={academic:'Académico',journal:'Revista',minimal:'Minimal',blueprint:'Blueprint',warm:'Papel cálido'};
export type ExportNode={id:string;x:number;y:number;width:number;height:number;title:string;critical:boolean;category:string;accent:string;titleSize:number};
export type ExportEdge={id:string;source:string;target:string;stroke:string;width:number;dash:string;route:EdgeRoute;bendX:number;bendY:number};
export function exportGraph(nodes:ConceptNode[],edges:ConceptEdge[]): {nodes:ExportNode[];edges:ExportEdge[]} {
  const outNodes=nodes.map((node,index)=>{const visual=readNodeVisual(node.data.visual);const width=typeof node.style?.width==='number'?node.style.width:220;const height=typeof node.style?.height==='number'?node.style.height:90;return {id:node.id,x:node.position.x,y:node.position.y,width,height,title:String(node.data.title||`Nodo ${index+1}`),critical:node.data.critical===true,category:node.data.category,accent:ACCENT_HEX[visual.accent],titleSize:visual.titleSize};});
  const visible=new Set(outNodes.map(n=>n.id));
  const outEdges=edges.filter(e=>visible.has(e.source)&&visible.has(e.target)).map(e=>{const v=readEdgeVisual((e.data as Record<string,unknown>|undefined)?.visual);return {id:e.id,source:e.source,target:e.target,stroke:ACCENT_HEX[v.accent],width:v.width,dash:v.lineStyle==='dashed'?'10 8':v.lineStyle==='dotted'?'2 7':'',route:v.route,bendX:v.bendX,bendY:v.bendY};});
  return {nodes:outNodes,edges:outEdges};
}
export function fitExportGraph(nodes:ExportNode[],pageWidth:number,pageHeight:number,margin:number){
  if(!nodes.length)return {nodes:[],scale:1};
  const minX=Math.min(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y));
  const maxX=Math.max(...nodes.map(n=>n.x+n.width)),maxY=Math.max(...nodes.map(n=>n.y+n.height));
  const bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY);const scale=Math.min((pageWidth-margin*2)/bw,(pageHeight-margin*2)/bh);
  const ox=(pageWidth-bw*scale)/2-minX*scale,oy=(pageHeight-bh*scale)/2-minY*scale;
  return {scale,nodes:nodes.map(n=>({...n,x:n.x*scale+ox,y:n.y*scale+oy,width:n.width*scale,height:n.height*scale,titleSize:n.titleSize*scale}))};
}
export function wrapTitle(title:string,maxChars:number){const words=title.trim().split(/\s+/).filter(Boolean);const lines:string[]=[];let current='';for(const word of words){const next=current?`${current} ${word}`:word;if(next.length>maxChars&&current){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);return lines.slice(0,6);}
