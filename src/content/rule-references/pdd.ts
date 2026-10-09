import type { RuleType } from '../../domain/learning/question';

export const references: Record<RuleType, { label: string; url: string; verification: string }> =
  Object.fromEntries(
    [
      ['stop', 'Знак 2.5', 'f813c443e749db7b760a9fb7729a4e4ccdb2f3ea'],
      ['speed', 'Знак 3.24', 'bf1f4781b8aa1172e9993c89c36db0dcdc88c495'],
      ['signal', 'Пункты 6.2, 6.13, 6.14', '4b7a10a56ed37080fc96999db5f3db6f3aa58cc6'],
      ['indicator', 'Пункты 8.1, 8.2', '2fdfa8559de67744dab415a31c1f987bc016016b'],
      ['pedestrian', 'Пункт 14.1', '7c45508e360f5b7b8ae1443d73feb01f52a6199d'],
    ].map(([rule, label, id]) => [
      rule,
      {
        label: `ПДД РФ · ${label}`,
        url: `https://www.consultant.ru/document/cons_doc_LAW_2709/${id}/`,
        verification: 'КонсультантПлюс · проверено 09.10.2026. Объяснение авторское.',
      },
    ]),
  ) as Record<RuleType, { label: string; url: string; verification: string }>;
