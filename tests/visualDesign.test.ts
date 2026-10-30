import { describe,expect,it } from 'vitest';
import { DEFAULT_NODE_VISUAL,EXPORT_PRESETS,fitExportGraph,normalizeVisualNode,readEdgeVisual,readNodeVisual,wrapTitle } from '../src/lib/visualDesign';
import type { ConceptNode } from '../src/lib/types';

describe('Fase 4B / 4B.1 · diseño visual y exportación',()=>{
 it('normaliza estilos de nodo sin aceptar valores fuera de catálogo',()=>{expect(readNodeVisual({variant:'comic'}).variant).toBe(DEFAULT_NODE_VISUAL.variant);expect(readNodeVisual({titleSize:999}).titleSize).toBe(30)});
 it('normaliza conectores y sus límites',()=>{const v=readEdgeVisual({route:'straight',width:9,labelSize:2});expect(v.route).toBe('straight');expect(v.width).toBe(6);expect(v.labelSize).toBe(8)});
 it('incluye formatos editoriales de exportación',()=>{expect(EXPORT_PRESETS.article.width).toBe(1600);expect(EXPORT_PRESETS.presentation.height).toBe(1080)});
 it('ajusta un grafo a la hoja sin mutar su fuente',()=>{const n=[{id:'a',x:100,y:100,width:200,height:100,title:'A',critical:false,category:'idea',accent:'#000',titleSize:14}];const fitted=fitExportGraph(n,1000,600,50);expect(fitted.nodes[0].x).toBeGreaterThanOrEqual(50);expect(n[0].x).toBe(100)});
 it('divide títulos largos en líneas compactas',()=>{expect(wrapTitle('uno dos tres cuatro cinco seis',8).length).toBeGreaterThan(1)});
 it('respeta saltos de línea manuales del título',()=>{expect(wrapTitle('Primera línea\nSegunda línea',80)).toEqual(['Primera línea','Segunda línea'])});
 it('permite cuadros más pequeños y más grandes sin salir de límites seguros',()=>{
   const base={id:'n',type:'concept',position:{x:0,y:0},data:{title:'Nodo',description:'',category:'idea'}} as ConceptNode;
   expect(normalizeVisualNode({...base,style:{width:40,height:20}}).style).toMatchObject({width:140,height:70});
   expect(normalizeVisualNode({...base,style:{width:1200,height:900}}).style).toMatchObject({width:900,height:650});
 });
});
