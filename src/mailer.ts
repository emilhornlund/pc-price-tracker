import nodemailer from 'nodemailer';

import type { EmailContent } from './email';
import type { EmailNotificationConfig, SmtpCredentials } from './config';

type MailTransport = ReturnType<typeof nodemailer.createTransport>;
type TransportOptions = Parameters<typeof nodemailer.createTransport>[0];
export type TransportFactory = (options: TransportOptions) => MailTransport;

export interface EmailSender {
  send(content: EmailContent): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(`Failed to send notification email: ${reason}`, options);
    this.name = 'EmailDeliveryError';
  }
}

export function createSmtpEmailSender(
  config: EmailNotificationConfig,
  credentials: SmtpCredentials,
  transportFactory: TransportFactory = nodemailer.createTransport,
): EmailSender {
  const transport = transportFactory({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: credentials.username,
      pass: credentials.password,
    },
    connectionTimeout: config.smtp.timeoutSeconds * 1_000,
    greetingTimeout: config.smtp.timeoutSeconds * 1_000,
    socketTimeout: config.smtp.timeoutSeconds * 1_000,
  });

  return {
    async send(content: EmailContent): Promise<void> {
      try {
        await transport.sendMail({
          from: config.from,
          to: config.recipients,
          subject: content.subject,
          text: content.text,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new EmailDeliveryError(reason, { cause: error });
      }
    },
  };
}
