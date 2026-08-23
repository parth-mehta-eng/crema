export function logDataError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown data error';
  console.error(`[Crema data] ${scope}: ${message}`);
}

export function getDataErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
