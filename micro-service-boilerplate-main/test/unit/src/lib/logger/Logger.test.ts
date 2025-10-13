import * as path from 'path';
import * as winston from 'winston';
import { Logger } from '../../../../../src/lib/logger';

jest.mock('winston', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Logger', () => {
  it('should create a logger with the default scope', () => {
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it('should create a logger with a custom scope', () => {
    const logger = new Logger('custom');
    expect(logger).toBeDefined();
  });

  it('should parse a filepath to a scope', () => {
    const logger = new Logger(`${process.cwd()}${path.sep}src${path.sep}test.ts`);
    logger.info('info message');
    expect(winston.info).toHaveBeenCalledWith('[test] info message', []);
  });

  it('should log a debug message', () => {
    const logger = new Logger();
    logger.debug('debug message');
    expect(winston.debug).toHaveBeenCalledWith('[app] debug message', []);
  });

  it('should log an info message', () => {
    const logger = new Logger();
    logger.info('info message');
    expect(winston.info).toHaveBeenCalledWith('[app] info message', []);
  });

  it('should log a warn message', () => {
    const logger = new Logger();
    logger.warn('warn message');
    expect(winston.warn).toHaveBeenCalledWith('[app] warn message', []);
  });

  it('should log an error message', () => {
    const logger = new Logger();
    logger.error('error message');
    expect(winston.error).toHaveBeenCalledWith('[app] error message', []);
  });
});
