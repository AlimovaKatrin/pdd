import { ChevronDown } from 'lucide-react';

export function DrivingHelp() {
  return (
    <details className="controls-card">
      <summary className="section-heading controls-toggle">
        <h3>Всё под рукой</h3>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="controls-content">
        <div className="control-row">
          <span>
            <kbd>W</kbd>
            <kbd>↑</kbd>
          </span>
          <span>Разгон</span>
        </div>
        <div className="control-row">
          <span>
            <kbd>S</kbd>
            <kbd>↓</kbd>
          </span>
          <span>Тормоз / задний ход</span>
        </div>
        <div className="control-row">
          <span>
            <kbd>A</kbd>
            <kbd>D</kbd>
            <span className="key-or">/</span>
            <kbd>←</kbd>
            <kbd>→</kbd>
          </span>
          <span>Поворот</span>
        </div>
        <div className="control-row">
          <kbd className="space-key">Пробел</kbd>
          <span>Полная остановка</span>
        </div>
        <div className="control-row">
          <span>
            <kbd>Q</kbd>
            <kbd>E</kbd>
          </span>
          <span>Поворотники</span>
        </div>
        <div className="control-footer">
          <kbd>Esc</kbd>
          <span>Пауза</span>
        </div>
      </div>
    </details>
  );
}
