import { useState } from 'react';
import {
  ArrowRightLeft,
  CircleDot,
  CornerUpLeft,
  CornerUpRight,
  Diamond,
  Footprints,
  Gauge,
  GitMerge,
  MapPin,
  Octagon,
  Route,
  type LucideIcon,
} from 'lucide-react';

interface GuideTopic {
  label: string;
  icon: LucideIcon;
  title: string;
  location: string;
  hint: string;
  cityLocation?: string;
  cityHint?: string;
  cityTitle?: string;
}

const TOPICS: GuideTopic[] = [
  {
    label: 'STOP',
    icon: Octagon,
    title: 'Остановка перед STOP',
    location: 'Центральная улица · прямо от старта',
    cityLocation: 'Главная улица: STOP на южных подходах',
    hint: 'Полностью остановитесь перед белой линией. Убедитесь, что путь свободен, и продолжайте.',
  },
  {
    label: 'Скорость',
    icon: Gauge,
    title: 'Не быстрее 30 км/ч',
    location: 'Верхняя улица · движение вправо',
    cityTitle: 'Соблюдайте ограничение',
    cityLocation: 'Северная улица · вдоль сада на восток',
    cityHint:
      'На обычных улицах — до 60 км/ч, в зоне знака — до 30 км/ч. Снизьте скорость до знака. Текущий лимит всегда виден под картой.',
    hint: 'До знака снизьте скорость до 30 км/ч. После ближайшего перекрёстка снова действует городской лимит 60 км/ч. Текущий лимит виден под картой.',
  },
  {
    label: 'Светофор',
    icon: CircleDot,
    title: 'Дождитесь зелёного',
    location: 'Правая улица · движение вверх',
    cityLocation: 'Центральный перекрёсток · к северу от старта',
    hint: 'На красный и красный с жёлтым остановитесь перед линией. Начинайте движение на зелёный.',
  },
  {
    label: 'Поворот',
    icon: CornerUpRight,
    title: 'Покажите направление',
    location: 'На любом перекрёстке квартала',
    cityLocation: 'На любом перекрёстке города',
    cityHint:
      'Заранее включите указатель в сторону поворота: Q — влево, E — вправо. Не выключайте его до конца манёвра. После поворота он погаснет сам.',
    hint: 'До поворота включите указатель: Q — влево, E — вправо. Он выключится после завершения манёвра.',
  },
  {
    label: 'Пешеход',
    icon: Footprints,
    title: 'Уступите пешеходу',
    location: 'Левая улица · переход в нижней части',
    cityLocation: 'Переход у парка и южная сторона центра',
    cityHint:
      'Уступите на нерегулируемом переходе. При повороте пропустите пешеходов на дороге, в которую въезжаете. Не вынуждайте их менять скорость или направление.',
    hint: 'Снизьте скорость перед переходом. Пропустите пешехода, не вынуждая его останавливаться из-за машины.',
  },
];

const CITY_TOPICS: GuideTopic[] = [
  ...TOPICS,
  {
    label: 'Встречная полоса',
    icon: ArrowRightLeft,
    title: 'Оставайтесь на своей полосе',
    location: 'Двусторонние улицы между перекрёстками',
    hint: 'Не пересекайте двойную сплошную и не двигайтесь по встречной полосе. После поворота выезжайте на свою сторону дороги.',
  },
  {
    label: 'Левый поворот',
    icon: CornerUpLeft,
    title: 'Пропустите встречных',
    location: 'Светофор или равнозначные дороги',
    hint: 'Поворачивая налево на зелёный или на равнозначной дороге, уступите встречным машинам, которые едут прямо или направо.',
  },
  {
    label: 'Главная дорога',
    icon: Diamond,
    title: 'Уступите главной дороге',
    location: 'Перекрёстки со знаками приоритета',
    hint: 'Со второстепенной дороги уступите машинам на главной независимо от их направления. Остановка перед STOP не даёт преимущества.',
  },
  {
    label: 'Помеха справа',
    icon: GitMerge,
    title: 'Пропустите машину справа',
    location: 'Восточная улица · равнозначные перекрёстки',
    hint: 'На равнозначных дорогах уступите машине справа. Это правило действует и между двумя второстепенными подходами после уступания главной.',
  },
  {
    label: 'Завершение проезда',
    icon: Route,
    title: 'Дайте закончить движение',
    location: 'Центральный перекрёсток со светофором',
    hint: 'На новый зелёный пропустите завершающие проезд машины и переходящих дорогу пешеходов. Если въехали на зелёный, завершите проезд при смене сигнала.',
  },
];

export function CityGuide({ expanded = false }: { expanded?: boolean }) {
  const [selected, setSelected] = useState(0);

  const topics = expanded ? CITY_TOPICS : TOPICS;

  const topic = topics[selected];

  const counter = (
    <span className="guide-count" aria-label={`Ситуация ${selected + 1} из ${topics.length}`}>
      {String(selected + 1).padStart(2, '0')} / {String(topics.length).padStart(2, '0')}
    </span>
  );

  return (
    <section
      className={`lesson-card${expanded ? ' city-guide-expanded' : ''}`}
      aria-labelledby="city-guide-title"
    >
      <div className="guide-heading">
        <div className="eyebrow" id="city-guide-title">
          <span className="small-line" />
          ЗНАКОМИМСЯ С ГОРОДОМ
        </div>
        {expanded && counter}
      </div>
      <div className="guide-topics" role="group" aria-label="Дорожные ситуации">
        {topics.map(({ label, icon: Icon }, index) => (
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
        <h2>{(expanded && topic.cityTitle) || topic.title}</h2>
        <p className="guide-location">
          <MapPin size={14} aria-hidden="true" />
          {(expanded && topic.cityLocation) || topic.location}
        </p>
        <p className="guide-hint">{(expanded && topic.cityHint) || topic.hint}</p>
      </div>
      {!expanded && (
        <div className="guide-footer">
          <span>Любой маршрут, в своём темпе</span>
          {counter}
        </div>
      )}
    </section>
  );
}
