import type { Question } from '../../domain/learning/question';

export const stopQuestion: Question = {
  id: 'demo-stop-line',
  version: 'demo-2',
  matches: ['stop-line'],
  context: 'same',
  status: 'demo',
  rule: 'stop',
  title: 'Перед вами знак STOP и стоп-линия. Где нужно остановиться?',
  options: [
    'Перед стоп-линией, даже если дорога свободна',
    'После стоп-линии, если никого нет',
    'Можно проехать медленно, не останавливаясь',
  ],
  correctIndex: 0,
  explanation:
    'Перед стоп-линией нужно полностью остановиться. Медленное движение не заменяет остановку. В этой ситуации не требуется ждать заданное число секунд. Затем можно продолжить движение, убедившись в безопасности.',
  reference: {
    label: 'ПДД РФ · Приложение 1 · Знак 2.5',
    url: 'https://www.consultant.ru/document/cons_doc_LAW_2709/f813c443e749db7b760a9fb7729a4e4ccdb2f3ea/',
    verification:
      'Авторский вопрос. ПДД сверены по КонсультантПлюс 09.10.2026; не официальный билет.',
  },
};
