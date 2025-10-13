// Manual mock for Logger
export class Logger {
  public info = jest.fn();
  public error = jest.fn();
  public warn = jest.fn();
  public debug = jest.fn();

  constructor(_scope?: string) {
    // Mock constructor - do nothing
  }
}
