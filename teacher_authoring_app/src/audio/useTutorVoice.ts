import { createContext, useContext, useEffect, useState } from 'react';
import type { Lesson } from '../model/types.ts';
import { loadSystemPack, TutorVoice } from './tutorVoice.ts';

export const TutorVoiceContext = createContext<TutorVoice | null>(null);

/** One voice per player: the lesson's own phrases plus the shared system pack. */
export function useTutorVoice(lesson: Lesson): TutorVoice {
  const [voice] = useState(() => new TutorVoice());
  voice.manifests = [lesson.audio, voice.manifests[1]];
  useEffect(() => {
    let active = true;
    loadSystemPack().then((pack) => {
      if (active) voice.manifests = [voice.manifests[0], pack];
    });
    return () => {
      active = false;
      voice.stop();
    };
  }, [voice]);
  return voice;
}

/** Speak `lines` whenever they change (`order` sorts lines said in the same render). */
export function useSay(lines: (string | null | undefined)[], order = 0, enabled = true): void {
  const voice = useContext(TutorVoiceContext);
  const key = lines.join('\n');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the content of `lines`
  useEffect(() => {
    if (voice && enabled) voice.say(lines, order);
  }, [voice, key, order, enabled]);
}
