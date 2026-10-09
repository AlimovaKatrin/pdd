import { stopQuestion } from '../../content/questions/stop';
import { trafficQuestions } from '../../content/questions/traffic';
import { validateQuestion } from '../../domain/learning/question';
import type { LearningContentProvider } from '../../use-cases/ports';

export const localContent: LearningContentProvider = {
  async getCandidates() {
    const questions = [stopQuestion, ...trafficQuestions].map(validateQuestion);

    if (new Set(questions.map((q) => `${q.id}@${q.version}`)).size !== questions.length) {
      throw new Error('Duplicate material');
    }

    for (const q of questions) {
      if (q.image) {
        const response = await fetch(q.image.src);

        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
          throw new Error('Missing image');
        }
      }
    }

    return questions;
  },
};
