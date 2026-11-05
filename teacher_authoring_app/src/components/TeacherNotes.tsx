import { useState } from 'react';

/** "Objetivo: o primeiro circuito…" → label "Objetivo" and the rest; long or label-less lines stay whole. */
function split(line: string): [string | null, string] {
  const i = line.indexOf(':');
  return i > 0 && i <= 40 ? [line.slice(0, i), line.slice(i + 1).trim()] : [null, line];
}

/**
 * Teacher notes on a lesson card: a two-line preview ending in "…" and, when opened, the full notes, one paragraph
 * per line with its label ("Objetivo:", "Desafio:") in bold.
 */
export default function TeacherNotes({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <div className="teacher-notes">
      <button type="button" className="teacher-notes-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>Notas do professor</span>
        <span className="teacher-notes-more">{open ? 'Mostrar menos' : 'Ler tudo'}</span>
      </button>
      {open ? (
        <div className="teacher-notes-full">
          {lines.map((line) => {
            const [label, rest] = split(line);
            return (
              <p key={line}>
                {label && <strong>{label}:</strong>} {rest}
              </p>
            );
          })}
        </div>
      ) : (
        <p className="teacher-notes-preview">{lines.join(' ')}</p>
      )}
    </div>
  );
}
