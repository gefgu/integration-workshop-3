import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { Row, StateView } from '../../components/Kit';
import type { SchoolClass } from '../../lib/api';
import { useApp } from '../../lib/AppContext';
import { colors, ui } from '../../theme';

export default function Turmas() {
  const router = useRouter();
  const { api } = useApp();
  const [items, setItems] = useState<SchoolClass[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      api.classes().then(
        (list) => {
          setItems(list);
          setError('');
        },
        (cause) => setError((cause as Error).message)
      ),
    [api]
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (error && !items) return <StateView icon="cloud-offline-outline" title="Não deu para carregar" text={error} />;
  if (!items) return <StateView loading text="Carregando turmas…" />;
  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={items}
      keyExtractor={(item) => String(item.id)}
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
      ListEmptyComponent={
        <StateView icon="people-outline" title="Nenhuma turma" text="Crie turmas e alunos pelo site do professor." />
      }
      renderItem={({ item }) => (
        <Row
          initial={item.name}
          title={item.name}
          detail={`${item.student_count ?? 0} aluno(s)${item.description ? ` · ${item.description}` : ''}`}
          onPress={() => router.push({ pathname: '/turmas/[id]', params: { id: String(item.id), name: item.name } })}
        />
      )}
    />
  );
}
