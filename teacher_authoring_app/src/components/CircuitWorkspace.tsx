import { type ComponentProps, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import SchematicEditor, { type Sketch, sketchFromBoard } from '../editor/SchematicEditor.tsx';
import BoardWorkspace from './BoardWorkspace.tsx';
import { BoardSlotContext } from './boardSlot.ts';
import SchematicPreview from './SchematicPreview.tsx';
import Tabs from './Tabs.tsx';

/**
 * The protoboard with a Protoboard/Esquema switch on top (as in the lesson editor): in Esquema the circuit is drawn
 * and wired as symbols and the board layout follows. With smart capsules the drawing is read-only.
 */
export default function CircuitWorkspace(props: ComponentProps<typeof BoardWorkspace>) {
  const { pieces, onChange } = props;
  const [mode, setMode] = useState<'board' | 'sketch'>('board');
  const [sketch, setSketch] = useState<Sketch | null>(null);
  const canSketch = sketchFromBoard(pieces, null) != null;
  const slot = useContext(BoardSlotContext);
  const place = (node: React.ReactNode) => (slot ? createPortal(node, slot) : node);

  const tabs = (
    <Tabs
      label="Como montar o circuito"
      value={mode}
      tabs={[
        { id: 'board', label: 'Protoboard' },
        {
          id: 'sketch',
          label: 'Esquema',
          title: canSketch
            ? 'Ligue os componentes num desenho; a montagem na protoboard é feita sozinha'
            : 'Com cápsulas inteligentes o esquema é só para leitura',
        },
      ]}
      onChange={(next) => {
        if (next === 'sketch' && canSketch) {
          const fresh = sketch?.forPieces === pieces ? sketch : sketchFromBoard(pieces, sketch);
          if (fresh) setSketch(fresh);
        }
        setMode(next);
      }}
    />
  );

  if (mode === 'sketch' && canSketch && sketch) {
    return place(
      <SchematicEditor header={tabs} pieces={pieces} onChange={onChange} sketch={sketch} setSketch={setSketch} />
    );
  }
  if (mode === 'sketch') {
    return place(
      <div className="sketch-editor">
        {tabs}
        <p className="muted-line">
          Este circuito tem cápsulas inteligentes, que o desenho ainda não monta sozinho. Edite na aba Protoboard.
        </p>
        <SchematicPreview pieces={pieces} />
      </div>
    );
  }
  return <BoardWorkspace {...props} boardHeader={tabs} />;
}
