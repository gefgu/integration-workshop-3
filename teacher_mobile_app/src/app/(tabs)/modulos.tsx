import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import Button from '../../components/Button';
import { Row, StateView } from '../../components/Kit';
import type { Module, SchoolClass } from '../../lib/api';
import { useApp } from '../../lib/AppContext';
import { colors, ui } from '../../theme';

/** The teacher's modules (made on the website); each one can be taken to the bench. */
export default function Modulos() {
  const router = useRouter();
  const { api, bench } = useApp();
  const [modules, setModules] = useState<Module[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([api.modules(), api.classes()]).then(
        ([m, c]) => {
          setModules(m);
          setClasses(c);
          setError('');
        },
        (cause) => setError((cause as Error).message)
      ),
    [api]
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (error && !modules) return <StateView icon="cloud-offline-outline" title="Não deu para carregar" text={error} />;
  if (!modules) return <StateView loading text="Carregando módulos…" />;
  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={modules}
      keyExtractor={(m) => String(m.id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <Text style={ui.muted}>
          {bench?.package ? `Na bancada agora: ${bench.package.module_title}` : 'Toque num módulo para levar à bancada.'}
        </Text>
      }
      ListEmptyComponent={
        <StateView icon="albums-outline" title="Nenhum módulo" text="Crie módulos e atribua às turmas pelo site do professor." />
      }
      renderItem={({ item }) => {
        const classNames = classes.filter((c) => item.class_ids.includes(c.id)).map((c) => c.name);
        const onBench = bench?.package?.module_title === item.title;
        return (
          <Row
            icon={onBench ? 'hardware-chip' : 'albums-outline'}
            title={item.title}
            detail={`${item.lesson_ids.length} lição(ões)${classNames.length ? ` · ${classNames.join(', ')}` : ''}`}
            selected={open === item.id}
            onPress={() => setOpen(open === item.id ? null : item.id)}
          >
            {open === item.id && (
              <>
                {item.description ? <Text style={ui.text}>{item.description}</Text> : null}
                <Button
                  title="Levar à bancada"
                  icon="rocket-outline"
                  onPress={() => router.push({ pathname: '/enviar', params: { moduleId: String(item.id) } })}
                />
              </>
            )}
          </Row>
        );
      }}
    />
  );
}
