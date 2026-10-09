import { stopQuestion } from '../../content/questions/stop';
import type { LearningContentProvider } from '../../use-cases/ports';
export const localContent: LearningContentProvider = {
  async getCandidates() {
    if (
      new Set(stopQuestion.options).size !== stopQuestion.options.length ||
      !stopQuestion.options[stopQuestion.correctIndex]
    ) {
      throw new Error('Некорректный учебный материал');
    }
    return [stopQuestion];
  },
};
