import { selectIncidentQuestion, type Question } from '../../domain/learning/question';
import {
  RULES_VERSION,
  type Cause,
  type DetectedViolation,
  type History,
  type Violation,
} from '../../domain/world/model';
import type { SessionEnvironment } from '../ports';

interface IncidentContext {
  violations: [DetectedViolation, ...DetectedViolation[]];
  history: History;
  questions: Question[];
  tripId: string;
  attemptId: string;
  mapVersion: string;
  environment: SessionEnvironment;
}

function mergeCauses(violations: DetectedViolation[], existing: Cause[] = []): Cause[] {
  const candidates = [
    ...existing,
    ...violations.flatMap((violation) =>
      violation.causes.map((cause) => ({
        ...cause,
        facts: {
          ...cause.facts,
          roadObjectId: violation.roadObjectId,
          episode: violation.episode,
        },
      })),
    ),
  ];

  const causes: Cause[] = [];

  for (const cause of candidates) {
    const alreadyRecorded = causes.some(
      (recorded) =>
        recorded.code === cause.code &&
        recorded.facts.roadObjectId === cause.facts.roadObjectId &&
        recorded.facts.episode === cause.facts.episode,
    );

    if (!alreadyRecorded) {
      causes.push(cause);
    }
  }

  return causes;
}

export function prepareIncident({
  violations,
  history,
  questions,
  tripId,
  attemptId,
  mapVersion,
  environment,
}: IncidentContext): { entry: Violation; isNew: boolean } {
  const eventKeys = violations.map(
    (violation) => `${violation.type}:${violation.roadObjectId}:${violation.episode}`,
  );

  const existing = history.violations.find(
    (violation) =>
      violation.attemptId === attemptId &&
      violation.eventKeys?.some((key) => eventKeys.includes(key)),
  );

  const incident = { ...violations[0], causes: mergeCauses(violations, existing?.causes) };

  // Later stages of the same episode keep the material selected at its beginning.
  const material = existing
    ? existing.material
    : selectIncidentQuestion(questions, incident, history.answers);

  const entry: Violation = {
    ...incident,
    id: existing?.id ?? environment.id(),
    tripId,
    attemptId,
    date: existing?.date ?? environment.date(),
    mapVersion,
    rulesVersion: RULES_VERSION,
    eventKeys: [...new Set([...(existing?.eventKeys ?? []), ...eventKeys])],
    material: material ? structuredClone(material) : null,
    ...(!material
      ? {
          materialUnavailable:
            'Подходящего материала для сочетания причин нет. Ниже доступны объяснения и ссылки на ПДД.',
        }
      : {}),
  };

  return { entry, isNew: !existing };
}
