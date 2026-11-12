/** A held detection can support progress; invalid or unidentified observations still block it. */
export function stepVisionBlocked(final: boolean, uncertain: boolean, progressUncertain: boolean): boolean {
  return progressUncertain;
}
