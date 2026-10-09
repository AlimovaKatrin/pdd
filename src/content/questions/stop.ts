import type { Question } from '../../domain/learning/question';
export const stopQuestion: Question = {
  id: 'demo-stop-line',
  version: 'demo-1',
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
    url: 'https://www.consultant.ru/document/cons_doc_LAW_2709/',
    verification: 'Авторский учебный пример. Актуальная редакция источника ещё не сверена.',
  },
};
