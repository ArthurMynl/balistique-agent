export const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
