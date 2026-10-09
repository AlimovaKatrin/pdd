import { activeSpeedZone } from '../../domain/world/traffic';
import type { ReadonlyData } from '../../domain/world/read-only';
import { freezeSnapshot } from './read-only-snapshot';
import { validateMap } from '../../domain/world/validate-map';
import { evaluateAnswer, type Question } from '../../domain/learning/question';
import { STEP, stepWorld } from '../../domain/simulation/step';
import {
  type Trip,
  emptyControls,
  emptyHistory,
  initialWorld,
  type AnswerAttempt,
  type Controls,
  type DetectedViolation,
  type History,
  type Indicator,
  type RoadMap,
  type Violation,
  type World,
} from '../../domain/world/model';
import type { HistoryRepository, LearningContentProvider, SessionEnvironment } from '../ports';
import { prepareIncident } from './prepare-incident';

const SNAPSHOT_INTERVAL_TICKS = 30;

const MAX_SNAPSHOTS = 24;

const MAX_CHECKPOINTS = 20;

const RETRY_LOOKBACK_SECONDS = 5;

const UI_UPDATE_INTERVAL_TICKS = 6;

export type PauseReason = 'manual' | 'blur' | 'incident' | 'journal';

export type SessionSnapshot = ReadonlyData<{
  completedTripId: string | null;
  activeTripId: string | null;
  ready: boolean;
  started: boolean;
  driving: {
    speedKmh: number;
    speedLimit: number | null;
    indicator: Indicator;
    reversing: boolean;
    successfulManeuvers: number;
    advisory: string | undefined;
  };
  pauses: PauseReason[];
  history: History;
  current: Violation | null;
  question?: Question;
  answer: AnswerAttempt | null;
  revealed: boolean;
  journal: boolean;
  storage: 'loading' | 'saved' | 'saving' | 'error';
  notice: string;
}>;

export class GameSession {
  private world: World;

  private readonly mapData: RoadMap;

  readonly map: ReadonlyData<RoadMap>;

  private renderedWorldSource?: World;

  private renderedWorld?: ReadonlyData<World>;

  private controls = emptyControls();

  private pauses = new Set<PauseReason>();

  private history = emptyHistory();

  private publishedHistory?: { source: History; snapshot: ReadonlyData<History> };

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

  private questions: Question[] = [];

  private completedTripId: string | null = null;

  constructor(
    map: RoadMap,
    private repository: HistoryRepository,
    private content: LearningContentProvider,
    private environment: SessionEnvironment,
  ) {
    this.mapData = structuredClone(validateMap(map));
    this.map = freezeSnapshot(structuredClone(this.mapData));
    this.world = initialWorld(this.mapData);
    this.publish();
  }

