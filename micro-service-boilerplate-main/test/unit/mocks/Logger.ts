import { Logger } from '../../../src/lib/logger';

export class MockLogger extends Logger {
  info = jest.fn();
  debug = jest.fn();
  warn = jest.fn();
  error = jest.fn();
}
