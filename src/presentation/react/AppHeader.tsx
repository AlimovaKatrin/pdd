import { BookOpen, Compass, Route } from 'lucide-react';

interface AppHeaderProps {
  journalOpen: boolean;
  violationCount: number;
  onShowTrip: () => void;
  onOpenJournal: () => void;
}

export function AppHeader({
  journalOpen,
  violationCount,
  onShowTrip,
  onOpenJournal,
}: AppHeaderProps) {
  return (
    <header className="header">
      <a className="brand" href="#road" aria-label="Тихий город — к игровому полю">
        <span className="brand-icon">
          <Route size={23} />
        </span>
        <span>
          тихий город<span className="brand-sub">УЧИМСЯ ЗА РУЛЁМ</span>
        </span>
      </a>
      <nav aria-label="Основная навигация">
        <button className={!journalOpen ? 'nav-button active' : 'nav-button'} onClick={onShowTrip}>
          <Compass size={17} />
          Поездка
        </button>
        <button
          className={journalOpen ? 'nav-button active' : 'nav-button'}
          onClick={onOpenJournal}
        >
          <BookOpen size={17} />
          Журнал
          {violationCount > 0 && <span className="count">{violationCount}</span>}
        </button>
      </nav>
      <span className="prototype">
        <span />
        MVP · предпросмотр
      </span>
    </header>
  );
}
