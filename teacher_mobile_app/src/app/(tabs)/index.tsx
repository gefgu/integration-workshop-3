import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { Card, Icon, Pill } from '../../components/Kit';
import { useApp } from '../../lib/AppContext';
import { HelpButton, TourAnchor, useScreenTour } from '../../components/Tour';
import { APP_TOURS } from '../../lib/tours';
import { colors, fonts, ui } from '../../theme';

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Home: what the bench is doing, what is waiting to sync, and the one main action. */
export default function Home() {
  const router = useRouter();
  const { teacher, online, pending, syncMessage, lastSync, bench, benchLabel, logout, retryUpload, syncNow } = useApp();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const tour = useScreenTour('home', APP_TOURS.home);
  const firstName = teacher?.name?.split(' ')[0] ?? 'professor';
  const waiting = pending + (bench?.pending_events ?? 0);

  async function sync() {
    setBusy(true);
    setNote('');
    try {
      if (bench) {
        const report = await syncNow();
        setNote(
          report
            ? report.uploaded
              ? `${report.pulled} registro(s) da bancada enviados ao servidor.`
              : `${report.pulled} registro(s) guardados no celular; vão quando houver internet.`
            : 'Bancada desconectada.'
        );
      } else {
        await retryUpload();
        setNote('Envio tentado.');
      }
    } catch (cause) {
      setNote((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView contentContainerStyle={ui.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.accentDark }}>TedTronics</Text>
            <Text style={ui.h1}>Olá, {firstName}!</Text>
          </View>
          <Pill text={online ? 'Online' : 'Sem internet'} tone={online ? 'ok' : 'warn'} icon={online ? 'cloud-done' : 'cloud-offline'} />
          <TourAnchor id="home-help">
            <HelpButton onPress={tour.start} />
          </TourAnchor>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            onPress={logout}
            style={{ padding: 8, borderRadius: 999, backgroundColor: colors.surface }}
          >
            <Icon name="log-out-outline" size={22} />
          </Pressable>
        </View>

        {/* main action */}
        <TourAnchor id="home-cta">
        <Card tone="accent" icon="rocket-outline" title="Levar aula à bancada" onPress={() => router.push('/enviar')}>
          <Text style={[ui.text, { color: colors.white }]}>
            Conecte a bancada, escolha a turma e o módulo, e libere as lições para os alunos.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.heading, color: colors.white, fontSize: 15 }}>Começar</Text>
            <Icon name="arrow-forward" size={18} color={colors.white} />
          </View>
        </Card>
        </TourAnchor>

        {/* bench */}
        <TourAnchor id="home-bench">
        <Card
          icon="hardware-chip-outline"
          title="Bancada"
          right={<Pill text={bench ? 'Conectada' : 'Desconectada'} tone={bench ? 'ok' : 'neutral'} />}
        >
          {bench ? (
            <>
              <Text style={ui.text}>
                <Text style={{ fontFamily: fonts.bodyBold }}>{bench.bench_id}</Text> · {benchLabel}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="albums-outline" size={18} color={colors.muted} />
                <Text style={[ui.text, { flex: 1 }]}>
                  {bench.package ? `${bench.package.module_title} · ${bench.package.class_name}` : 'Nenhum módulo carregado'}
                </Text>
              </View>
            </>
          ) : (
            <Text style={ui.muted}>A bancada só libera as lições depois que este app se conecta a ela.</Text>
          )}
          <Button
            title={bench ? 'Gerenciar bancada' : 'Conectar bancada'}
            icon={bench ? 'settings-outline' : 'bluetooth'}
            variant={bench ? 'light' : 'primary'}
            onPress={() => router.push('/bancada')}
          />
        </Card>
        </TourAnchor>

        {/* sync */}
        <TourAnchor id="home-sync">
        <Card
          icon="sync-outline"
          title="Progresso dos alunos"
          right={waiting > 0 ? <Pill text={`${waiting} a enviar`} tone="warn" /> : <Pill text="Em dia" tone="ok" icon="checkmark" />}
        >
          <Text style={ui.muted}>
            {bench ? `${bench.pending_events} na bancada · ` : ''}
            {pending} no celular
            {lastSync ? ` · último envio ${when(lastSync)}` : ''}
          </Text>
          {syncMessage && pending > 0 ? <Text style={ui.error}>{syncMessage}</Text> : null}
          {note ? <Text style={ui.ok}>{note}</Text> : null}
          <Button
            title={bench ? 'Buscar da bancada e enviar' : 'Enviar pendentes'}
            icon="cloud-upload-outline"
            variant="light"
            busy={busy}
            disabled={!bench && pending === 0}
            onPress={sync}
          />
        </Card>
        </TourAnchor>

        <Text style={[ui.muted, { textAlign: 'center' }]}>
          Lições, módulos e alunos são criados no site do professor.{'\n'}
          {teacher?.email}
        </Text>
      </ScrollView>
      {tour.overlay}
    </SafeAreaView>
  );
}
