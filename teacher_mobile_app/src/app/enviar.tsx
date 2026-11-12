import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import BenchConnect from '../components/BenchConnect';
import Button from '../components/Button';
import { Card, Icon, Row, StateView } from '../components/Kit';
import type { Module, SchoolClass, Student } from '../lib/api';
import { useApp } from '../lib/AppContext';
import type { SendProgress } from '../lib/sync';
import { TourAnchor, useScreenTour } from '../components/Tour';
import { APP_TOURS } from '../lib/tours';
import { shortUid } from '../lib/progress';
import { colors, fonts, ui } from '../theme';

const STEPS = ['Bancada', 'Turma', 'Aluno', 'Módulo', 'Enviar'] as const;
type Step = 0 | 1 | 2 | 3 | 4 | 5; // 5 = done
const DONE: Step = 5;

/**
 * Guided flow: connect the bench → pick the class → pick the student who will use the bench → pick the module →
 * send. The student goes with the module (there are no tags: the teacher decides who sits at each bench).
 */
export default function Enviar() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string }>();
  const { api, bench, benchLabel, sendModuleToBench } = useApp();
  const [chosenStep, setStep] = useState<Step>(bench ? 1 : 0);
  // Losing the bench mid-way sends the teacher back to step 1.
  const step: Step = !bench && chosenStep > 0 && chosenStep < DONE ? 0 : chosenStep;
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [modules, setModules] = useState<Module[] | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [moduleId, setModuleId] = useState<number | null>(params.moduleId ? Number(params.moduleId) : null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [error, setError] = useState('');
  const tour = useScreenTour('enviar', APP_TOURS.enviar);

  useEffect(() => {
    Promise.all([api.classes(), api.modules()]).then(
      ([c, m]) => {
        setClasses(c);
        setModules(m);
      },
      (cause) => setError((cause as Error).message)
    );
  }, [api]);

  // The class's students, for the "who uses the bench" step; inactive students cannot use it.
  useEffect(() => {
    if (classId == null) return undefined;
    let alive = true;
    setStudents(null);
    api.classDetail(classId).then(
      (detail) => alive && setStudents(detail.students.filter((s) => s.active)),
      (cause) => alive && setError((cause as Error).message)
    );
    return () => {
      alive = false;
    };
  }, [api, classId]);

  const pickedClass = classes?.find((c) => c.id === classId);
  const pickedStudent = students?.find((s) => s.id === studentId);
  const pickedModule = modules?.find((m) => m.id === moduleId);
  const forClass = modules?.filter((m) => classId != null && m.class_ids.includes(classId)) ?? [];
  const others = modules?.filter((m) => !forClass.includes(m)) ?? [];

  async function send() {
    if (moduleId == null || classId == null || studentId == null) return;
    setBusy(true);
    setError('');
    let shown = '';
    try {
      await sendModuleToBench(moduleId, classId, studentId, (next) => {
        // Hundreds of frames: re-render only when the whole percent (or the phase) changes.
        const key =
          next.phase === 'send' ? `send${Math.floor((100 * next.sent) / next.total)}r${next.retry ?? 0}` : next.phase;
        if (key === shown) return;
        shown = key;
        setProgress(next);
      });
      setStep(DONE);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (step === DONE) {
    return (
      <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { flexGrow: 1, justifyContent: 'center' }]}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.oliveSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="checkmark" size={56} color={colors.oliveDark} />
          </View>
          <Text style={[ui.h1, { textAlign: 'center' }]}>Aula na bancada!</Text>
          <Text style={[ui.text, { textAlign: 'center' }]}>
            {pickedModule?.title} está na bancada para {pickedStudent?.name} ({pickedClass?.name}). É só tocar em Entrar na
            tela da bancada.
          </Text>
        </View>
        <Button
          title="Mesma aula para outro aluno"
          icon="swap-horizontal"
          variant="light"
          onPress={() => {
            setStudentId(null);
            setStep(2);
          }}
        />
        <Button title="Voltar ao início" icon="home-outline" onPress={() => (router.canDismiss() ? router.dismissAll() : router.replace('/'))} />
        {pickedClass && (
          <Button
            title="Ver a turma"
            icon="people-outline"
            variant="light"
            onPress={() =>
              router.replace({ pathname: '/turmas/[id]', params: { id: String(pickedClass.id), name: pickedClass.name } })
            }
          />
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <TourAnchor id="enviar-stepper">
        <Stepper step={step} />
      </TourAnchor>
      {tour.overlay}
      {error ? <Text style={ui.error}>{error}</Text> : null}

      {step === 0 && (
        <>
          <Text style={ui.h2}>Conecte a bancada</Text>
          <BenchConnect onConnected={() => setStep(1)} />
        </>
      )}

      {step === 1 && (
        <>
          <Text style={ui.h2}>Para qual turma?</Text>
          {!classes ? (
            <StateView loading />
          ) : classes.length === 0 ? (
            <StateView icon="people-outline" title="Nenhuma turma" text="Crie turmas e alunos pelo site do professor." />
          ) : (
            classes.map((c) => (
              <Row
                key={c.id}
                icon="people-outline"
                title={c.name}
                detail={`${c.student_count ?? 0} aluno(s)`}
                selected={classId === c.id}
                onPress={() => {
                  if (c.id !== classId) setStudentId(null);
                  setClassId(c.id);
                  if (moduleId != null && !modules?.some((m) => m.id === moduleId)) setModuleId(null);
                }}
              />
            ))
          )}
          <Nav back={bench ? undefined : () => setStep(0)} next={() => setStep(2)} disabled={classId == null} />
        </>
      )}

      {step === 2 && (
        <>
          <Text style={ui.h2}>Quem vai usar a bancada?</Text>
          {!students ? (
            <StateView loading />
          ) : students.length === 0 ? (
            <StateView icon="person-add-outline" title="Nenhum aluno ativo" text="Cadastre alunos nesta turma pelo site do professor." />
          ) : (
            students.map((s) => (
              <Row
                key={s.id}
                initial={s.nickname || s.name}
                title={s.name}
                detail={`${s.nickname} · ID ${shortUid(s.uid)}`}
                selected={studentId === s.id}
                onPress={() => setStudentId(s.id)}
              />
            ))
          )}
          <Nav back={() => setStep(1)} next={() => setStep(3)} disabled={studentId == null} />
        </>
      )}

      {step === 3 && (
        <>
          <Text style={ui.h2}>Qual módulo?</Text>
          {!modules ? (
            <StateView loading />
          ) : modules.length === 0 ? (
            <StateView icon="albums-outline" title="Nenhum módulo" text="Crie módulos pelo site do professor." />
          ) : (
            <>
              {forClass.length > 0 && <Text style={ui.label}>Desta turma</Text>}
              {forClass.map((m) => (
                <ModuleRow key={m.id} module={m} selected={moduleId === m.id} onPress={() => setModuleId(m.id)} />
              ))}
              {others.length > 0 && <Text style={ui.label}>{forClass.length ? 'Outros módulos' : 'Módulos'}</Text>}
              {others.map((m) => (
                <ModuleRow key={m.id} module={m} selected={moduleId === m.id} onPress={() => setModuleId(m.id)} />
              ))}
            </>
          )}
          <Nav back={() => setStep(2)} next={() => setStep(4)} disabled={moduleId == null} />
        </>
      )}

      {step === 4 && (
        <>
          <Text style={ui.h2}>Confira e envie</Text>
          <Card>
            <Summary icon="hardware-chip-outline" label="Bancada" value={`${bench?.bench_id ?? ''} · ${benchLabel ?? ''}`} />
            <Summary icon="people-outline" label="Turma" value={pickedClass?.name ?? ''} />
            <Summary
              icon="person-outline"
              label="Aluno na bancada"
              value={`${pickedStudent?.name} · ${pickedStudent?.nickname} · ID ${pickedStudent ? shortUid(pickedStudent.uid) : ''}`}
            />
            <Summary
              icon="albums-outline"
              label="Módulo"
              value={`${pickedModule?.title} · ${pickedModule?.lesson_ids.length ?? 0} lição(ões)`}
            />
          </Card>
          {bench?.package && (
            <Text style={ui.muted}>
              A bancada está com “{bench.package.module_title}”
              {bench.package.student_nickname ? ` para ${bench.package.student_nickname}` : ''}. Será trocado; o progresso já
              salvo continua.
            </Text>
          )}
          {progress && <SendBar progress={progress} />}
          <Button title="Enviar para a bancada" icon="send" busy={busy} onPress={send} />
          <Button title="Voltar" icon="arrow-back" variant="outline" disabled={busy} onPress={() => setStep(3)} />
        </>
      )}
    </ScrollView>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : done || current ? colors.accent : colors.divider }} />
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? colors.olive : current ? colors.accent : colors.surface,
                }}
              >
                {done ? (
                  <Icon name="checkmark" size={18} color={colors.white} />
                ) : (
                  <Text style={{ fontFamily: fonts.bodyBold, color: current ? colors.white : colors.muted }}>{i + 1}</Text>
                )}
              </View>
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: i === STEPS.length - 1 ? 'transparent' : done ? colors.accent : colors.divider,
                }}
              />
            </View>
            <Text style={{ fontFamily: current ? fonts.bodyBold : fonts.body, fontSize: 12, color: current ? colors.text : colors.muted }}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Download → writing the frames (percent) → the bench confirming; the send can take a minute over Bluetooth. */
