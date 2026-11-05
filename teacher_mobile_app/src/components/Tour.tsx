/**
 * Guided tour for the phone app: dims the screen, cuts a spotlight around each highlighted view and explains it in a
 * card with Pular / Voltar / Próximo. Screens register views with useTourTarget(id); a tour opens once on the first
 * visit (AsyncStorage) and again from the ? button in the header.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts, ui } from '../theme';
import Button from './Button';

export interface TourStep {
  /** a target registered with useTourTarget; omitted = centred card */
  target?: string;
  title: string;
  text: string;
}

type Box = { x: number; y: number; w: number; h: number };
/** What a native view ref offers for measuring (RN host element). */
type Measurable = { measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) => void };
const targets = new Map<string, Measurable>();

/** Attach the returned ref to the View the tour should highlight. */
export function useTourTarget(id: string) {
  return useCallback(
    (view: Measurable | null) => {
      if (view) targets.set(id, view);
      else targets.delete(id);
    },
    [id]
  );
}

function measure(id: string | undefined): Promise<Box | null> {
  const view = id ? targets.get(id) : undefined;
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) =>
    view.measureInWindow((x: number, y: number, w: number, h: number) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null))
  );
}

/** A screen's tour: opens on the first visit, puts a ? in the header, and renders the overlay. */
export function useScreenTour(key: string, steps: TourStep[]) {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const storageKey = `tedtronics.tour.${key}`;

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(storageKey).then((seen) => {
      if (!seen && alive) setTimeout(() => alive && setOpen(true), 700);
    });
    return () => {
      alive = false;
    };
  }, [storageKey]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HelpButton onPress={() => setOpen(true)} /> });
  }, [navigation]);

  const close = useCallback(() => {
    setOpen(false);
    void AsyncStorage.setItem(storageKey, '1');
  }, [storageKey]);

  return {
    start: () => setOpen(true),
    overlay: open ? <TourOverlay steps={steps} onClose={close} /> : null,
  };
}

export function HelpButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajuda: tutorial desta tela"
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        marginHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ fontFamily: fonts.heading, fontSize: 18, color: colors.text }}>?</Text>
    </Pressable>
  );
}

const PAD = 8;
const DIM = 'rgba(20,16,12,0.66)';

export function TourOverlay({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const { height: vh } = useWindowDimensions();
  const [usable, setUsable] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(200);
  const alive = useRef(true);

  // Leave out steps whose view is not on this screen.
  useEffect(() => {
    alive.current = true;
    Promise.all(steps.map((s) => (s.target ? measure(s.target) : Promise.resolve({} as Box)))).then((boxes) => {
      if (alive.current) setUsable(steps.filter((_, i) => boxes[i]));
    });
    return () => {
      alive.current = false;
    };
  }, [steps]);

  const step = usable?.[index];
  useEffect(() => {
    if (!step) return;
    void measure(step.target).then((b) => alive.current && setBox(b));
  }, [step]);

  if (!usable || !step) return null;
  const last = index === usable.length - 1;
  const spot = box && step.target ? { x: box.x - PAD, y: box.y - PAD, w: box.w + PAD * 2, h: box.h + PAD * 2 } : null;
  const cardTop = !spot
    ? (vh - cardH) / 2
    : spot.y + spot.h + 12 + cardH < vh - 16
      ? spot.y + spot.h + 12
      : Math.max(16, spot.y - 12 - cardH);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {spot ? (
          <>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, spot.y), backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: spot.y + spot.h, bottom: 0, backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: 0, width: Math.max(0, spot.x), top: spot.y, height: spot.h, backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: spot.x + spot.w, right: 0, top: spot.y, height: spot.h, backgroundColor: DIM }} />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: spot.x,
                top: spot.y,
                width: spot.w,
                height: spot.h,
                borderRadius: 18,
                borderWidth: 3,
                borderColor: colors.accent,
              }}
            />
          </>
        ) : (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: DIM }} />
        )}
        <View
          onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: cardTop,
            backgroundColor: colors.white,
            borderRadius: 22,
            padding: 18,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {usable.map((s, i) => (
              <View
                key={`${s.title}-${i}`}
                style={{
                  height: 8,
                  width: i === index ? 22 : 8,
                  borderRadius: 4,
                  backgroundColor: i === index ? colors.accent : i < index ? colors.accentSoft : colors.surface,
                }}
              />
            ))}
          </View>
          <Text style={[ui.h2, { fontSize: 20 }]}>{step.title}</Text>
          <Text style={[ui.text, { lineHeight: 21 }]}>{step.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={[ui.muted, { textDecorationLine: 'underline' }]}>{last ? 'Fechar' : 'Pular tutorial'}</Text>
            </Pressable>
            <Text style={[ui.muted, { marginLeft: 'auto' }]}>
              {index + 1}/{usable.length}
            </Text>
            {index > 0 && (
              <View style={{ minWidth: 96 }}>
                <Button title="Voltar" variant="outline" onPress={() => setIndex(index - 1)} />
              </View>
            )}
            <View style={{ minWidth: 110 }}>
              <Button title={last ? 'Concluir' : 'Próximo'} onPress={() => (last ? onClose() : setIndex(index + 1))} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Wraps a view so a tour can highlight it. */
export function TourAnchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/suspicious/noExplicitAny: RN host refs are measurable views
    <View ref={useTourTarget(id) as any} collapsable={false}>
      {children}
    </View>
  );
}
