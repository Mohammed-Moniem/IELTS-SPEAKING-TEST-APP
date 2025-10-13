import { configure, format, transports } from 'winston';
import { winstonLoader } from '../../../../src//loaders/winstonLoader';
import { env } from '../../../../src/env';

jest.mock('winston', () => ({
  configure: jest.fn(),
  format: {
    combine: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

describe('winstonLoader', () => {
  it('should configure winston with a console transport', () => {
    winstonLoader();

    expect(configure).toHaveBeenCalledWith({
      transports: [expect.any(transports.Console)]
    });
  });

  it('should set the log level and handle exceptions', () => {
    winstonLoader();

    expect(transports.Console).toHaveBeenCalledWith(
      expect.objectContaining({
        level: env.log.level,
        handleExceptions: true
      })
    );
  });

  it('should use JSON format if not in development environment', () => {
    env.node = 'production';
    winstonLoader();

    expect(format.combine).toHaveBeenCalledWith(format.json());
  });

  it('should use colorize and simple format in development environment', () => {
    env.node = 'development';
    winstonLoader();

    expect(format.combine).toHaveBeenCalledWith(format.colorize(), format.simple());
  });
});