function SendBar({ progress }: { progress: SendProgress }) {
  const percent =
    progress.phase === 'download' ? 0 : progress.phase === 'confirm' ? 100 : Math.floor((100 * progress.sent) / progress.total);
  const label =
    progress.phase === 'download'
      ? 'Baixando o módulo do servidor…'
      : progress.phase === 'confirm'
        ? 'Enviado. Esperando a bancada confirmar…'
        : progress.retry
          ? `O Bluetooth travou em ${percent}%. Reconectando e continuando de onde parou (tentativa ${progress.retry})…`
          : `Enviando para a bancada… ${percent}%`;
  return (
    <Card>
      <Text style={ui.text} accessibilityLiveRegion="polite">
        {label}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={{ height: 10, borderRadius: 5, backgroundColor: colors.divider, overflow: 'hidden', marginTop: 8 }}
      >
        <View style={{ width: `${percent}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
      {progress.phase === 'send' && (
        <Text style={[ui.muted, { marginTop: 6 }]}>Mantenha o celular perto da bancada até terminar.</Text>
      )}
    </Card>
  );
}

function ModuleRow({ module, selected, onPress }: { module: Module; selected: boolean; onPress: () => void }) {
  return (
    <Row
      icon="albums-outline"
      title={module.title}
      detail={`${module.lesson_ids.length} lição(ões)`}
      selected={selected}
      onPress={onPress}
    />
  );
}

function Summary({ icon, label, value }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <Icon name={icon} size={20} color={colors.accentDark} />
      <View style={{ flex: 1 }}>
        <Text style={ui.label}>{label}</Text>
        <Text style={ui.text}>{value}</Text>
      </View>
    </View>
  );
}

function Nav({ back, next, disabled }: { back?: () => void; next: () => void; disabled: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
      {back && (
        <View style={{ flex: 1 }}>
          <Button title="Voltar" icon="arrow-back" variant="outline" onPress={back} />
        </View>
      )}
      <View style={{ flex: 2 }}>
        <Button title="Próximo" icon="arrow-forward" disabled={disabled} onPress={next} />
      </View>
    </View>
  );
}
