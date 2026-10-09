import type { History } from '../../domain/world/model';
import type { Question } from '../../domain/learning/question';
export interface HistoryRepository {
  load(): Promise<History>;
  save(history: History): Promise<void>;
}
export interface LearningContentProvider {
  getCandidates(): Promise<Question[]>;
}
export interface SessionEnvironment {
  id(): string;
  date(): string;
}
