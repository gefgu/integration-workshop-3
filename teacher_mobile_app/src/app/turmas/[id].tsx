import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { ClassDetail, Student } from '../../lib/api';
import { useApp } from '../../lib/AppContext';
import { colors, ui } from '../../theme';

/** Class roster: the teacher picks a student to see their tag status (SFR62). */
export default function Turma() {
  const { id, name = 'Turma' } = useLocalSearchParams<{ id: string; name?: string }>();
  const { api } = useApp();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [picked, setPicked] = useState<Student | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.classDetail(Number(id)).then(setDetail, (cause) => setError(cause.message));
  }, [api, id]);

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      {error ? <Text style={[ui.error, { margin: 16 }]}>{error}</Text> : null}
      {!detail && !error ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.accent} /> : null}
      {detail && (
        <FlatList
          style={ui.screen}
          contentContainerStyle={ui.content}
          contentInsetAdjustmentBehavior="automatic"
          data={detail.students}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            picked ? (
              <View style={[ui.card, { backgroundColor: colors.oliveSoft }]}>
                <Text style={ui.h2}>{picked.name}</Text>
                <Text style={ui.text}>Apelido na bancada: {picked.nickname}</Text>
                <Text style={ui.text}>
                  {picked.nfc_code ? `Tag ${picked.nfc_code}: aproxime-a do leitor da bancada.` : 'Sem tag vinculada.'}
                </Text>
                {!picked.active && <Text style={ui.error}>Aluno inativo: não vai para a bancada.</Text>}
              </View>
            ) : (
              <Text style={ui.muted}>Toque em um aluno para ver a tag dele.</Text>
            )
          }
          ListEmptyComponent={<Text style={ui.muted}>Nenhum aluno nesta turma.</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: picked?.id === item.id }}
              onPress={() => setPicked(item)}
              style={[ui.card, picked?.id === item.id && { borderWidth: 2, borderColor: colors.olive }]}
            >
              <Text style={ui.text}>{item.name}</Text>
              <Text style={ui.muted}>
                {item.nickname} · {item.nfc_code ? `tag ${item.nfc_code}` : 'sem tag'}
                {item.active ? '' : ' · inativo'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </>
  );
}
