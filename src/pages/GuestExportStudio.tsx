import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  ArrowLeft, Download, EyeOff, Maximize2, Minimize2, Move, RotateCcw, SlidersHorizontal,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { FloatingPanel } from '../components/FloatingPanel';
import { GuestPublicLayout } from '../components/GuestPublicLayout';
import { explainError } from '../lib/errors';
import {
  guestPublicationPath, openGuestPublication, resolveGuestGroup,
} from '../lib/guestGroups';
import type { ConceptEdge, ConceptNode } from '../lib/types';
import {
  EXPORT_PRESETS, EXPORT_THEMES, EXPORT_THEME_LABELS, exportGraph, fitExportGraph, wrapTitle,
  type ExportNode, type ExportPreset, type ExportTheme,
} from '../lib/visualDesign';

const THEME = {
  academic: { bg: '#FCFAF7', ink: '#2B2729', line: '#9C8580' },
  journal: { bg: '#FFFFFF', ink: '#171717', line: '#777' },
  minimal: { bg: '#FFFFFF', ink: '#222', line: '#B6B6B6' },
  blueprint: { bg: '#ECF5FC', ink: '#173D59', line: '#5186A8' },
  warm: { bg: '#F6F0E4', ink: '#4A3B31', line: '#AA8B72' },
} as const;

