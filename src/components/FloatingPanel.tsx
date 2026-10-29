import { Minus, Move, PanelRightClose } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

type FloatingPanelProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  defaultX?: number;
  defaultY?: number;
  defaultWidth?: number;
  onClose?: () => void;
  className?: string;
};

export function FloatingPanel({ title, eyebrow, children, defaultX = 24, defaultY = 132, defaultWidth = 320, onClose, className = '' }: FloatingPanelProps) {
  const [position, setPosition] = useState({ x: defaultX, y: defaultY });
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clamp = () => {
      const rect = panelRef.current?.getBoundingClientRect();
      const width = rect?.width ?? defaultWidth;
      const height = rect?.height ?? 120;
      setPosition(current => ({
        x: Math.max(8, Math.min(current.x, Math.max(8, window.innerWidth - Math.min(width, window.innerWidth - 16) - 8))),
        y: Math.max(8, Math.min(current.y, Math.max(8, window.innerHeight - Math.min(height, window.innerHeight - 16) - 8))),
      }));
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [defaultWidth]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    drag.current = { pointerId: event.pointerId, dx: event.clientX - position.x, dy: event.clientY - position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const rect = panelRef.current?.getBoundingClientRect();
    const width = rect?.width ?? defaultWidth;
    const height = rect?.height ?? 120;
    setPosition({
      x: Math.max(8, Math.min(event.clientX - current.dx, Math.max(8, window.innerWidth - Math.min(width, window.innerWidth - 16) - 8))),
      y: Math.max(8, Math.min(event.clientY - current.dy, Math.max(8, window.innerHeight - Math.min(height, window.innerHeight - 16) - 8))),
    });
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  return <aside ref={panelRef} className={`floating-editor-panel ${collapsed ? 'floating-editor-panel--collapsed' : ''} ${className}`} style={{ left: position.x, top: position.y, width: defaultWidth }}>
    <div className="floating-editor-panel__bar" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
      <div className="floating-editor-panel__title"><Move size={15} aria-hidden="true"/><div>{eyebrow && <span>{eyebrow}</span>}<strong>{title}</strong></div></div>
      <div className="floating-editor-panel__actions">
        <button type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expandir panel' : 'Minimizar panel'} title={collapsed ? 'Expandir panel' : 'Minimizar panel'}><Minus size={16}/></button>
        {onClose && <button type="button" onClick={onClose} aria-label="Cerrar panel" title="Cerrar panel"><PanelRightClose size={16}/></button>}
      </div>
    </div>
    {!collapsed && <div className="floating-editor-panel__body">{children}</div>}
  </aside>;
}
