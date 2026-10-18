import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text } from 'react-native';
import type { SchoolClass } from '../../lib/api';
import { useApp } from '../../lib/AppContext';
import { colors, ui } from '../../theme';

export default function Turmas() {
  const router = useRouter();
  const { api } = useApp();
  const [items, setItems] = useState<SchoolClass[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.classes().then(setItems, (cause) => setError(cause.message));
  }, [api]);

  if (error) return <Text style={[ui.error, { margin: 16 }]}>{error}</Text>;
  if (!items) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.accent} />;
  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={<Text style={ui.muted}>Nenhuma turma. Crie turmas pelo site do professor.</Text>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          style={ui.card}
          onPress={() => router.push({ pathname: '/turmas/[id]', params: { id: String(item.id), name: item.name } })}
        >
          <Text style={ui.h2}>{item.name}</Text>
          <Text style={ui.muted}>
            {item.student_count ?? 0} aluno(s){item.description ? ` · ${item.description}` : ''}
          </Text>
        </Pressable>
      )}
    />
  );
}
