import { randomUUID } from 'crypto';

export const EXCHANGE_RUNTIME = Symbol('EXCHANGE_RUNTIME');
export interface ExchangeRuntime {
  now(): Date;
  id(): string;
}
export const liveRuntime: ExchangeRuntime = { now: () => new Date(), id: randomUUID };
