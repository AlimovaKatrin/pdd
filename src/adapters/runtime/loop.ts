import { STEP } from '../../domain/simulation/step';
import type { GameSession } from '../../use-cases/session/game-session';
export function startRuntime(session: GameSession) {
  let frame = 0,
    last = 0,
    accumulator = 0;
  const loop = (now: number) => {
    if (session.isRunning() && last) {
      accumulator += Math.min((now - last) / 1000, 0.1);
      for (let steps = 0; accumulator >= STEP && steps < 6; steps++) {
        session.step();
        accumulator -= STEP;
        if (!session.isRunning()) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    last = now;
    frame = requestAnimationFrame(loop);
  };
  const blur = () => {
    accumulator = 0;
    last = 0;
    session.pause('blur');
  };
  const visibility = () => {
    if (document.hidden) {
      blur();
    }
  };
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  frame = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('blur', blur);
    document.removeEventListener('visibilitychange', visibility);
  };
}
