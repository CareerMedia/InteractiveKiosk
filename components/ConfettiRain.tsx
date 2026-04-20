import { useMemo } from 'react';

interface ConfettiPiece {
  id: number;
  left: string;
  delay: string;
  duration: string;
  rotation: string;
  scale: string;
  color: string;
}

const COLORS = ['#d22030', '#ff7355', '#ffffff', '#f5c9cd', '#ffb38a'];

export function ConfettiRain() {
  const pieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: 56 }, (_, index) => ({
      id: index,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.2}s`,
      duration: `${4 + Math.random() * 4}s`,
      rotation: `${Math.random() * 360}deg`,
      scale: `${0.65 + Math.random() * 0.85}`,
      color: COLORS[index % COLORS.length],
    }));
  }, []);

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            transform: `rotate(${piece.rotation}) scale(${piece.scale})`,
            background: piece.color,
          }}
        />
      ))}
    </div>
  );
}
