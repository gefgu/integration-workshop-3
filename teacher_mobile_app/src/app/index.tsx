import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Button from '../components/Button';
import { useApp } from '../lib/AppContext';
import { colors, ui } from '../theme';

export default function Home() {
  const router = useRouter();
  const { teacher, online, pending, syncMessage, lastSync, bench, benchLabel, logout, retryUpload } = useApp();
  const [busy, setBusy] = useState(false);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={ui.h1}>Olá, {teacher?.name?.split(' ')[0]}!</Text>

      <View style={ui.card}>
        <Text style={ui.h2}>Bancada</Text>
        {bench ? (
          <>
            <Text style={ui.ok}>
              Conectada: {benchLabel} · {bench.bench_id}
            </Text>
            <Text style={ui.text}>
              Módulo carregado:{' '}
              {bench.package ? `${bench.package.module_title} (${bench.package.class_name})` : 'nenhum'}
            </Text>
            <Text style={ui.muted}>{bench.pending_events} evento(s) aguardando na bancada.</Text>
          </>
        ) : (
          <Text style={ui.muted}>
            A bancada só libera as lições depois que este app se conecta a ela por Bluetooth.
          </Text>
        )}
        <Button title={bench ? 'Gerenciar bancada' : 'Conectar bancada'} onPress={() => router.push('/bancada')} />
      </View>

      <View style={ui.card}>
        <Text style={ui.h2}>Sincronização</Text>
        <Text style={ui.text}>
          {online ? 'Online' : 'Sem internet'} · {pending} evento(s) pendente(s) no celular
        </Text>
        {lastSync ? <Text style={ui.muted}>Último envio: {new Date(lastSync).toLocaleString('pt-BR')}</Text> : null}
        {syncMessage ? <Text style={pending ? ui.error : ui.muted}>{syncMessage}</Text> : null}
        {pending > 0 && (
          <Button
            title="Tentar enviar agora"
            variant="outline"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              await retryUpload();
              setBusy(false);
            }}
          />
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title="Turmas" variant="outline" onPress={() => router.push('/turmas')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Módulos" variant="outline" onPress={() => router.push('/modulos')} />
        </View>
      </View>
      <Text style={[ui.muted, { textAlign: 'center' }]}>
        Para criar lições, módulos e alunos, use o site do professor.
      </Text>
      <Button title="Sair" variant="outline" onPress={logout} />
      <Text style={[ui.muted, { textAlign: 'center', color: colors.muted }]}>{teacher?.email}</Text>
    </ScrollView>
  );
}
