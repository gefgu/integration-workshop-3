import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Button from '../components/Button';
import { useApp } from '../lib/AppContext';
import { SimTransport } from '../lib/simTransport';
import { colors, ui } from '../theme';

interface Found {
  id: string;
  name: string;
}

/** Pairing (Bluetooth or the bench simulator), sync of pending data and module status. */
export default function Bancada() {
  const router = useRouter();
  const { bench, benchLabel, connectBench, disconnectBench, syncNow } = useApp();
  const [mode, setMode] = useState<'ble' | 'sim'>('sim');
  const [host, setHost] = useState('192.168.0.10:8765');
  const [found, setFound] = useState<Found[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

  async function scan() {
    setError('');
    setFound([]);
    setScanning(true);
    try {
      // Loaded lazily: the BLE native module only exists in a development build.
      const { scanBenches } = await import('../lib/bleTransport');
      await scanBenches((device) =>
        setFound((list) => [...list, { id: device.id, name: device.localName ?? device.name ?? device.id }])
      );
    } catch (cause) {
      setError(
        `${(cause as Error).message} O Bluetooth precisa do app compilado (npx expo run:android); use o simulador no Expo Go.`
      );
    } finally {
      setScanning(false);
    }
  }

  const connected = (label: string) => `Conectado a ${label}. Bancada liberada para os alunos.`;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} contentInsetAdjustmentBehavior="automatic">
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {message ? <Text style={ui.ok}>{message}</Text> : null}

      {bench ? (
        <View style={ui.card}>
          <Text style={ui.h2}>{bench.bench_id}</Text>
          <Text style={ui.muted}>{benchLabel}</Text>
          <Text style={ui.text}>
            Módulo: {bench.package ? `${bench.package.module_title} · turma ${bench.package.class_name}` : 'nenhum'}
          </Text>
          <Text style={ui.text}>{bench.pending_events} evento(s) de progresso na bancada</Text>
          <Button
            title="Sincronizar progresso"
            busy={busy}
            onPress={() =>
              run(async () => {
                const report = await syncNow();
                if (!report) return 'Bancada desconectada.';
                return report.uploaded
                  ? `${report.pulled} evento(s) recebidos e enviados ao servidor; ${report.benchDeleted} apagado(s) da bancada.`
                  : `${report.pulled} evento(s) guardados no celular. Serão enviados quando houver internet.`;
              })
            }
          />
          <Button title="Enviar módulo" variant="outline" onPress={() => router.push('/modulos')} />
          <Button title="Desconectar" variant="outline" onPress={() => run(async () => (await disconnectBench(), 'Desconectado.'))} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['sim', 'ble'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: mode === m ? colors.accent : colors.surface,
                }}
              >
                <Text style={[ui.text, { color: mode === m ? colors.bg : colors.text }]}>
                  {m === 'ble' ? 'Bluetooth' : 'Simulador'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'sim' ? (
            <View style={ui.card}>
              <Text style={ui.h2}>Bancada simulada</Text>
              <Text style={ui.muted}>
                Mesmo protocolo do Bluetooth, por Wi-Fi. Informe o IP do computador com o serviço da bancada.
              </Text>
              <Text style={ui.label}>Endereço</Text>
              <TextInput
                style={ui.input}
                value={host}
                onChangeText={setHost}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Endereço da bancada simulada"
              />
              <Button
                title="Conectar"
                busy={busy}
                onPress={() =>
                  run(async () => {
                    const transport = SimTransport.fromHost(host);
                    await connectBench(transport);
                    return connected(transport.label);
                  })
                }
              />
            </View>
          ) : (
            <View style={ui.card}>
              <Text style={ui.h2}>Bancadas por perto</Text>
              <Button title={scanning ? 'Procurando…' : 'Procurar bancadas'} busy={scanning} onPress={scan} />
              {found.map((device) => (
                <Button
                  key={device.id}
                  title={device.name}
                  variant="outline"
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      const { BleTransport } = await import('../lib/bleTransport');
                      await connectBench(new BleTransport(device.id, device.name));
                      return connected(device.name);
                    })
                  }
                />
              ))}
              {!scanning && found.length === 0 && <Text style={ui.muted}>Nenhuma bancada encontrada ainda.</Text>}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
