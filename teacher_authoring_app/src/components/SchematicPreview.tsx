import { schematicLayout } from '../engine/schematic.ts';
import { formatOhms, pieceOhms } from '../engine/sim.ts';
import type { Piece } from '../model/types.ts';

// IEC 60617-style circuit symbols: rectangular resistors and a multi-cell battery.
const STROKE = '#3f493f';

function labelFor(piece: Piece) {
  if (piece.type === 'bateria') return '5 V';
  if (piece.type.startsWith('resistor') || piece.type === 'potenciometro') return formatOhms(pieceOhms(piece));
  if (piece.type === 'capacitor') return '1000 µF';
  if (piece.type === 'led') return 'LED';
  if (piece.type === 'buzzer') return 'Buzzer';
  if (piece.type === 'botao') return 'Botão';
  return '';
}

function ComponentSymbol({
  piece,
  x,
  y,
  vertical = false,
  forward = true,
}: {
  piece: Piece;
  x: number;
  y: number;
  vertical?: boolean;
  forward?: boolean;
}) {
  const type = piece.type;
  const directed = type === 'bateria' || type === 'led';
  const label = labelFor(piece);
  const leftContact =
    type === 'capacitor'
      ? 6
      : type === 'bateria'
        ? 10
        : type === 'led' || type === 'buzzer'
          ? 13
          : type === 'botao'
            ? 12
            : 17;
  const rightContact = type === 'led' ? 9 : leftContact;

  return (
    <g>
      <g
        transform={`translate(${x} ${y}) rotate(${vertical ? 90 : 0})`}
        stroke={STROKE}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g transform={directed && !forward ? 'scale(-1 1)' : undefined}>
          <line x1="-20" y1="0" x2={-leftContact} y2="0" />
          <line x1={rightContact} y1="0" x2="20" y2="0" />
          {type === 'bateria' && (
            <>
              <line x1="-10" y1="-14" x2="-10" y2="14" />
              <line x1="-4" y1="-7" x2="-4" y2="7" />
              <line x1="4" y1="-14" x2="4" y2="14" />
              <line x1="10" y1="-7" x2="10" y2="7" />
            </>
          )}
          {(type.startsWith('resistor') || type === 'potenciometro') && <rect x="-17" y="-7" width="34" height="14" />}
          {type === 'potenciometro' && <path d="M -12 15 L 12 -13 M 4 -12 L 12 -13 L 11 -5" />}
          {type === 'capacitor' && (
            <>
              <line x1="-6" y1="-15" x2="-6" y2="15" />
              <line x1="6" y1="-15" x2="6" y2="15" />
            </>
          )}
          {type === 'led' && (
            <>
              <polygon points="-13,-12 7,0 -13,12" />
              <line x1="9" y1="-14" x2="9" y2="14" />
              <path d="M -5 -16 L 1 -22 M -3 -22 L 1 -22 L 1 -18 M 2 -16 L 8 -22 M 4 -22 L 8 -22 L 8 -18" />
            </>
          )}
          {type === 'buzzer' && <path d="M -13 0 V -3 Q 0 -22 13 -3 V 0" />}
          {type === 'botao' && (
            <>
              <circle cx="-12" r="2" fill={STROKE} />
              <circle cx="12" r="2" fill={STROKE} />
              <path d="M -10 -1 L 9 -11" />
            </>
          )}
        </g>
      </g>
      {type === 'bateria' && (
        <>
          <text
            x={vertical ? x - 13 : x + (forward ? -25 : 20)}
            y={vertical ? y - 21 : y - 20}
            className="schematic-polarity"
          >
            {vertical || forward ? '+' : '−'}
          </text>
          <text
            x={vertical ? x - 13 : x + (forward ? 20 : -25)}
            y={vertical ? y + 29 : y - 20}
            className="schematic-polarity"
          >
            {vertical || forward ? '−' : '+'}
          </text>
        </>
      )}
      {label && (
        <text
          x={vertical ? x + 27 : x}
          y={vertical ? y + 4 : y - 24}
          textAnchor={vertical ? 'start' : 'middle'}
          className="schematic-label"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function verticalWires(x: number, top: number, bottom: number, centers: number[], gap: number) {
  let start = top;
  return [...centers, bottom + gap].map((center) => {
    const end = Math.min(bottom, center - gap);
    const segment = end > start ? <line key={`${x}-${center}`} x1={x} y1={start} x2={x} y2={end} /> : null;
    start = center + gap;
    return segment;
  });
}

function LoopDiagram({ battery, path }: { battery: Piece; path: { piece: Piece; forward: boolean }[] }) {
  const components = path.filter(({ piece }) => !piece.type.startsWith('jumper'));
  const height = Math.max(210, 80 + components.length * 64);
  const top = 30;
  const bottom = height - 30;
  const left = 65;
  const right = 236;
  const batteryY = (top + bottom) / 2;
  const positions = components.map((_, index) => top + ((index + 1) * (bottom - top)) / (components.length + 1));

  return (
    <svg width="390" height={height} viewBox={`0 0 390 ${height}`} role="img" aria-label="Esquemático em série">
      <g stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1={left} y1={top} x2={right} y2={top} />
        <line x1={left} y1={bottom} x2={right} y2={bottom} />
        {verticalWires(left, top, bottom, [batteryY], 19)}
        {verticalWires(right, top, bottom, positions, 20)}
      </g>
      <ComponentSymbol piece={battery} x={left} y={batteryY} vertical />
      {components.map(({ piece, forward }, index) => (
        <ComponentSymbol key={piece.id} piece={piece} x={right} y={positions[index]} vertical forward={forward} />
      ))}
    </svg>
  );
}

function wirePath(start: number, end: number, y: number, crossings: number[]) {
  let path = `M ${start} ${y}`;
  for (const x of crossings) path += ` L ${x - 7} ${y} C ${x - 7} ${y - 10}, ${x + 7} ${y - 10}, ${x + 7} ${y}`;
  return `${path} L ${end} ${y}`;
}

function NetworkDiagram({ nodes, edges }: { nodes: number[]; edges: Piece[] }) {
  const xFor = new Map(nodes.map((node, index) => [node, 48 + index * 95]));
  const yFor = edges.map((_, index) => 80 + index * 58);
  const spans = new Map(
    nodes.map((node) => {
      const ys = edges.flatMap((piece, index) => (piece.a === node || piece.b === node ? [yFor[index]] : []));
      return [node, { top: Math.min(...ys), bottom: Math.max(...ys), degree: ys.length }] as const;
    })
  );
  const width = Math.max(390, 96 + (nodes.length - 1) * 95);
  const height = Math.max(160, 120 + edges.length * 58);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Esquemático dos componentes na bancada"
    >
      <g stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {nodes.map((node) => {
          const x = xFor.get(node);
          const span = spans.get(node);
          return <line key={node} x1={x} y1={span.top} x2={x} y2={span.bottom} />;
        })}
        {edges.map((piece, index) => {
          const y = yFor[index];
          const left = Math.min(xFor.get(piece.a), xFor.get(piece.b));
          const right = Math.max(xFor.get(piece.a), xFor.get(piece.b));
          const symbolX = left + 47;
          const crossings = nodes
            .filter((node) => {
              const x = xFor.get(node);
              const span = spans.get(node);
              return x > symbolX + 20 && x < right && span.top < y && span.bottom > y;
            })
            .map((node) => xFor.get(node));
          return piece.type.startsWith('jumper') ? (
            <path key={piece.id} d={wirePath(left, right, y, crossings)} />
          ) : (
            <g key={piece.id}>
              <line x1={left} y1={y} x2={symbolX - 20} y2={y} />
              <path d={wirePath(symbolX + 20, right, y, crossings)} />
            </g>
          );
        })}
      </g>
      {nodes.map((node) => (
        <text key={`label-${node}`} x={xFor.get(node)} y="35" textAnchor="middle" className="schematic-node-label">
          {node}
        </text>
      ))}
      {edges.map((piece, index) => {
        const y = yFor[index];
        const left = Math.min(xFor.get(piece.a), xFor.get(piece.b));
        const right = Math.max(xFor.get(piece.a), xFor.get(piece.b));
        const leftNode = Math.min(piece.a, piece.b);
        const rightNode = Math.max(piece.a, piece.b);
        return (
          <g key={`component-${piece.id}`}>
            {!piece.type.startsWith('jumper') && (
              <ComponentSymbol piece={piece} x={left + 47} y={y} forward={piece.a === leftNode} />
            )}
            <circle cx={left} cy={y} r="3" fill={spans.get(leftNode).degree === 1 ? 'white' : STROKE} stroke={STROKE} />
            <circle
              cx={right}
              cy={y}
              r="3"
              fill={spans.get(rightNode).degree === 1 ? 'white' : STROKE}
              stroke={STROKE}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function SchematicPreview({ pieces }: { pieces: Piece[] }) {
  const layout = schematicLayout(pieces);
  return (
    <section className="schematic-panel" aria-labelledby="schematic-heading">
      <h2 id="schematic-heading">Esquemático</h2>
      <div className="schematic-viewport">
        {layout.kind === 'empty' && <p className="schematic-empty">Adicione peças à bancada para ver o esquema.</p>}
        {layout.kind === 'loop' && <LoopDiagram battery={layout.battery} path={layout.path} />}
        {layout.kind === 'network' && <NetworkDiagram nodes={layout.nodes} edges={layout.edges} />}
      </div>
    </section>
  );
}