type Gesture = {
  id: string;
  mode: 'move' | 'resize';
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

export function GuestExportStudio() {
  const { slug = '', id = '' } = useParams();
  const workspace = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Gesture | null>(null);

  const [fullscreen, setFullscreen] = useState(false);
  const [formatPanel, setFormatPanel] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [title, setTitle] = useState('');
  const [nodes, setNodes] = useState<ConceptNode[]>([]);
  const [edges, setEdges] = useState<ConceptEdge[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<ExportPreset>('article');
  const [customWidth, setCustomWidth] = useState(1600);
  const [customHeight, setCustomHeight] = useState(1000);
  const [theme, setTheme] = useState<ExportTheme>('academic');
  const [margin, setMargin] = useState(90);
  const [showNumbers, setShowNumbers] = useState(false);
  const [previewScale, setPreviewScale] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 700 ? .38 : .68
  );
  const [layout, setLayout] = useState<ExportNode[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === workspace.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setGroupTitle('');
    setTitle('');
    setNodes([]);
    setEdges([]);
    setHiddenIds(new Set());
    setSelectedId(null);

    resolveGuestGroup(slug)
      .then(async group => {
        const publication = await openGuestPublication(group.groupId, id);
        if (!alive) return;
        setGroupTitle(group.title);
        setTitle(publication.title);
        setNodes(publication.nodes);
        setEdges(publication.edges);
      })
      .catch(reason => {
        if (alive) setError(explainError(reason));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [slug, id]);

  const size = preset === 'custom'
    ? { width: customWidth, height: customHeight }
    : EXPORT_PRESETS[preset];

  const raw = useMemo(() => exportGraph(nodes, edges), [nodes, edges]);

  useEffect(() => {
    const fitted = fitExportGraph(raw.nodes, size.width, size.height, margin);
    setLayout(fitted.nodes);
    setSelectedId(null);
  }, [raw, size.width, size.height, margin]);

  const visibleLayout = layout.filter(node => !hiddenIds.has(node.id));
  const byId = new Map(visibleLayout.map(node => [node.id, node]));
  const visibleEdges = raw.edges.filter(edge => !hiddenIds.has(edge.source) && !hiddenIds.has(edge.target));
  const colors = THEME[theme];
  const selected = visibleLayout.find(node => node.id === selectedId) ?? null;

  function reset() {
    const fitted = fitExportGraph(raw.nodes, size.width, size.height, margin);
    setLayout(fitted.nodes);
    setHiddenIds(new Set());
    setSelectedId(null);
  }

  function localPoint(event: PointerEvent<SVGGElement>) {
    const svg = event.currentTarget.ownerSVGElement!;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM()!.inverse());
  }

  function startMove(event: PointerEvent<SVGGElement>, node: ExportNode) {
    event.stopPropagation();
    const local = localPoint(event);
    drag.current = {
      id: node.id,
      mode: 'move',
      dx: local.x - node.x,
      dy: local.y - node.y,
      startX: local.x,
      startY: local.y,
      startWidth: node.width,
      startHeight: node.height,
    };
    setSelectedId(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startResize(event: PointerEvent<SVGGElement>, node: ExportNode) {
    event.stopPropagation();
    const local = localPoint(event);
    drag.current = {
      id: node.id,
      mode: 'resize',
      dx: 0,
      dy: 0,
      startX: local.x,
      startY: local.y,
      startWidth: node.width,
      startHeight: node.height,
    };
    setSelectedId(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<SVGGElement>) {
    const current = drag.current;
    if (!current) return;
    const local = localPoint(event);
    setLayout(list => list.map(node => {
      if (node.id !== current.id) return node;
      if (current.mode === 'move') return { ...node, x: local.x - current.dx, y: local.y - current.dy };
      return {
        ...node,
        width: Math.max(90, Math.min(900, current.startWidth + (local.x - current.startX))),
        height: Math.max(46, Math.min(650, current.startHeight + (local.y - current.startY))),
      };
    }));
  }

  function pointerUp() {
    drag.current = null;
  }

  function patchSelected(field: 'width' | 'height', value: number) {
    if (!selectedId) return;
    setLayout(list => list.map(node => node.id === selectedId
      ? {
          ...node,
          [field]: field === 'width'
            ? Math.max(90, Math.min(900, value))
            : Math.max(46, Math.min(650, value)),
        }
      : node
    ));
  }

  function hideSelectedFromSheet() {
    if (!selectedId) return;
    setHiddenIds(current => {
      const next = new Set(current);
      next.add(selectedId);
      return next;
    });
    setSelectedId(null);
  }

  function restoreHidden() {
    setHiddenIds(new Set());
    setSelectedId(null);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === workspace.current) await document.exitFullscreen();
      else await workspace.current?.requestFullscreen();
    } catch (reason) {
      setError(explainError(reason));
    }
  }

  function svgMarkup() {
    const svg = document.querySelector<SVGSVGElement>('#guest-export-svg');
    if (!svg) throw new Error('No se encontró la lámina.');
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(size.width));
    clone.setAttribute('height', String(size.height));
    clone.querySelectorAll('.export-selection-ui').forEach(node => node.remove());
    return new XMLSerializer().serializeToString(clone);
  }

  async function download() {
    try {
      const markup = svgMarkup();
      const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo preparar la imagen.'));
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = size.width * 2;
      canvas.height = size.height * 2;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas no disponible.');
      context.scale(2, 2);
      context.drawImage(image, 0, 0, size.width, size.height);
      URL.revokeObjectURL(url);

      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          value => value ? resolve(value) : reject(new Error('No se pudo generar PNG.')),
          'image/png',
          1,
        )
      );

      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(png);
      anchor.download = `${title || 'sistema-2d'}.png`
        .replace(/[^a-z0-9áéíóúñü _-]/gi, '')
        .replace(/\s+/g, '-')
        .toLocaleLowerCase('es');
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    } catch (reason) {
      setError(explainError(reason));
    }
  }

  return <GuestPublicLayout>
    <div ref={workspace} className={`export-studio-page visual-workspace ${fullscreen ? 'visual-workspace--fullscreen' : ''}`}>
      <div className="editor-header">
        <div>
          <Link className="back-link" to={guestPublicationPath(slug, id)}>
            <ArrowLeft size={16}/> VOLVER AL ESQUEMA
          </Link>
          <div className="eyebrow">EXPORTACIÓN PÚBLICA / SOLO LECTURA</div>
          <h1>Preparar imagen<span className="period">.</span></h1>
          <p>{groupTitle ? `${groupTitle} · ` : ''}Los cambios de formato son temporales y nunca modifican el esquema publicado.</p>
        </div>
        <div className="editor-header-actions">
          <button className="button button-secondary" type="button" onClick={() => setFormatPanel(value => !value)}>
            <SlidersHorizontal size={17}/> {formatPanel ? 'Ocultar opciones' : 'Mostrar opciones'}
          </button>
          <button className="button button-secondary" type="button" onClick={() => void toggleFullscreen()}>
            {fullscreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>} {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
          <button className="button button-primary" disabled={loading || !layout.length} onClick={() => void download()}>
            <Download size={17}/> Descargar PNG 2×
          </button>
        </div>
      </div>

      <div className="alert" role="note">
        Modo invitado: puede preparar y descargar una imagen, mover o redimensionar cuadros y ocultarlos temporalmente de la lámina. No puede guardar cambios ni eliminar nodos del esquema.
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="export-studio-layout export-studio-layout--floating">
        <main className="export-sheet-wrap export-sheet-wrap--wide">
          <div className="export-sheet-scroll">
            <svg
              id="guest-export-svg"
              viewBox={`0 0 ${size.width} ${size.height}`}
              className="export-sheet-svg"
              style={{ background: colors.bg, width: size.width * previewScale, height: size.height * previewScale }}
              onPointerDown={() => setSelectedId(null)}
            >
              <rect x="0" y="0" width={size.width} height={size.height} fill={colors.bg}/>
              <text x={margin} y={Math.max(42, margin * .55)} fill={colors.ink} fontFamily="Arial, sans-serif" fontWeight="700" fontSize={Math.max(22, size.width / 52)}>{title}</text>

              {visibleEdges.map(edge => {
                const source = byId.get(edge.source);
                const target = byId.get(edge.target);
                if (!source || !target) return null;
                const sx = source.x + source.width / 2;
                const sy = source.y + source.height / 2;
                const tx = target.x + target.width / 2;
                const ty = target.y + target.height / 2;
                const mx = (sx + tx) / 2;
                const my = (sy + ty) / 2;
                const cx = mx + edge.bendX;
                const cy = my + edge.bendY;
                const path = edge.route === 'straight'
                  ? `M ${sx} ${sy} L ${tx} ${ty}`
                  : edge.route === 'step'
                    ? `M ${sx} ${sy} L ${cx} ${sy} L ${cx} ${ty} L ${tx} ${ty}`
                    : `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
                return <path key={edge.id} d={path} fill="none" stroke={edge.stroke || colors.line} strokeWidth={Math.max(1, edge.width)} strokeDasharray={edge.dash || undefined} opacity=".72"/>;
              })}

              {visibleLayout.map((node, index) => {
                const lines = wrapTitle(`${showNumbers ? `${String(index + 1).padStart(2, '0')} · ` : ''}${node.title}`, Math.max(9, Math.floor(node.width / 10)));
                const points = node.critical
                  ? `${node.x + 18},${node.y} ${node.x + node.width - 18},${node.y} ${node.x + node.width},${node.y + 18} ${node.x + node.width},${node.y + node.height - 18} ${node.x + node.width - 18},${node.y + node.height} ${node.x + 18},${node.y + node.height} ${node.x},${node.y + node.height - 18} ${node.x},${node.y + 18}`
                  : '';
                const isSelected = node.id === selectedId;

                return <g key={node.id} onPointerDown={event => startMove(event, node)} onPointerMove={pointerMove} onPointerUp={pointerUp} style={{ cursor: 'grab' }}>
                  {node.critical
                    ? <polygon points={points} fill="#FFF7DF" stroke="#B57E20" strokeWidth="4" filter="drop-shadow(0 0 9px rgba(207,158,58,.55))"/>
                    : <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="12" fill="#FFFFFF" stroke={node.accent} strokeWidth="2"/>
                  }

                  {node.critical && <text x={node.x + node.width - 14} y={node.y + 20} textAnchor="end" fill="#A56C0D" fontFamily="Arial" fontWeight="800" fontSize="12">CRÍTICO ✦</text>}

                  <text x={node.x + node.width / 2} y={node.y + node.height / 2 - (lines.length - 1) * 11} textAnchor="middle" dominantBaseline="middle" fill={colors.ink} fontFamily="Arial, sans-serif" fontWeight="700" fontSize={Math.max(11, Math.min(24, node.titleSize))}>
                    {lines.map((line, lineIndex) => <tspan key={lineIndex} x={node.x + node.width / 2} dy={lineIndex === 0 ? 0 : 22}>{line}</tspan>)}
                  </text>

                  {isSelected && <g className="export-selection-ui">
                    <rect x={node.x - 6} y={node.y - 6} width={node.width + 12} height={node.height + 12} rx="14" fill="none" stroke="#7A2742" strokeWidth="2" strokeDasharray="7 5"/>
                    <g onPointerDown={event => startResize(event, node)} onPointerMove={pointerMove} onPointerUp={pointerUp} style={{ cursor: 'nwse-resize' }}>
                      <rect x={node.x + node.width - 9} y={node.y + node.height - 9} width="22" height="22" rx="4" fill="#7A2742" stroke="#fff" strokeWidth="3"/>
                      <path d={`M ${node.x + node.width - 2} ${node.y + node.height + 7} L ${node.x + node.width + 7} ${node.y + node.height - 2}`} stroke="#fff" strokeWidth="2"/>
                    </g>
                  </g>}
                </g>;
              })}
            </svg>
          </div>
        </main>

        {formatPanel && <FloatingPanel title="Formato y estilo" eyebrow="LÁMINA" defaultX={24} defaultY={150} defaultWidth={300} onClose={() => setFormatPanel(false)}>
          <div className="export-controls export-controls--floating">
            <label>FORMATO<select value={preset} onChange={event => { const next = event.target.value as ExportPreset; setPreset(next); const nextSize = EXPORT_PRESETS[next]; setCustomWidth(nextSize.width); setCustomHeight(nextSize.height); }}>{Object.entries(EXPORT_PRESETS).map(([key, value]) => <option key={key} value={key}>{value.label} · {value.width}×{value.height}</option>)}</select></label>
            <div className="visual-two">
              <label>ANCHO<input type="number" min="600" max="5000" value={customWidth} disabled={preset !== 'custom'} onChange={event => setCustomWidth(Number(event.target.value))}/></label>
              <label>ALTO<input type="number" min="600" max="5000" value={customHeight} disabled={preset !== 'custom'} onChange={event => setCustomHeight(Number(event.target.value))}/></label>
            </div>
            <label>ESTILO<select value={theme} onChange={event => setTheme(event.target.value as ExportTheme)}>{EXPORT_THEMES.map(value => <option key={value} value={value}>{EXPORT_THEME_LABELS[value]}</option>)}</select></label>
            <label>MARGEN<input type="range" min="30" max="220" value={margin} onChange={event => setMargin(Number(event.target.value))}/><span>{margin}px</span></label>
            <label>ZOOM DE TRABAJO<input type="range" min="0.25" max="1.25" step="0.05" value={previewScale} onChange={event => setPreviewScale(Number(event.target.value))}/><span>{Math.round(previewScale * 100)}%</span></label>
            <label className="guest-option"><input type="checkbox" checked={showNumbers} onChange={event => setShowNumbers(event.target.checked)}/><span><b>Mostrar numeración</b><small>Incluye 01, 02, 03… antes de cada título.</small></span></label>
            <button className="button button-secondary" onClick={reset}><RotateCcw size={16}/> Reajustar automáticamente</button>
            {hiddenIds.size > 0 && <button className="button button-secondary" onClick={restoreHidden}><EyeOff size={16}/> Restaurar ocultos ({hiddenIds.size})</button>}
            <p className="inspector-tip"><Move size={14}/> Arrastre un cuadro para moverlo. Selecciónelo y use la manija inferior derecha para cambiar su tamaño. Todo ocurre únicamente en esta exportación.</p>
          </div>
        </FloatingPanel>}

        {selected && <FloatingPanel title="Cuadro seleccionado" eyebrow="TAMAÑO" defaultX={340} defaultY={150} defaultWidth={270} onClose={() => setSelectedId(null)}>
          <div className="export-controls export-controls--floating">
            <div className="visual-two">
              <label>ANCHO<input type="number" min="90" max="900" value={Math.round(selected.width)} onChange={event => patchSelected('width', Number(event.target.value))}/></label>
              <label>ALTO<input type="number" min="46" max="650" value={Math.round(selected.height)} onChange={event => patchSelected('height', Number(event.target.value))}/></label>
            </div>
            <button type="button" className="button button-secondary" onClick={hideSelectedFromSheet}><EyeOff size={16}/> Ocultar solo en esta imagen</button>
            <small className="floating-help">Esta acción no borra el nodo. En modo invitado no existe ninguna acción para modificar o eliminar el esquema publicado.</small>
          </div>
        </FloatingPanel>}
      </div>
    </div>
  </GuestPublicLayout>;
}
