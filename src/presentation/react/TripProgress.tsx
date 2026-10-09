import { ArrowRight, Flag } from 'lucide-react';

interface TripProgressProps {
  successfulManeuvers: number;
  violationCount: number;
  onOpenJournal: () => void;
}

export function TripProgress({
  successfulManeuvers,
  violationCount,
  onOpenJournal,
}: TripProgressProps) {
  return (
    <section className="progress-card">
      <div>
        <span className="progress-icon">
          <Flag size={19} />
        </span>
        <h3>Опыт этой поездки</h3>
      </div>
      <div className="stat-row">
        <span>Правильных манёвров</span>
        <strong>{successfulManeuvers}</strong>
      </div>
      <div className="stat-row">
        <span>Ситуаций в журнале</span>
        <strong>{violationCount}</strong>
      </div>
      <button className="text-button" onClick={onOpenJournal}>
        Открыть журнал <ArrowRight size={15} />
      </button>
    </section>
  );
}
