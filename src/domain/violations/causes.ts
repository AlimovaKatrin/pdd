import type { CauseCode, RuleType } from '../learning/question';
import type { Cause } from '../world/model';

const descriptions: Record<CauseCode, [RuleType, string, string, string]> = {
  'stop-line': [
    'stop',
    'Проезд без остановки',
    'Перед стоп-линией нужна полная остановка. Движение с малой скоростью её не заменяет.',
    'Приложение 1 · знак 2.5',
  ],
  'speed-limit': [
    'speed',
    'Превышение скорости',
    'Соблюдайте действующий знак ограничения. Отсутствие штрафа за небольшое превышение не разрешает превышать лимит.',
    'Приложение 1 · знак 3.24; п. 10.1',
  ],
  'red-signal': [
    'signal',
    'Проезд на запрещающий сигнал',
    'При красном или красном с жёлтым нужно остановиться перед стоп-линией. Учитывается сигнал в момент пересечения.',
    'Пункты 6.2, 6.13',
  ],
  'missing-indicator': [
    'indicator',
    'Поворот без сигнала',
    'Перед поворотом подайте сигнал нужного направления и сохраняйте его до окончания манёвра.',
    'Пункты 8.1, 8.2',
  ],
  'wrong-indicator': [
    'indicator',
    'Неверное направление сигнала',
    'Указатель должен соответствовать фактическому направлению поворота. Он не даёт преимущества.',
    'Пункты 8.1, 8.2',
  ],
  'late-indicator': [
    'indicator',
    'Позднее включение сигнала',
    'Подавайте сигнал до начала манёвра. Фиксированное число секунд заблаговременности правилами не задано.',
    'Пункт 8.2',
  ],
  'early-indicator-off': [
    'indicator',
    'Сигнал выключен до конца поворота',
    'Прекращайте подачу сигнала после завершения манёвра, а не во время поворота.',
    'Пункт 8.2',
  ],
  'pedestrian-obstruction': [
    'pedestrian',
    'Помеха пешеходу на переходе',
    'Уступите пешеходу, имеющему преимущество: движение автомобиля не должно вынуждать его изменять скорость или направление.',
    'Пункты 1.2, 14.1',
  ],
};

export function cause(code: CauseCode, facts: Cause['facts']): Cause {
  const [rule, title, explanation, reference] = descriptions[code];

  const links: Record<RuleType, string> = {
    stop: 'f813c443e749db7b760a9fb7729a4e4ccdb2f3ea',
    speed: 'bf1f4781b8aa1172e9993c89c36db0dcdc88c495',
    signal: '4b7a10a56ed37080fc96999db5f3db6f3aa58cc6',
    indicator: '2fdfa8559de67744dab415a31c1f987bc016016b',
    pedestrian: '7c45508e360f5b7b8ae1443d73feb01f52a6199d',
  };

  return {
    code,
    rule,
    title,
    explanation,
    reference,
    referenceUrl: `https://www.consultant.ru/document/cons_doc_LAW_2709/${links[rule]}/`,
    facts,
  };
}
