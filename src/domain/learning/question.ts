export interface Question {
  id: string;
  version: string;
  status: 'demo';
  rule: 'stop';
  title: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  reference: { label: string; url: string; verification: string };
}
export function selectQuestion(questions: Question[], rule: 'stop'): Question | undefined {
  return questions.find((q) => q.rule === rule);
}
export function evaluateAnswer(question: Question, answer: number) {
  if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
    throw new Error('Invalid answer');
  }
  return answer === question.correctIndex;
}
