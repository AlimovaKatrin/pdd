/** An actual excess must not be rounded back to the permitted value. */
export function displayedSpeed(speedKmh: number, limitKmh: number): number {
  return speedKmh > limitKmh ? Math.ceil(speedKmh) : Math.round(speedKmh);
}
