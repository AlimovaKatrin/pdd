import { useState } from 'react';
import { CircleDot, CornerUpRight, Footprints, Gauge, MapPin, Octagon } from 'lucide-react';

const TOPICS = [
  {
    label: 'STOP',
    icon: Octagon,
    title: 'Остановка перед STOP',
    location: 'Центральная улица · прямо от старта',
    hint: 'Полностью остановитесь перед белой линией. Убедитесь, что путь свободен, и продолжайте.',
  },
  {
    label: 'Скорость',
    icon: Gauge,
    title: 'Не быстрее 30 км/ч',
    location: 'Верхняя улица · движение вправо',
    hint: 'До знака снизьте скорость до 30 км/ч. После ближайшего перекрёстка снова действует городской лимит 60 км/ч. Текущий лимит виден под картой.',
  },
  {
    label: 'Светофор',
    icon: CircleDot,
    title: 'Дождитесь зелёного',
    location: 'Правая улица · движение вверх',
    hint: 'На красный и красный с жёлтым остановитесь перед линией. Начинайте движение на зелёный.',
  },
  {
    label: 'Поворот',
    icon: CornerUpRight,
    title: 'Покажите направление',
    location: 'На любом перекрёстке квартала',
    hint: 'До поворота включите указатель: Q — влево, E — вправо. Он выключится после завершения манёвра.',
  },
  {
    label: 'Пешеход',
    icon: Footprints,
    title: 'Уступите пешеходу',
    location: 'Левая улица · переход в нижней части',
    hint: 'Снизьте скорость перед переходом. Пропустите пешехода, не вынуждая его останавливаться из-за машины.',
  },
];

export function CityGuide({ expanded = false }: { expanded?: boolean }) {
  const [selected, setSelected] = useState(0);

  const topic = TOPICS[selected];

  const expandedLocations = [
    'Главная улица: STOP на южных подходах',
    'Северная улица между садом и мастерскими, на восток',
    'Центральный перекрёсток, к северу от старта',
    'На любом перекрёстке города',
    'Западная улица, рядом с парком',
  ];

  return (
    <section className="lesson-card" aria-labelledby="city-guide-title">
      <div className="eyebrow" id="city-guide-title">
        <span className="small-line" />
        ЗНАКОМИМСЯ С ГОРОДОМ
      </div>
      <div className="guide-topics" role="group" aria-label="Дорожные ситуации">
        {TOPICS.map(({ label, icon: Icon }, index) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={selected === index}
            aria-controls="city-guide-content"
            onClick={() => setSelected(index)}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="guide-content" id="city-guide-content" aria-live="polite" aria-atomic="true">
        <h2>{topic.title}</h2>
        <p className="guide-location">
          <MapPin size={14} aria-hidden="true" />
          {expanded ? expandedLocations[selected] : topic.location}
        </p>
        <p className="guide-hint">{topic.hint}</p>
      </div>
      <div className="guide-footer">
        <span>Любой маршрут, в своём темпе</span>
        <span aria-label={`Ситуация ${selected + 1} из ${TOPICS.length}`}>
          {String(selected + 1).padStart(2, '0')} / 05
        </span>
      </div>
    </section>
  );
}
