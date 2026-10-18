import { emptyControls } from '../../domain/world/model';
import type { GameSession } from '../../use-cases/session/game-session';

export function bindKeyboard(session: GameSession) {
  const held = new Set<string>();

  // A driving key may be released after focus has moved into a newly opened dialog.
  const captured = new Set<string>();

  const update = () =>
    session.setControls({
      throttle: held.has('KeyW') || held.has('ArrowUp'),
      reverse: held.has('KeyS') || held.has('ArrowDown'),
      brake: held.has('Space'),
      steer:
        Number(held.has('KeyD') || held.has('ArrowRight')) -
        Number(held.has('KeyA') || held.has('ArrowLeft')),
    });

  const controls = [
    'KeyW',
    'KeyS',
    'KeyA',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Space',
    'KeyQ',
    'KeyE',
  ];

  const keydown = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input, textarea, select, button, a, summary, [role="dialog"]')
    ) {
      return;
    }

    if (event.code === 'Escape' && session.getSnapshot().started) {
      if (session.isRunning()) {
        session.pause('manual');
      } else {
        session.resume();
      }

      return;
    }

    if (!session.isRunning() || !controls.includes(event.code)) {
      return;
    }

    event.preventDefault();
    held.add(event.code);
    captured.add(event.code);

    if (!event.repeat && event.code === 'KeyQ') {
      session.toggleIndicator('left');
    }

    if (!event.repeat && event.code === 'KeyE') {
      session.toggleIndicator('right');
    }

    update();
  };

  const keyup = (event: KeyboardEvent) => {
    if (captured.delete(event.code)) {
      event.preventDefault();
    }

    held.delete(event.code);
    update();
  };

  const unsubscribe = session.subscribe(() => {
    if (!session.isRunning()) {
      held.clear();
      session.setControls(emptyControls());
    }
  });

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  return () => {
    unsubscribe();
    held.clear();
    captured.clear();
    session.clearInput();
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
  };
}
