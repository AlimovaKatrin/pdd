import { validateMap } from '../../domain/world/validate-map';
import {
  evaluateAnswer,
  selectIncidentQuestion,
  type Question,
} from '../../domain/learning/question';
import { STEP, stepWorld } from '../../domain/simulation/step';
import {
  type Trip,
  emptyControls,
  emptyHistory,
  initialWorld,
  RULES_VERSION,
  type AnswerAttempt,
  type Controls,
  type History,
  type Indicator,
  type RoadMap,
  type Violation,
  type World,
} from '../../domain/world/model';
import type { HistoryRepository, LearningContentProvider, SessionEnvironment } from '../ports';
export type PauseReason = 'manual' | 'blur' | 'incident' | 'journal';
export interface SessionSnapshot {
  completedTripId: string | null;
  activeTripId: string | null;
  ready: boolean;
  started: boolean;
  world: World;
  pauses: PauseReason[];
  history: History;
  current: Violation | null;
  question?: Question;
  answer: AnswerAttempt | null;
  revealed: boolean;
  journal: boolean;
  storage: 'loading' | 'saved' | 'saving' | 'error';
  notice: string;
}
export class GameSession {
  private world: World;
  private controls = emptyControls();
  private pauses = new Set<PauseReason>();
  private history = emptyHistory();
  private started = false;
  private ready = false;
  private current: Violation | null = null;
  private answer: AnswerAttempt | null = null;
  private storage: SessionSnapshot['storage'] = 'loading';
  private notice = '';
  private loaded = false;
  private tripId = '';
  private attemptId = '';
  private snapshots: World[] = [];
  private checkpoints = new Map<string, World>();
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private pendingWrites = 0;
  private snapshot!: SessionSnapshot;
  private question?: Question;
  private questions: Question[] = [];
  private completedTripId: string | null = null;
  constructor(
    readonly map: RoadMap,
    private repository: HistoryRepository,
    private content: LearningContentProvider,
    private environment: SessionEnvironment,
  ) {
    this.world = initialWorld(validateMap(map));
    this.publish();
  }
  async initialize() {
    const [history, content] = await Promise.allSettled([
      this.repository.load(),
      this.content.getCandidates(),
    ]);
    if (history.status === 'fulfilled') {
      this.history = {
        ...history.value,
        trips: history.value.trips.map((t) =>
          t.status === 'active' ? { ...t, status: 'interrupted' as const } : t,
        ),
      };
      this.loaded = true;
      this.storage = 'saved';
    } else {
      this.storage = 'error';
      this.notice =
        'Не удалось прочитать историю. Поездка доступна, новые результаты останутся в памяти.';
    }
    if (content.status === 'fulfilled') {
      this.questions = content.value;
    } else {
      this.notice += ' Учебный вопрос не загрузился. Доступны объяснение и продолжение поездки.';
    }
    this.ready = true;
    this.publish();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  getWorld = () => this.world;
  isRunning = () => this.started && this.pauses.size === 0;
  private publish() {
    this.question = this.current?.material ?? undefined;
    this.snapshot = {
      completedTripId: this.completedTripId,
      activeTripId: this.started ? this.tripId : null,
      ready: this.ready,
      started: this.started,
      world: this.world,
      pauses: [...this.pauses],
      history: this.history,
      current: this.current,
      question: this.question,
      answer: this.answer,
      revealed: !!this.current && this.history.revealed.includes(this.current.id),
      journal: this.pauses.has('journal'),
      storage: this.storage,
      notice: this.notice,
    };
    this.listeners.forEach((l) => l());
  }
  start() {
    if (!this.ready) {
      return;
    }
    if (this.started) {
      this.endTrip('restarted');
    }
    this.completedTripId = null;
    this.world = initialWorld(this.map);
    this.controls = emptyControls();
    this.tripId = this.environment.id();
    this.attemptId = this.environment.id();
    this.snapshots = [structuredClone(this.world)];
    this.current = null;
    this.answer = null;
    this.pauses.clear();
    this.started = true;
    this.history = {
      ...this.history,
      trips: [
        ...this.history.trips,
        { id: this.tripId, startedAt: this.environment.date(), status: 'active' },
      ],
    };
    this.persist();
    this.publish();
  }
  setControls(controls: Controls) {
    this.controls = this.isRunning() ? { ...controls } : emptyControls();
  }
  clearInput() {
    this.controls = emptyControls();
  }
  toggleIndicator(side: Exclude<Indicator, null>) {
    if (!this.isRunning()) {
      return;
    }
    this.world = {
      ...this.world,
      vehicle: {
        ...this.world.vehicle,
        indicator: this.world.vehicle.indicator === side ? null : side,
        indicatorTurn: 0,
      },
    };
    this.publish();
  }
  pause(reason: PauseReason) {
    if (!this.started) {
      return;
    }
    this.pauses.add(reason);
    this.clearInput();
    this.publish();
  }
  resume() {
    this.pauses.delete('manual');
    this.pauses.delete('blur');
    this.clearInput();
    this.publish();
  }
  step() {
    if (!this.isRunning()) {
      return;
    }
    const result = stepWorld(this.world, this.controls, this.map);
    this.world = result.world;
    if (this.world.tick % 30 === 0) {
      this.snapshots.push(structuredClone(this.world));
      if (this.snapshots.length > 24) {
        this.snapshots.shift();
      }
    }
    if (result.violations.length) {
      this.pauses.add('incident');
      this.clearInput();
      const eventKeys = result.violations.map((v) => `${v.type}:${v.roadObjectId}:${v.episode}`);
      const existing = this.history.violations.find(
        (v) => v.attemptId === this.attemptId && v.eventKeys?.some((k) => eventKeys.includes(k)),
      );
      const causes = [
        ...(existing?.causes ?? []),
        ...result.violations.flatMap((v) =>
          v.causes.map((c) => ({
            ...c,
            facts: { ...c.facts, roadObjectId: v.roadObjectId, episode: v.episode },
          })),
        ),
      ];
      const uniqueCauses = causes.filter(
        (c, i) =>
          causes.findIndex(
            (other) =>
              other.code === c.code &&
              other.facts.roadObjectId === c.facts.roadObjectId &&
              other.facts.episode === c.facts.episode,
          ) === i,
      );
      const incident = { ...result.violations[0], causes: uniqueCauses };
      const selected = existing
        ? existing.material
        : selectIncidentQuestion(this.questions, incident, this.history.answers);
      const entry: Violation = {
        ...incident,
        id: existing?.id ?? this.environment.id(),
        tripId: this.tripId,
        attemptId: this.attemptId,
        date: existing?.date ?? this.environment.date(),
        mapVersion: this.map.version,
        rulesVersion: RULES_VERSION,
        eventKeys: [...new Set([...(existing?.eventKeys ?? []), ...eventKeys])],
        material: selected ? structuredClone(selected) : null,
        ...(!selected
          ? {
              materialUnavailable:
                'Подходящего материала для сочетания причин нет. Ниже доступны объяснения и ссылки на ПДД.',
            }
          : {}),
      };
      if (!existing) {
        const targetTick = this.world.tick - Math.round(5 / STEP);
        const checkpoint =
          [...this.snapshots].reverse().find((w) => w.tick <= targetTick) ?? this.snapshots[0];
        if (checkpoint) {
          this.checkpoints.set(entry.id, structuredClone(checkpoint));
        }
        if (this.checkpoints.size > 20) {
          this.checkpoints.delete(this.checkpoints.keys().next().value!);
        }
      }
      this.history = {
        ...this.history,
        violations: existing
          ? this.history.violations.map((v) => (v.id === entry.id ? entry : v))
          : [...this.history.violations, entry],
      };
      this.current = entry;
      this.answer = null;
      this.persist();
      this.publish();
    } else if (this.world.tick % 6 === 0) {
      this.publish();
    }
  }
  continueTrip() {
    this.recordSkip();
    this.current = null;
    this.answer = null;
    this.pauses.delete('incident');
    this.clearInput();
    this.publish();
  }
  canRetry(id: string) {
    return this.checkpoints.has(id);
  }
  retry() {
    if (!this.started) {
      return;
    }
    this.recordSkip();
    const checkpoint = this.current && this.checkpoints.get(this.current.id);
    if (!checkpoint) {
      this.notice = 'Точный повтор недоступен. Можно вернуться к началу улицы.';
      this.publish();
      return;
    }
    this.world = structuredClone(checkpoint);
    this.attemptId = this.environment.id();
    this.snapshots = [structuredClone(checkpoint)];
    this.current = null;
    this.answer = null;
    this.pauses.delete('incident');
    this.pauses.delete('journal');
    this.clearInput();
    this.publish();
  }
  returnToRoad() {
    if (!this.started) {
      this.start();
      return;
    }
    this.recordSkip();
    this.world = {
      ...initialWorld(this.map),
      successfulManeuvers: this.world.successfulManeuvers,
    };
    this.attemptId = this.environment.id();
    this.snapshots = [structuredClone(this.world)];
    this.current = null;
    this.answer = null;
    this.pauses.delete('incident');
    this.pauses.delete('journal');
    this.clearInput();
    this.publish();
  }
  reveal() {
    if (!this.current || !this.question) {
      return;
    }
    if (!this.history.revealed.includes(this.current.id)) {
      this.history = { ...this.history, revealed: [...this.history.revealed, this.current.id] };
      this.persist();
    }
    this.publish();
  }
  answerQuestion(index: number) {
    if (!this.current || !this.question || this.answer) {
      return;
    }
    const answer: AnswerAttempt = {
      id: this.environment.id(),
      violationId: this.current.id,
      questionId: this.question.id,
      contentVersion: this.question.version,
      answer: index,
      correct: evaluateAnswer(this.question, index),
      assisted: this.history.revealed.includes(this.current.id),
      date: this.environment.date(),
    };
    this.answer = answer;
    this.history = {
      ...this.history,
      answers: [...this.history.answers, answer],
      revealed: [...new Set([...this.history.revealed, this.current.id])],
    };
    this.persist();
    this.publish();
  }
  openJournal() {
    this.pauses.add('journal');
    this.clearInput();
    this.publish();
  }
  closeJournal() {
    this.pauses.delete('journal');
    this.publish();
  }
  review(id: string) {
    this.current = this.history.violations.find((v) => v.id === id) ?? null;
    this.answer = null;
    this.pauses.add('incident');
    this.clearInput();
    this.publish();
  }
  clearHistory() {
    this.history = {
      ...emptyHistory(),
      trips: this.started ? this.history.trips.filter((t) => t.id === this.tripId) : [],
    };
    this.completedTripId = null;
    this.checkpoints.clear();
    this.current = null;
    this.answer = null;
    this.pauses.delete('incident');
    this.loaded = true;
    this.persist();
    this.publish();
  }
  finish() {
    this.recordSkip();
    this.endTrip('finished');
    this.completedTripId = this.tripId;
    this.persist();
    this.started = false;
    this.clearInput();
    this.current = null;
    this.pauses.clear();
    this.pauses.add('journal');
    this.publish();
  }
  private recordSkip() {
    if (
      this.current &&
      !this.answer &&
      !this.history.answers.some((a) => a.violationId === this.current!.id) &&
      !this.history.skips.some((s) => s.violationId === this.current!.id)
    ) {
      this.history = {
        ...this.history,
        skips: [
          ...this.history.skips,
          {
            id: this.environment.id(),
            violationId: this.current.id,
            date: this.environment.date(),
          },
        ],
      };
      this.persist();
    }
  }
  private endTrip(status: Trip['status']) {
    this.history = {
      ...this.history,
      trips: this.history.trips.map((t) =>
        t.id === this.tripId && t.status === 'active'
          ? { ...t, status, finishedAt: this.environment.date() }
          : t,
      ),
    };
  }
  private persist() {
    if (!this.loaded) {
      return;
    } // Never overwrite unreadable historical data silently.
    const copy = structuredClone(this.history);
    this.storage = 'saving';
    this.pendingWrites += 1;
    this.queue = this.queue.then(async () => {
      try {
        await this.repository.save(copy);
        this.pendingWrites -= 1;
        this.storage = this.pendingWrites ? 'saving' : 'saved';
        this.notice = '';
      } catch {
        this.pendingWrites -= 1;
        this.storage = 'error';
        this.notice =
          'История не сохранена. Можно продолжить поездку; результаты доступны до закрытия вкладки.';
      }
      this.publish();
    });
  }
  flushPersistence() {
    return this.queue;
  }
}
