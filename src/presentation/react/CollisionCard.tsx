import { useState } from 'react';
import type { Vehicle } from '../../domain/world/vehicles';
import type { GameSession, SessionSnapshot } from '../../use-cases/session/game-session';
import { Modal } from './Modal';
import { IncidentContext } from './IncidentContext';

function movementDescription(vehicle: Vehicle) {
  if (Math.abs(vehicle.speed) < 0.03) {
    return 'стояла';
  }

  const heading = vehicle.heading + (vehicle.speed < 0 ? Math.PI : 0);

  const directions = [
    'на восток',
    'на юго-восток',
    'на юг',
    'на юго-запад',
    'на запад',
    'на северо-запад',
    'на север',
    'на северо-восток',
  ];

  const direction = directions[((Math.round(heading / (Math.PI / 4)) % 8) + 8) % 8];

  return `${direction}, ${(Math.abs(vehicle.speed) * 3.6).toFixed(1)} км/ч`;
}

export function CollisionCard({
  state,
  session,
  act,
}: {
  state: SessionSnapshot;
  session: GameSession;
  act: (action: () => void) => void;
}) {
  const [showViolation, setShowViolation] = useState(false);

  const [causePage, setCausePage] = useState(0);

  const collision = state.collision;

  if (!collision) {
    return null;
  }

  return (
    <Modal title="Столкновение">
      <header className="incident-header">
        <div className="modal-kicker">ГОРОД НА ПАУЗЕ</div>
        <h2>Столкновение</h2>
        <p className="modal-lead">
          Ваша машина и {collision.participantLabel} встретились на дороге.
        </p>
      </header>
      {state.current && (
        <button className="text-button" onClick={() => setShowViolation(!showViolation)}>
          {showViolation ? 'Обстоятельства столкновения' : 'Разбор установленного нарушения'}
        </button>
      )}
      {showViolation && state.current ? (
        <IncidentContext
          current={state.current}
          selectedCause={state.current.causes[causePage]}
          revealed={true}
          causePage={causePage}
          onCausePageChange={setCausePage}
          onReveal={() => {}}
        />
      ) : (
        <section className="incident-context" aria-label="Участники столкновения">
          <p>
            <strong>Ваша машина:</strong> {movementDescription(collision.player)}.
          </p>
          <p>
            <strong>{collision.participantLabel}:</strong> {movementDescription(collision.other)}.
          </p>
          <p>
            {state.current
              ? 'В этом же шаге записано дорожное нарушение. Посмотрите его разбор выше. Сам факт столкновения не определяет виновника.'
              : 'Игра не установила конкретное нарушение. Сам факт столкновения не определяет виновника.'}
          </p>
          <p>Вернитесь на свободный участок своей полосы. Текущая поездка и журнал сохранятся.</p>
        </section>
      )}
      <div className="modal-actions">
        <button className="primary" onClick={() => act(() => session.returnToRoad())}>
          Вернуться на дорогу
        </button>
      </div>
      {state.notice && (
        <p className="source-note" role="status">
          {state.notice}
        </p>
      )}
    </Modal>
  );
}
