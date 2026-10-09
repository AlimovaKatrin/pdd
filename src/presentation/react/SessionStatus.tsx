import type { SessionSnapshot } from '../../use-cases/session/game-session';

const STORAGE_LABELS: Record<SessionSnapshot['storage'], string> = {
  loading: 'История хранится в этом браузере',
  saved: 'История хранится в этом браузере',
  saving: 'Сохраняем…',
  error: 'История только в памяти',
};

interface SessionStatusProps {
  storage: SessionSnapshot['storage'];
  notice: string;
  advisory?: string;
}

export function SessionStatus({ storage, notice, advisory }: SessionStatusProps) {
  return (
    <>
      <footer className="footer">
        <span>
          <span className={`dot ${storage === 'error' ? 'amber' : ''}`} />
          {STORAGE_LABELS[storage]}
        </span>
        <span>Учебный прототип · ПДД РФ, категория B</span>
      </footer>
      {advisory !== undefined && (
        <p className="notice" role="status">
          {advisory}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
