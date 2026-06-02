import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export type EmailUser = {
  email: string;
  name: string;
};

@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

  async sendUserWelcome(user: EmailUser, token: string) {
    const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const confirmation_url = `${baseUrl.replace(/\/$/, '')}/auth/confirm?token=${encodeURIComponent(token)}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Welcome to CarR, Car Rental Company',
      template: './welcome',
      context: {
        name: user.name,
        confirmation_url,
      },
    });
  }
}
