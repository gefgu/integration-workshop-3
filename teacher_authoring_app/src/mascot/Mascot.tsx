import { useEffect, useRef, useState } from 'react';
import { useSpeaking } from '../audio/useTutorVoice.ts';
import foxIdle from '../assets/mascots/fox-idle.png';
import foxTalking from '../assets/mascots/fox-talking.png';

const SPRITES = {
  fox: { idle: foxIdle, talking: foxTalking },
};

/**
 * Animates between idle/talking sprites. Inside a lesson player with audio, the mouth moves
 * exactly while the tutor's voice plays; otherwise for a time that scales with the message
 * length whenever `message` changes (~45ms/char, clamped 900-4200ms).
 */
export default function Mascot({ kind, message, size = 44 }) {
  const { voice, speaking } = useSpeaking();
  const voiced = !!voice && (speaking || voice.hasAudio(message || ''));
  const [talkFrame, setTalkFrame] = useState(false);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!voiced || !speaking) return undefined;
    const t = setInterval(() => setTalkFrame((f) => !f), 220);
    return () => {
      clearInterval(t);
      setTalkFrame(false);
    };
  }, [voiced, speaking]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (voiced) return undefined;
    const duration = Math.min(4200, Math.max(900, (message || '').length * 45));
    intervalRef.current = setInterval(() => setTalkFrame((f) => !f), 220);
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setTalkFrame(false);
    }, duration);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [message, voiced]);

  const sprite = SPRITES[kind] || SPRITES.fox;
  const src = talkFrame ? sprite.talking : sprite.idle;

  return <img className="mascot-img" src={src} width={size} height={size} alt="Mascote tutor" />;
}
