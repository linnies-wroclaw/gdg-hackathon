import { ConsoleLogger } from '@nestjs/common';
import { correlationStorage } from './correlation-storage';

export class CorrelationLogger extends ConsoleLogger {
  private getCorrelationPrefix(): string {
    const cid = correlationStorage.getStore();
    return cid ? `[CID: ${cid}] ` : '';
  }

  override log(message: any, context?: string) {
    super.log(`${this.getCorrelationPrefix()}${message}`, context);
  }

  override error(message: any, stack?: string, context?: string) {
    super.error(`${this.getCorrelationPrefix()}${message}`, stack, context);
  }

  override warn(message: any, context?: string) {
    super.warn(`${this.getCorrelationPrefix()}${message}`, context);
  }

  override debug(message: any, context?: string) {
    super.debug(`${this.getCorrelationPrefix()}${message}`, context);
  }

  override verbose(message: any, context?: string) {
    super.verbose(`${this.getCorrelationPrefix()}${message}`, context);
  }
}
