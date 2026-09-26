/** The single place that reads the wall clock. Everything else receives `now` or a Clock. */
export type Clock = () => number

export const systemClock: Clock = () => Date.now()
