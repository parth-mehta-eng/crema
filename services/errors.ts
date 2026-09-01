function extractMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message || null;
  if (typeof error === 'string') return error || null;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return null;
}

export function logDataError(scope: string, error: unknown) {
  const message = extractMessage(error) ?? 'Unknown data error';
  console.error(`[Crema data] ${scope}: ${message}`, error);
}

export function getDataErrorMessage(error: unknown, fallback: string) {
  return extractMessage(error) ?? fallback;
}
