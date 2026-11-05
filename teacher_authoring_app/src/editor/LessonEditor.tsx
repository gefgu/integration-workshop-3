import { useCallback, useEffect, useMemo, useState } from 'react';
import BoardWorkspace from '../components/BoardWorkspace.tsx';
import Icon from '../components/Icon.tsx';
import SchematicPreview from '../components/SchematicPreview.tsx';
import Tabs from '../components/Tabs.tsx';
import { useCapsules } from '../components/useCapsules.ts';
import { mergeTrails } from '../engine/capsules.ts';
import { diagnose } from '../engine/diagnose.ts';
import { TYPES } from '../engine/sim.ts';
import { lessonProblems } from '../model/lesson.ts';
import { refreshGeneratedText } from '../model/steps.ts';
import LessonOptions from './LessonOptions.tsx';
import QuizEditor from './QuizEditor.tsx';
import SchematicEditor, { type Sketch, sketchFromBoard } from './SchematicEditor.tsx';
import StepsEditor from './StepsEditor.tsx';

/**
 * Editor: monta o circuito-alvo na bancada 11×6, escreve título/instrução
 * e perguntas. `onSave`/`onExport` recebem a lição já validada.
 */
export default function LessonEditor({ lesson, setLesson, onSave, onExport, onTest, status, unsaved = false }) {
  const [problems, setProblems] = useState([]);
  const [selected, setSelected] = useState(null); // index of the step being edited
  // Optional schematic mode: draw and wire symbols, and the board layout follows (SchematicEditor).
  const [mode, setMode] = useState<'board' | 'sketch'>('board');
  const [sketch, setSketch] = useState<Sketch | null>(null);
  // The lesson panel shows one section at a time (tabs), so it does not need to scroll.
  const [section, setSection] = useState<'lesson' | 'steps' | 'quizzes'>('lesson');
  const setPieces = useCallback((pieces) => setLesson((l) => ({ ...l, board: { ...l.board, pieces } })), [setLesson]);
  const set = (patch) => setLesson((l) => ({ ...l, ...patch }));
  const diag = diagnose(lesson.board.pieces);
  const cap = useCapsules(lesson.board.pieces, null);
  // Swapping a piece rebinds its step; the generated step text follows the new piece.
  useEffect(() => {
    const next = refreshGeneratedText(lesson);
    if (next !== lesson) setLesson(next);
  }, [lesson, setLesson]);
  const selectedStep = selected != null ? lesson.steps[selected] : null;
  const highlightIds = useMemo(() => new Set(selectedStep?.pieceId ? [selectedStep.pieceId] : []), [selectedStep]);

  function guarded(action) {
    const p = lessonProblems(lesson);
    setProblems(p);
    if (p.length === 0) action(lesson);
  }

  const canSketch = sketchFromBoard(lesson.board.pieces, null) != null;
  const modeToggle = (
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
          const fresh =
            sketch?.forPieces === lesson.board.pieces ? sketch : sketchFromBoard(lesson.board.pieces, sketch);
          if (fresh) setSketch(fresh);
        }
        setMode(next);
      }}
    />
  );

  return (
    <div className="lesson-editor-layout">
      <div className="lesson-editor-workspace">
        {mode === 'sketch' && !canSketch ? (
          <div className="sketch-editor">
            {modeToggle}
            <p className="muted-line">
              Esta lição tem cápsulas inteligentes, que o desenho ainda não monta sozinho. Veja o esquemático abaixo e
              edite o circuito na aba Protoboard.
            </p>
            <SchematicPreview pieces={lesson.board.pieces} />
          </div>
        ) : mode === 'sketch' && sketch ? (
          <SchematicEditor
            header={modeToggle}
            pieces={lesson.board.pieces}
            onChange={setPieces}
            sketch={sketch}
            setSketch={setSketch}
          />
        ) : (
          <BoardWorkspace
            pieces={lesson.board.pieces}
            onChange={setPieces}
            trail={mergeTrails(diag.trail, cap.driven)}
            ledMa={Math.max(diag.mA, cap.drivenMa)}
            readings={cap.readings}
            highlightIds={highlightIds}
            trayTypes={TYPES}
            boardHeader={modeToggle}
            fit
          />
        )}
      </div>

      <section className="panel lesson-panel" style={{ flex: '1 1 340px', maxWidth: 460 }}>
        <Tabs
          label="Seções da lição"
          value={section}
          tabs={[
            { id: 'lesson', label: 'Lição' },
            { id: 'steps', label: `${lesson.kind === 'challenge' ? 'Desafio' : 'Passos'} (${lesson.steps.length})` },
            { id: 'quizzes', label: `Perguntas (${lesson.quizzes.length})` },
          ]}
          onChange={setSection}
        />
        <div className="lesson-panel-body">
          {section === 'lesson' && (
            <>
              <h2>Lição</h2>
              {lesson.title.endsWith('(cópia)') && (
                <p>Cópia de “{lesson.title.replace(/ \(cópia\)$/, '')}”. Suas alterações aqui não mudam o original.</p>
              )}
              <details>
                <summary>Como criar uma atividade (e que tipos existem)</summary>
                <ol>
                  <li>Monte na bancada o circuito que o aluno deve alcançar.</li>
                  <li>
                    Escolha o tipo: <strong>guiada</strong> (passo a passo, com conferência em cada etapa) ou{' '}
                    <strong>desafio</strong> (o aluno monta sozinho; só o resultado final é conferido).
                  </li>
                  <li>
                    Acrescente o que ensina o conceito, além de montar:
                    <ul>
                      <li>
                        <strong>Explicação</strong>: título, texto e uma ilustração (.svg), com o explorador de nós se
                        quiser.
                      </li>
                      <li>
                        <strong>Pergunta</strong>: prever antes, conferir depois; escreva um retorno para cada
                        alternativa.
                      </li>
                      <li>
                        <strong>Experimento</strong>: laboratório simulado em que o aluno troca peças, gira o
                        potenciômetro, aperta botões ou desliga a fonte e cumpre <em>missões</em>.
                      </li>
                    </ul>
                  </li>
                  <li>
                    Em “Opções avançadas” defina peças da bandeja, dicas só depois de erros repetidos, exigir energizar
                    e, no desafio, uma <strong>bancada inicial com defeito</strong> (LED invertido, jumper faltando,
                    peça solta, curto).
                  </li>
                  <li>
                    Teste e salve. Em Módulos, organize as lições e atribua o módulo à turma; depois envie à bancada.
                  </li>
                </ol>
                <p>
                  Quer um modelo? Em <strong>Lições</strong>, filtre pela etiqueta <em>exemplo</em>: as lições do
                  currículo mostram cada tipo de atividade. Use “Duplicar” e adapte.
                </p>
                <p>
                  Exemplo de previsão: pergunta “qual resistor deixa o LED mais fraco?”, depois um experimento para
                  trocar os resistores e uma pergunta final para conferir.
                </p>
                <p>Os valores de corrente, brilho e som são simulados pelo software, não medidos na bancada física.</p>
              </details>
              <label className="field-label" htmlFor="title">
                Título
              </label>
              <input
                id="title"
                className="text-input"
                value={lesson.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Ex.: Acender um LED"
              />
              <label className="field-label" htmlFor="instruction">
                Instrução para o aluno
              </label>
              <textarea
                id="instruction"
                className="text-input"
                rows={3}
                value={lesson.instruction}
                onChange={(e) => set({ instruction: e.target.value })}
                placeholder="O que o aluno deve montar e por quê."
              />
              <label className="field-label" htmlFor="kind">
                Tipo
              </label>
              <select
                id="kind"
                className="text-input"
                value={lesson.kind}
                onChange={(e) => {
                  set(e.target.value === 'guided' ? { kind: 'guided', timeLimitS: null } : { kind: 'challenge' });
                  setSelected(null);
                }}
              >
                <option value="guided">Lição guiada</option>
                <option value="challenge">Desafio</option>
              </select>

              <LessonOptions lesson={lesson} setLesson={setLesson} />
            </>
          )}
          {section === 'steps' && (
            <>
              <h2>{lesson.kind === 'challenge' ? 'Desafio' : 'Passos'}</h2>
              <StepsEditor lesson={lesson} setLesson={setLesson} selected={selected} setSelected={setSelected} />
            </>
          )}
          {section === 'quizzes' && (
            <>
              <h2>Perguntas</h2>
              <QuizEditor quizzes={lesson.quizzes} onChange={(quizzes) => set({ quizzes })} />
            </>
          )}
        </div>
        <div className="lesson-panel-footer">
          {problems.length > 0 && (
            <ul className="problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary btn-icon" onClick={() => guarded(onSave)}>
              <Icon name="save" />
              Salvar
            </button>
            <button type="button" className="btn-outline btn-icon" onClick={() => guarded(onExport)}>
              <Icon name="download" />
              Exportar
            </button>
            <button type="button" className="btn-outline btn-icon" onClick={onTest}>
              <Icon name="play" />
              Testar
            </button>
          </div>
          {status && (
            <p role="status" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-accent-2-700)' }}>
              {status}
            </p>
          )}
          {unsaved && !status && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>
              Alterações ainda não salvas: se sair desta página, elas se perdem.
            </p>
          )}
          {lesson.tags?.includes('exemplo') && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>
              Esta é uma lição de exemplo do currículo. Para adaptar sem alterá-la, volte a Lições e use “Duplicar”.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
