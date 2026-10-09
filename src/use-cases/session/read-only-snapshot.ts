import type { ReadonlyData } from '../../domain/world/read-only';

/** Замораживает дерево обычных данных; передавай сюда отделённый от владельца снимок. */
export function freezeSnapshot<T>(value: T): ReadonlyData<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      freezeSnapshot(child);
    }

    Object.freeze(value);
  }

  return value as ReadonlyData<T>;
}
