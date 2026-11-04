import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Button from '../components/Button';
import type { Module, SchoolClass } from '../lib/api';
import { useApp } from '../lib/AppContext';
import { colors, ui } from '../theme';

/** Picks a module and a class and loads that package on the connected bench. */
export default function Modulos() {
  const router = useRouter();
  const { api, bench, sendModuleToBench } = useApp();
  const [modules, setModules] = useState<Module[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([api.modules(), api.classes()]).then(
      ([m, c]) => {
        setModules(m);
        setClasses(c);
      },
      (cause) => setError(cause.message)
    );
  }, [api]);

  const selected = modules?.find((m) => m.id === moduleId);
  const classChoices = selected?.class_ids.length ? classes.filter((c) => selected.class_ids.includes(c.id)) : classes;

  async function send() {
    if (moduleId == null || classId == null) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const version = await sendModuleToBench(moduleId, classId);
      setMessage(`Módulo enviado (versão ${version}). Os alunos já podem usar a bancada.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // The one thing still missing, in the order the teacher has to do it (the button says it instead of just being gray).
  const missing = !bench
    ? 'Conecte uma bancada'
    : moduleId == null
      ? 'Escolha um módulo'
      : classId == null
        ? 'Escolha a turma'
        : '';

  if (!modules && !error) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.accent} />;
  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} contentInsetAdjustmentBehavior="automatic">
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {message ? <Text style={ui.ok}>{message}</Text> : null}
      <View style={ui.card}>
        <Text style={ui.text}>{bench ? '✓ 1. Bancada conectada' : '1. Conecte a bancada'}</Text>
        {bench ? (
          <Text style={ui.muted}>{bench.bench_id}</Text>
        ) : (
          <Button title="Conectar bancada" variant="outline" onPress={() => router.push('/bancada')} />
        )}
      </View>
      <Text style={ui.label}>{moduleId == null ? '2. Escolha o módulo' : '✓ 2. Módulo'}</Text>
      {modules?.length === 0 && (
        <Text style={ui.muted}>
          Nenhum módulo ainda. No site do professor, abra Início e toque em “Usar currículo TedTronics”.
        </Text>
      )}
      {modules?.map((m) => (
        <Choice
          key={m.id}
          title={m.title}
          detail={`${m.lesson_ids.length} lição(ões)`}
          selected={moduleId === m.id}
          onPress={() => {
            setModuleId(m.id);
            setClassId(null);
          }}
        />
      ))}
      {selected && (
        <>
          <Text style={ui.label}>{classId == null ? '3. Escolha a turma' : '✓ 3. Turma'}</Text>
          {classChoices.map((c) => (
            <Choice
              key={c.id}
              title={c.name}
              detail={`${c.student_count ?? 0} aluno(s)`}
              selected={classId === c.id}
              onPress={() => setClassId(c.id)}
            />
          ))}
        </>
      )}
      <Button
        title={missing ? `Enviar para a bancada (${missing.toLowerCase()})` : 'Enviar para a bancada'}
        busy={busy}
        disabled={Boolean(missing)}
        onPress={send}
      />
      {missing ? <Text style={ui.muted}>Falta: {missing.toLowerCase()}.</Text> : null}
    </ScrollView>
  );
}

function Choice({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[ui.card, selected && { borderWidth: 2, borderColor: colors.accent }]}
    >
      <Text style={ui.text}>{title}</Text>
      <Text style={ui.muted}>{detail}</Text>
    </Pressable>
  );
}
