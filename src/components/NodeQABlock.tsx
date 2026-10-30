import type { NodeQAItem } from '../lib/types';

export function NodeQABlock({ items, title = 'Preguntas y respuestas' }: { items?: NodeQAItem[]; title?: string }) {
  if (!items?.length) return null;
  return <section className="node-qa-reading" aria-label={title}>
    <div className="eyebrow">{title.toLocaleUpperCase('es')}</div>
    <div className="node-qa-reading-list">
      {items.map((item, index) => <details className="node-qa-reading-item" key={`${index}-${item.question}`}>
        <summary>
          <span className="node-qa-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="node-qa-question-text">{item.question}</span>
        </summary>
        <p>{item.answer}</p>
      </details>)}
    </div>
  </section>;
}
