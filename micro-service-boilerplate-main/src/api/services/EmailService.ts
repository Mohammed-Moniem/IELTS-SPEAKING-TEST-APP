import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { Service } from 'typedi';

@Service()
export class EmailService {
  private log = new Logger(__filename);
  private provider = (process.env.EMAIL_PROVIDER || 'log').toLowerCase();

  public async sendPasswordResetEmail(params: { to: string; resetLink: string }, headers?: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'sendPasswordResetEmail', headers || ({} as IRequestHeaders));

    if (this.provider === 'log') {
      // Dev-only provider: log the reset link instead of sending email.
      this.log.warn(`${logMessage} :: EMAIL_PROVIDER=log (not sending email)`, {
        to: params.to,
        resetLink: params.resetLink
      });
      return;
    }

    this.log.error(`${logMessage} :: Email provider not configured`, {
      provider: this.provider
    });
    throw new Error('Email provider not configured');
  }
}

