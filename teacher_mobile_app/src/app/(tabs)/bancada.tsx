import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import BenchConnect from '../../components/BenchConnect';
import Button from '../../components/Button';
import { Card, Icon, Pill } from '../../components/Kit';
import { useApp } from '../../lib/AppContext';
import { TourAnchor, useScreenTour } from '../../components/Tour';
import { APP_TOURS } from '../../lib/tours';
import { colors, fonts, ui } from '../../theme';

/** Pairing (Bluetooth or the bench simulator), sync of pending data and module status. */
export default function Bancada() {
  const router = useRouter();
  const { bench, benchLabel, disconnectBench, syncNow } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const tour = useScreenTour('bancada', APP_TOURS.bancada);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await action());
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {message ? <Text style={ui.ok}>{message}</Text> : null}

      {bench ? (
        <>
          <TourAnchor id="bench-connected">
          <Card icon="hardware-chip" title={bench.bench_id} right={<Pill text="Conectada" tone="ok" icon="link" />}>
            <Text style={ui.muted}>{benchLabel}</Text>
            <Line icon="albums-outline" text={bench.package ? bench.package.module_title : 'Nenhum módulo carregado'} />
            {bench.package ? <Line icon="people-outline" text={`Turma ${bench.package.class_name}`} /> : null}
            <Line icon="stats-chart-outline" text={`${bench.pending_events} registro(s) de progresso na bancada`} />
          </Card>
          </TourAnchor>
          <Button title="Levar outra aula à bancada" icon="rocket-outline" onPress={() => router.push('/enviar')} />
          <Button
            title="Buscar progresso e enviar"
            icon="cloud-upload-outline"
            variant="light"
            busy={busy}
            onPress={() =>
              run(async () => {
                const report = await syncNow();
                if (!report) return 'Bancada desconectada.';
                return report.uploaded
                  ? `${report.pulled} registro(s) recebidos e enviados ao servidor.`
                  : `${report.pulled} registro(s) guardados no celular. Vão quando houver internet.`;
              })
            }
          />
          <Button
            title="Desconectar"
            icon="close-circle-outline"
            variant="outline"
            onPress={() => run(async () => (await disconnectBench(), 'Desconectado.'))}
          />
        </>
      ) : (
        <>
          <Text style={ui.muted}>Conecte o celular à bancada para liberar as lições e buscar o progresso dos alunos.</Text>
          <BenchConnect onConnected={(label) => setMessage(`Conectado a ${label}. Bancada liberada para os alunos.`)} />
        </>
      )}
      {tour.overlay}
    </ScrollView>
  );
}

function Line({ icon, text }: { icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={18} color={colors.muted} />
      <Text style={[ui.text, { flex: 1, fontFamily: fonts.body }]}>{text}</Text>
    </View>
  );
}