  async initialize() {
    const [history, content] = await Promise.allSettled([
      this.repository.load(),
      this.content.getCandidates(),
    ]);

    if (history.status === 'fulfilled') {
      const loadedHistory = structuredClone(history.value);

      this.history = {
        ...loadedHistory,
        trips: loadedHistory.trips.map((t) =>
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
      this.questions = structuredClone(content.value);
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

  getWorld = (): ReadonlyData<World> => {
    if (this.renderedWorldSource !== this.world || !this.renderedWorld) {
      this.renderedWorld = freezeSnapshot(structuredClone(this.world));
      this.renderedWorldSource = this.world;
    }

    return this.renderedWorld;
  };

  isRunning = () => this.started && this.pauses.size === 0;

  private getHistorySnapshot(): ReadonlyData<History> {
    // История обновляется заменой объекта. Не копируем её заново при каждом обновлении HUD.
    if (this.publishedHistory?.source !== this.history) {
      this.publishedHistory = {
        source: this.history,
        snapshot: freezeSnapshot(structuredClone(this.history)),
      };
    }

    return this.publishedHistory.snapshot;
  }

  private publish() {
    const current = structuredClone(this.current);

    this.snapshot = freezeSnapshot({
      completedTripId: this.completedTripId,
      activeTripId: this.started ? this.tripId : null,
      ready: this.ready,
      started: this.started,
      driving: {
        speedKmh: Math.round(Math.abs(this.world.vehicle.speed) * 3.6),
        speedLimit: activeSpeedZone(this.mapData, this.world.vehicle)?.limit ?? null,
        indicator: this.world.vehicle.indicator,
        reversing: this.world.vehicle.speed < 0,
        successfulManeuvers: this.world.successfulManeuvers,
        advisory: this.world.advisories[0],
      },
      pauses: [...this.pauses],
      history: this.getHistorySnapshot(),
      current,
      question: current?.material ?? undefined,
      answer: structuredClone(this.answer),
      revealed: !!this.current && this.history.revealed.includes(this.current.id),
      journal: this.pauses.has('journal'),
      storage: this.storage,
      notice: this.notice,
    });
    this.listeners.forEach((listener) => listener());
  }

  start() {
    if (!this.ready) {
      return;
    }

    if (this.started) {
      this.endTrip('restarted');
    }

    this.completedTripId = null;
    this.world = initialWorld(this.mapData);
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

    const result = stepWorld(this.world, this.controls, this.mapData);

    this.world = result.world;
    this.rememberSnapshot();

    const [firstViolation, ...otherViolations] = result.violations;

    if (firstViolation) {
      this.handleViolations([firstViolation, ...otherViolations]);
    } else if (this.world.tick % UI_UPDATE_INTERVAL_TICKS === 0) {
      this.publish();
    }
  }

  private rememberSnapshot() {
    if (this.world.tick % SNAPSHOT_INTERVAL_TICKS !== 0) {
      return;
    }

    this.snapshots.push(structuredClone(this.world));

    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
  }

  private rememberCheckpoint(violationId: string) {
    const targetTick = this.world.tick - Math.round(RETRY_LOOKBACK_SECONDS / STEP);

    const checkpoint =
      [...this.snapshots].reverse().find((world) => world.tick <= targetTick) ?? this.snapshots[0];

    if (checkpoint) {
      this.checkpoints.set(violationId, structuredClone(checkpoint));
    }

    if (this.checkpoints.size > MAX_CHECKPOINTS) {
      const oldestId = this.checkpoints.keys().next().value;

      if (oldestId !== undefined) {
        this.checkpoints.delete(oldestId);
      }
    }
  }

  private handleViolations(violations: [DetectedViolation, ...DetectedViolation[]]) {
    this.pauses.add('incident');
    this.clearInput();

    const { entry, isNew } = prepareIncident({
      violations,
      history: this.history,
      questions: this.questions,
      tripId: this.tripId,
      attemptId: this.attemptId,
      mapVersion: this.map.version,
      environment: this.environment,
    });

    if (isNew) {
      this.rememberCheckpoint(entry.id);
    }

    this.history = {
      ...this.history,
      violations: isNew
        ? [...this.history.violations, entry]
        : this.history.violations.map((violation) =>
            violation.id === entry.id ? entry : violation,
          ),
    };
    this.current = entry;
    this.answer = null;
    this.persist();
    this.publish();
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

    this.beginAttempt(structuredClone(checkpoint));
  }

  returnToRoad() {
    if (!this.started) {
      this.start();

      return;
    }

    this.recordSkip();
    this.beginAttempt({
      ...initialWorld(this.mapData),
      successfulManeuvers: this.world.successfulManeuvers,
    });
  }

  private beginAttempt(world: World) {
    this.world = world;
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
    if (!this.current?.material) {
      return;
    }

    if (!this.history.revealed.includes(this.current.id)) {
      this.history = { ...this.history, revealed: [...this.history.revealed, this.current.id] };
      this.persist();
    }

    this.publish();
  }

  answerQuestion(index: number) {
    const question = this.current?.material;

    if (!this.current || !question || this.answer) {
      return;
    }

    const answer: AnswerAttempt = {
      id: this.environment.id(),
      violationId: this.current.id,
      questionId: question.id,
      contentVersion: question.version,
      answer: index,
      correct: evaluateAnswer(question, index),
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
    const current = this.current;

    if (!current || this.answer) {
      return;
    }

    const hasAnswer = this.history.answers.some((answer) => answer.violationId === current.id);

    const hasSkip = this.history.skips.some((skip) => skip.violationId === current.id);

    if (hasAnswer || hasSkip) {
      return;
    }

    this.history = {
      ...this.history,
      skips: [
        ...this.history.skips,
        { id: this.environment.id(), violationId: current.id, date: this.environment.date() },
      ],
    };
    this.persist();
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
    // Never overwrite unreadable historical data silently.
    if (!this.loaded) {
      return;
    }

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
