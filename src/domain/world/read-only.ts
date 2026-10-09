/** Неизменяемое представление вложенных данных мира и истории для внешних читателей. */
export type ReadonlyData<T> = T extends object
  ? { readonly [Key in keyof T]: ReadonlyData<T[Key]> }
  : T;
