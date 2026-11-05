import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useApp } from '../lib/AppContext';
import { SimTransport } from '../lib/simTransport';
import { colors, ui } from '../theme';
import Button from './Button';
import { Card, Icon } from './Kit';
import { TourAnchor } from './Tour';

interface Found {
  id: string;
  name: string;
}

const LAST_HOST = 'tedtronics.lastBenchHost';

/** Connect to a bench by Bluetooth or through the simulator (Wi-Fi). Used by the Bench tab and the send flow. */
export default function BenchConnect({ onConnected }: { onConnected?: (label: string) => void }) {
  const { connectBench } = useApp();
  const [mode, setMode] = useState<'ble' | 'sim'>(Platform.OS === 'web' ? 'sim' : 'ble');
  // In the browser the bench simulator usually runs on the same machine as the page.
  const [host, setHost] = useState(
    Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.hostname}:8765` : ''
  );
  const [found, setFound] = useState<Found[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The last simulator address is remembered between sessions.
  useEffect(() => {
    AsyncStorage.getItem(LAST_HOST).then((saved) => {
      if (saved) setHost(saved);
    });
  }, []);

  async function connect(make: () => Promise<{ label: string; transport: Parameters<typeof connectBench>[0] }>) {
    setBusy(true);
    setError('');
    try {
      const { label, transport } = await make();
      await connectBench(transport);
      onConnected?.(label);
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
      // Loaded lazily: the BLE native module only exists in the compiled app.
      const { scanBenches } = await import('../lib/bleTransport');
      await scanBenches((device) =>
        setFound((list) =>
          list.some((d) => d.id === device.id)
            ? list
            : [...list, { id: device.id, name: device.localName ?? device.name ?? device.id }]
        )
      );
    } catch (cause) {
      setError(`${(cause as Error).message} O Bluetooth só funciona no app instalado; aqui use o simulador.`);
    } finally {
      setScanning(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <TourAnchor id="bench-modes">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['ble', 'sim'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={{
              flex: 1,
              flexDirection: 'row',
              gap: 6,
              paddingVertical: 11,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mode === m ? colors.accent : colors.surface,
            }}
          >
            <Icon name={m === 'ble' ? 'bluetooth' : 'wifi'} size={18} color={mode === m ? colors.white : colors.text} />
            <Text style={[ui.text, { color: mode === m ? colors.white : colors.text }]}>
              {m === 'ble' ? 'Bluetooth' : 'Simulador (Wi-Fi)'}
            </Text>
          </Pressable>
        ))}
      </View>
      </TourAnchor>

      {error ? <Text style={ui.error}>{error}</Text> : null}
      <TourAnchor id="bench-connect">

      {mode === 'sim' ? (
        <Card icon="desktop-outline" title="Bancada simulada">
          <Text style={ui.muted}>
            O computador com o serviço da bancada precisa estar na mesma rede Wi-Fi. Digite o IP dele (porta 8765).
          </Text>
          <TextInput
            style={ui.input}
            value={host}
            onChangeText={setHost}
            placeholder="ex.: 192.168.15.3:8765"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Endereço da bancada simulada"
          />
          <Button
            title="Conectar"
            icon="link"
            busy={busy}
            disabled={!host.trim()}
            onPress={() =>
              connect(async () => {
                await AsyncStorage.setItem(LAST_HOST, host.trim());
                const transport = SimTransport.fromHost(host.trim());
                return { label: transport.label, transport };
              })
            }
          />
        </Card>
      ) : (
        <Card icon="bluetooth" title="Bancadas por perto">
          <Text style={ui.muted}>Ligue o Bluetooth do celular e fique perto da bancada.</Text>
          <Button title={scanning ? 'Procurando…' : 'Procurar bancadas'} icon="search" busy={scanning} onPress={scan} />
          {found.map((device) => (
            <Button
              key={device.id}
              title={device.name}
              icon="hardware-chip-outline"
              variant="light"
              disabled={busy}
              onPress={() =>
                connect(async () => {
                  const { BleTransport } = await import('../lib/bleTransport');
                  return { label: device.name, transport: new BleTransport(device.id, device.name) };
                })
              }
            />
          ))}
          {!scanning && found.length === 0 && <Text style={ui.muted}>Nenhuma bancada encontrada ainda.</Text>}
        </Card>
      )}
      </TourAnchor>
    </View>
  );
}
