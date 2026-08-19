/** Injectable clock seam for all ad activation times. */
let source: () => Date = () => new Date();
export const now = (): Date => source();
export const setClockForTests = (next: () => Date): void => { source = next; };
