import type { Illustration as Art } from '../model/types.ts';

/**
 * An inline SVG shown as an <img>, so a stored drawing can never run script or touch the page.
 * The drawings are authored during development and travel inside the lesson (offline on the bench).
 */
export default function Illustration({ art }: { art: Art }) {
  return (
    <figure style={{ margin: 0, maxWidth: 720, width: '100%' }}>
      <img
        alt={art.alt}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(art.svg)}`}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 16, background: '#fffdf8' }}
      />
      {art.caption && (
        <figcaption style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 6, textAlign: 'center' }}>
          {art.caption}
        </figcaption>
      )}
    </figure>
  );
}
