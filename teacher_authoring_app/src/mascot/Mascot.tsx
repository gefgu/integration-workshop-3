import { useEffect, useRef, useState } from 'react';
import foxIdle from '../assets/mascots/fox-idle.png';
import foxTalking from '../assets/mascots/fox-talking.png';

const SPRITES = {
  fox: { idle: foxIdle, talking: foxTalking },
};

/**
 * Animates between idle/talking sprites whenever `message` changes.
 * Talk duration scales with message length (~45ms/char, clamped 900-4200ms).
 */
export default function Mascot({ kind, message, size = 44 }) {
  const [talkFrame, setTalkFrame] = useState(false);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
  }, [message]);

  const sprite = SPRITES[kind] || SPRITES.fox;
  const src = talkFrame ? sprite.talking : sprite.idle;

  return <img className="mascot-img" src={src} width={size} height={size} alt="Mascote tutor" />;
}
