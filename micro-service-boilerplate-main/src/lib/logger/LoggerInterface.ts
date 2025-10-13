export interface LoggerInterface {
  debug(message: string, ...args: Array<any>): void;
  info(message: string, ...args: Array<any>): void;
  warn(message: string, ...args: Array<any>): void;
  error(message: string, ...args: Array<any>): void;
}
