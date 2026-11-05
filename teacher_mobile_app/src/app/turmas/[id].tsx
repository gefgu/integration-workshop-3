import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import Button from '../../components/Button';
import { Card, Icon, Pill, ProgressBar, Row, StateView } from '../../components/Kit';
import type { ClassDetail } from '../../lib/api';
import { useApp } from '../../lib/AppContext';
import { TourAnchor, useScreenTour } from '../../components/Tour';
import { APP_TOURS } from '../../lib/tours';
import { type ClassDashboard, formatDuration, type StudentProgress } from '../../lib/progress';
import { colors, fonts, ui } from '../../theme';

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** A class: summary, then each student with tag, progress and best score; tap a student for details (SFR62). */
export default function Turma() {
  const router = useRouter();
  const { id, name = 'Turma' } = useLocalSearchParams<{ id: string; name?: string }>();
  const { api } = useApp();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [dashboard, setDashboard] = useState<ClassDashboard | null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const tour = useScreenTour('turma', APP_TOURS.turma);

  const load = useCallback(
    () =>
      api.classDetail(Number(id)).then(
        (next) => {
          setDetail(next);
          setError('');
          // Progress is optional: the roster still works when it cannot be read.
          return api.classDashboard(Number(id)).then(
            (dash) => {
              setDashboard(dash);
              setProgressNote('');
            },
            () => {
              setDashboard(null);
              setProgressNote('O progresso desta turma ainda não está disponível no celular. Veja no painel do site.');
            }
          );
        },
        (cause) => setError((cause as Error).message)
      ),
    [api, id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rows: StudentProgress[] =
    dashboard?.students ??
    (detail?.students ?? []).map((s) => ({
      student: s,
      lessons_done: 0,
      lessons_total: 0,
      progress: 0,
      best_score: null,
      last_score: null,
      challenges: 0,
      time_spent_s: 0,
      last_activity: null,
    }));
  const withoutTag = rows.filter((r) => !r.student.nfc_code).length;

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      {error && !detail ? <StateView icon="cloud-offline-outline" title="Não deu para carregar" text={error} /> : null}
      {!detail && !error ? <StateView loading text="Carregando turma…" /> : null}
      {detail && (
        <FlatList
          style={ui.screen}
          contentContainerStyle={ui.content}
          data={rows}
          keyExtractor={(r) => String(r.student.id)}
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
            <View style={{ gap: 12 }}>
              <TourAnchor id="turma-summary">
              <Card icon="people" title={detail.name}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Stat value={String(rows.length)} label="alunos" />
                  <Stat
                    value={dashboard ? `${Math.round(dashboard.summary.avg_progress * 100)}%` : '—'}
                    label="progresso médio"
                  />
                  <Stat
                    value={dashboard?.summary.avg_best_score != null ? String(Math.round(dashboard.summary.avg_best_score)) : '—'}
                    label="pontuação média"
                  />
                </View>
                {withoutTag > 0 && (
                  <Pill text={`${withoutTag} aluno(s) sem tag: vincule pelo site`} tone="warn" icon="pricetag-outline" />
                )}
              </Card>
              </TourAnchor>
              {progressNote ? <Text style={ui.muted}>{progressNote}</Text> : null}
              <TourAnchor id="turma-send">
                <Button title="Levar aula para esta turma" icon="rocket-outline" onPress={() => router.push('/enviar')} />
              </TourAnchor>
              <Text style={ui.label}>Alunos</Text>
            </View>
          }
          ListEmptyComponent={<StateView icon="person-add-outline" title="Nenhum aluno" text="Cadastre alunos pelo site do professor." />}
          renderItem={({ item, index }) => {
            const s = item.student;
            const expanded = open === s.id;
            const row = (
              <Row
                initial={s.nickname || s.name}
                title={s.name}
                detail={`${s.nickname}${s.active ? '' : ' · inativo'}`}
                selected={expanded}
                onPress={() => setOpen(expanded ? null : s.id)}
                end={
                  s.nfc_code ? (
                    <Pill text={`Tag ${s.nfc_code}`} tone="ok" icon="pricetag" />
                  ) : (
                    <Pill text="Sem tag" icon="pricetag-outline" />
                  )
                }
              >
                {dashboard && (
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={ui.muted}>
                        {item.lessons_done} de {item.lessons_total} lições
                      </Text>
                      {item.best_score != null && (
                        <Text style={[ui.muted, { fontFamily: fonts.bodyBold, color: colors.accentDark }]}>
                          <Icon name="trophy-outline" size={13} color={colors.accentDark} /> {item.best_score} pts
                        </Text>
                      )}
                    </View>
                    <ProgressBar value={item.progress} />
                  </View>
                )}
                {expanded && (
                  <View style={{ gap: 6, paddingTop: 4 }}>
                    <Detail icon="pricetag-outline" text={s.nfc_code ? `Aproxime a tag ${s.nfc_code} do leitor da bancada.` : 'Sem tag vinculada. Vincule pelo site.'} />
                    {dashboard && <Detail icon="time-outline" text={`Tempo na bancada: ${formatDuration(item.time_spent_s)}`} />}
                    {dashboard && item.challenges > 0 && (
                      <Detail icon="flag-outline" text={`${item.challenges} desafio(s) · última pontuação ${item.last_score ?? '—'}`} />
                    )}
                    {item.last_activity && <Detail icon="calendar-outline" text={`Última atividade: ${when(item.last_activity)}`} />}
                    {!s.active && <Text style={ui.error}>Aluno inativo: não vai para a bancada.</Text>}
                  </View>
                )}
              </Row>
            );
            return index === 0 ? <TourAnchor id="turma-student">{row}</TourAnchor> : row;
          }}
        />
      )}
      {tour.overlay}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 10, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: colors.text }}>{value}</Text>
      <Text style={[ui.muted, { textAlign: 'center', fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

function Detail({ icon, text }: { icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={16} color={colors.muted} />
      <Text style={[ui.text, { flex: 1, fontSize: 14 }]}>{text}</Text>
    </View>
  );
}
