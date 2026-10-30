import { useRef, useState } from 'react';
import { BANK_ROWS, COLS, colX, rowY, SOCKET } from '../engine/board.ts';
import { nodeOf } from '../engine/nodes.ts';
import Breadboard from './Breadboard.tsx';

/**
 * "Toque num furo": lights every hole that is the same electrical node, and says which node it is.
 * Each column has TWO nodes, A (top bank) and B (bottom bank); the channel keeps them apart.
 */
export default function NodeExplorer() {
  const boardRef = useRef(null);
  const [pick, setPick] = useState<{ col: number; row: number } | null>({ col: 5, row: 1 });
  const nodes = new Set<number>(pick ? [nodeOf(pick.col, pick.row)] : []);
  const bank = pick && pick.row < BANK_ROWS ? 'A' : 'B';
  const other = bank === 'A' ? 'B' : 'A';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Breadboard boardRef={boardRef} trail={{ nodes, edgeIds: new Set() }}>
        {Array.from({ length: COLS }, (_, c) => c + 1).flatMap((col) =>
          Array.from({ length: BANK_ROWS * 2 }, (_, row) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid of holes, never reordered
              key={`${col}-${row}`}
              type="button"
              aria-label={`Furo da coluna ${col}, banco ${row < BANK_ROWS ? 'A' : 'B'}`}
              onClick={() => setPick({ col, row })}
              onPointerEnter={() => setPick({ col, row })}
              style={{
                position: 'absolute',
                left: colX(col) - SOCKET / 2,
                top: rowY(row) - SOCKET / 2,
                width: SOCKET,
                height: SOCKET,
                border: 0,
                borderRadius: 6,
                background: 'transparent',
                cursor: 'pointer',
                zIndex: 4,
              }}
            />
          ))
        )}
      </Breadboard>
      <p role="status" style={{ margin: 0, fontSize: 14, maxWidth: 480, textAlign: 'center' }}>
        {pick ? (
          <>
            Você está no{' '}
            <strong>
              nó {bank}
              {pick.col}
            </strong>
            : os 6 furos acesos da coluna {pick.col} (banco {bank}) são a mesma ligação elétrica. O{' '}
            <strong>
              nó {other}
              {pick.col}
            </strong>
            , logo do outro lado da abertura central, é outro nó — não está ligado a este.
          </>
        ) : (
          'Toque ou passe o dedo sobre um furo.'
        )}
      </p>
    </div>
  );
}
