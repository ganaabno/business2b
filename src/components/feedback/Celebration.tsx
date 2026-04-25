import { useEffect, useRef, type ReactNode } from "react";
import confetti from "canvas-confetti";

interface CelebrationProps {
  trigger: boolean;
  type?: "success" | "stars" | "fireworks";
  onComplete?: () => void;
}

const patterns = {
  success: {
    particleCount: 50,
    spread: 70,
    origin: { y: 0.6 },
  },
  stars: {
    particleCount: 100,
    spread: 100,
    origin: { y: 0.6 },
  },
  fireworks: {
    particleCount: 150,
    spread: 120,
    origin: { y: 0.5 },
  },
};

export function Celebration({ trigger, type = "success", onComplete }: CelebrationProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (trigger && !hasFired.current) {
      hasFired.current = true;

      const config = patterns[type];

      if (type === "fireworks") {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            onComplete?.();
            return;
          }

          const particleCount = config.particleCount * (timeLeft / duration);

          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          });
        }, 250);
      } else {
        confetti({
          ...config,
          colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
          disableForReducedMotion: true,
        });
        setTimeout(() => onComplete?.(), 1000);
      }
    }

    if (!trigger) {
      hasFired.current = false;
    }
  }, [trigger, type, onComplete]);

  return null;
}

export function fireCelebration(type: "success" | "stars" | "fireworks" = "success") {
  const config = patterns[type];
  confetti({
    ...config,
    colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
    disableForReducedMotion: true,
  });
}
