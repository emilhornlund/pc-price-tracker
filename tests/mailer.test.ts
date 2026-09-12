import {
  createSmtpEmailSender,
  EmailDeliveryError,
  type TransportFactory,
} from '../src/mailer';

const emailConfig = {
  enabled: true,
  recipients: ['one@example.com', 'two@example.com'],
  from: 'tracker@example.com',
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    usernameEnv: 'SMTP_USERNAME',
    passwordEnv: 'SMTP_PASSWORD',
    timeoutSeconds: 30,
  },
};

describe('createSmtpEmailSender', () => {
  it('configures Nodemailer and sends the generated message', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-id' });
    const transportFactory = jest.fn().mockReturnValue({
      sendMail,
    }) as unknown as jest.MockedFunction<TransportFactory>;
    const sender = createSmtpEmailSender(
      emailConfig,
      { username: 'smtp-user', password: 'smtp-password' },
      transportFactory,
    );

    await sender.send({
      subject: 'Price decrease',
      text: 'A price decreased.',
    });

    expect(transportFactory).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 30_000,
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'tracker@example.com',
      to: ['one@example.com', 'two@example.com'],
      subject: 'Price decrease',
      text: 'A price decreased.',
    });
  });

  it('wraps transport failures without exposing credentials', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValue(new Error('connection refused'));
    const transportFactory = jest.fn().mockReturnValue({
      sendMail,
    }) as unknown as jest.MockedFunction<TransportFactory>;
    const sender = createSmtpEmailSender(
      emailConfig,
      { username: 'smtp-user', password: 'secret-password' },
      transportFactory,
    );

    await expect(
      sender.send({ subject: 'Subject', text: 'Body' }),
    ).rejects.toMatchObject({ name: 'EmailDeliveryError' });
    await expect(
      sender.send({ subject: 'Subject', text: 'Body' }),
    ).rejects.not.toThrow('secret-password');
    await expect(
      sender.send({ subject: 'Subject', text: 'Body' }),
    ).rejects.toThrow('connection refused');
    expect(EmailDeliveryError).toBeDefined();
  });
});
