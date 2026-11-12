/** A held detection can support an intermediate step, but never final power approval. */
export function stepVisionBlocked(final: boolean, uncertain: boolean, progressUncertain: boolean): boolean {
  return final ? uncertain : progressUncertain;
}
