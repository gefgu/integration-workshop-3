import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BenchStatus } from '../../../protocol/bench.ts';
import { Api, type Teacher } from './api';
import { BenchClient, type BenchTransport } from './benchClient';
import { type SyncReport, SyncQueue, sendModule, syncBench } from './sync';

interface AppState {
  ready: boolean;
  api: Api;
  teacher: Teacher | null;
  online: boolean;
  pending: number;
  syncMessage: string | null;
  lastSync: string | null;
  bench: BenchStatus | null;
  benchLabel: string | null;
  login: (server: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  connectBench: (transport: BenchTransport) => Promise<BenchStatus>;
  disconnectBench: () => Promise<void>;
  syncNow: () => Promise<SyncReport | null>;
  sendModuleToBench: (moduleId: number, classId: number) => Promise<string>;
  retryUpload: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const api = useMemo(() => new Api(AsyncStorage), []);
  const queue = useMemo(() => new SyncQueue(AsyncStorage), []);
  const client = useRef<BenchClient | null>(null);
  const [ready, setReady] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [online, setOnline] = useState(true);
  const [queueTick, setQueueTick] = useState(0);
  const [bench, setBench] = useState<BenchStatus | null>(null);
  const [benchLabel, setBenchLabel] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.load(), queue.load()]).then(() => {
      setTeacher(api.teacher);
      setReady(true);
    });
  }, [api, queue]);

  const retryUpload = useCallback(async () => {
    if (!api.token || queue.pendingCount === 0) return;
    await queue.flush(api);
    setQueueTick((n) => n + 1);
  }, [api, queue]);

  // SFR45: when the connection comes back, pending bench data goes up on its own.
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
        setOnline(isOnline);
        if (isOnline) void retryUpload();
      }),
    [retryUpload]
  );

  const disconnectBench = useCallback(async () => {
    await client.current?.transport.close();
    client.current = null;
    setBench(null);
    setBenchLabel(null);
  }, []);

  const login = useCallback(
    async (server: string, email: string, password: string) => {
      await api.setServer(server);
      setTeacher(await api.login(email, password));
    },
    [api]
  );

  const logout = useCallback(async () => {
    await disconnectBench();
    await api.logout();
    setTeacher(null);
  }, [api, disconnectBench]);

  const connectBench = useCallback(
    async (transport: BenchTransport) => {
      await disconnectBench();
      const { token } = await api.benchSession();
      await transport.connect();
      const next = new BenchClient(transport);
      transport.onClose(() => {
        if (client.current === next) {
          client.current = null;
          setBench(null);
          setBenchLabel(null);
        }
      });
      try {
        const status = await next.hello(token);
        client.current = next;
        setBench(status);
        setBenchLabel(transport.label);
        return status;
      } catch (error) {
        await transport.close();
        throw error;
      }
    },
    [api, disconnectBench]
  );

  const syncNow = useCallback(async () => {
    if (!client.current) return null;
    const report = await syncBench(client.current, queue, api);
    setBench(client.current.status);
    setQueueTick((n) => n + 1);
    return report;
  }, [api, queue]);

  const sendModuleToBench = useCallback(
    async (moduleId: number, classId: number) => {
      if (!client.current) throw new Error('Conecte uma bancada primeiro.');
      const pkg = await sendModule(client.current, api, moduleId, classId);
      setBench(client.current.status);
      return pkg.version_id;
    },
    [api]
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      api,
      teacher,
      online,
      pending: queue.pendingCount,
      syncMessage: queue.state.lastError,
      lastSync: queue.state.lastSync,
      bench,
      benchLabel,
      login,
      logout,
      connectBench,
      disconnectBench,
      syncNow,
      sendModuleToBench,
      retryUpload,
    }),
    // queueTick re-reads the queue's counters after each change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, api, teacher, online, queue, queueTick, bench, benchLabel, login, logout, connectBench, disconnectBench, syncNow, sendModuleToBench, retryUpload]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp fora de AppProvider');
  return value;
}
