import { AsyncLocalStorage } from 'async_hooks';

export const correlationStorage = new AsyncLocalStorage<string>();
