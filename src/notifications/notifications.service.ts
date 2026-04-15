import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';
import { UpdateEmailSettingsDto } from './dto/email-settings.dto';
import { UpdateSmsSettingsDto } from './dto/sms-settings.dto';
import { SendBulkNotificationDto } from './dto/send-bulk.dto';
import { QueryLogsDto } from './dto/query-logs.dto';

type EmailChannelConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  from_name: string;
  from_email: string;
};

type SmsChannelConfig = {
  accountSid: string;
  authToken: string;
  from_number: string;
};

type RecipientUser = {
  id: string;
  email: string | null;
  phone: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // =============================
  // SETTINGS
  // =============================

  async updateEmailSettings(dto: UpdateEmailSettingsDto) {
    return this.prisma.notificationChannelSettings.upsert({
      where: { channel: 'email' },
      update: {
        provider: 'smtp',
        config_json: {
          host: dto.host,
          port: dto.port,
          username: dto.username,
          password: dto.password,
        },
        from_name: dto.fromName,
        from_email: dto.fromEmail,
        is_active: true,
      },
      create: {
        channel: 'email',
        provider: 'smtp',
        config_json: {
          host: dto.host,
          port: dto.port,
          username: dto.username,
          password: dto.password,
        },
        from_name: dto.fromName,
        from_email: dto.fromEmail,
        is_active: true,
      },
    });
  }

  async updateSmsSettings(dto: UpdateSmsSettingsDto) {
    return this.prisma.notificationChannelSettings.upsert({
      where: { channel: 'sms' },
      update: {
        provider: dto.provider,
        config_json: {
          accountSid: dto.accountSid,
          authToken: dto.authToken,
        },
        from_number: dto.fromNumber,
        is_active: true,
      },
      create: {
        channel: 'sms',
        provider: dto.provider,
        config_json: {
          accountSid: dto.accountSid,
          authToken: dto.authToken,
        },
        from_number: dto.fromNumber,
        is_active: true,
      },
    });
  }

  async getSettings() {
    const [emailSettings, smsSettings] = await Promise.all([
      this.prisma.notificationChannelSettings.findUnique({
        where: { channel: 'email' },
      }),
      this.prisma.notificationChannelSettings.findUnique({
        where: { channel: 'sms' },
      }),
    ]);

    return {
      email: emailSettings,
      sms: smsSettings,
    };
  }
  // =============================
  // SENDERS
  // =============================

  async getChannelConfig(channel: 'email'): Promise<EmailChannelConfig>;
  async getChannelConfig(channel: 'sms'): Promise<SmsChannelConfig>;
  async getChannelConfig(channel: 'email' | 'sms') {
    const config = await this.prisma.notificationChannelSettings.findUnique({
      where: { channel },
    });

    if (!config) {
      throw new Error(`Channel ${channel} is not configured`);
    }

    if (!config.is_active) {
      throw new Error(`Channel ${channel} is disabled`);
    }

    // Ensure config_json is an object
    if (typeof config.config_json !== 'object' || config.config_json === null) {
      throw new Error(`Invalid config_json for ${channel}`);
    }

    const json = config.config_json as Record<string, unknown>;

    if (channel === 'email') {
      if (
        typeof json.host !== 'string' ||
        typeof json.port !== 'number' ||
        typeof json.username !== 'string' ||
        typeof json.password !== 'string' ||
        typeof config.from_name !== 'string' ||
        typeof config.from_email !== 'string'
      ) {
        throw new Error('Invalid email channel configuration');
      }

      return {
        host: json.host,
        port: json.port,
        username: json.username,
        password: json.password,
        from_name: config.from_name,
        from_email: config.from_email,
      };
    }

    if (
      typeof json.accountSid !== 'string' ||
      typeof json.authToken !== 'string' ||
      typeof config.from_number !== 'string'
    ) {
      throw new Error('Invalid sms channel configuration');
    }

    return {
      accountSid: json.accountSid,
      authToken: json.authToken,
      from_number: config.from_number,
    };
  }

  async sendEmail(to: string, subject: string, content: string) {
    const config = await this.getChannelConfig('email');

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });

    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to,
      subject,
      html: content,
    });
  }

  async sendSms(to: string, message: string) {
    const config = await this.getChannelConfig('sms');

    const client = new Twilio(config.accountSid, config.authToken);

    await client.messages.create({
      body: message,
      from: config.from_number,
      to,
    });
  }

  // =============================
  // BULK SEND
  // =============================

  async resolveRecipients(
    dto: SendBulkNotificationDto,
  ): Promise<RecipientUser[]> {
    if (dto.recipientType === 'all') {
      return this.prisma.user.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          email: true,
          phone: true,
        },
      });
    }

    if (!dto.userIds?.length) {
      throw new BadRequestException(
        'userIds is required when recipientType is specific',
      );
    }

    return this.prisma.user.findMany({
      where: { id: { in: dto.userIds } },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    });
  }

  async sendBulk(dto: SendBulkNotificationDto) {
    if (dto.type === 'email' && !dto.subject?.trim()) {
      throw new BadRequestException(
        'subject is required for email notifications',
      );
    }

    const users = await this.resolveRecipients(dto);

    for (const user of users) {
      const recipient = dto.type === 'email' ? user.email : user.phone;

      if (!recipient) continue;

      try {
        if (dto.type === 'email') {
          await this.sendEmail(recipient, dto.subject!, dto.message);
        } else {
          await this.sendSms(recipient, dto.message);
        }

        await this.prisma.notificationLog.create({
          data: {
            user_id: user.id,
            type: dto.type,
            recipient,
            subject: dto.subject,
            status: 'sent',
          },
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown notification error';

        await this.prisma.notificationLog.create({
          data: {
            user_id: user.id,
            type: dto.type,
            recipient,
            subject: dto.subject,
            status: 'failed',
            error_message: errorMessage,
          },
        });
      }
    }

    return { total: users.length };
  }

  // =============================
  // LOGS + STATS
  // =============================

  async getLogs(query: QueryLogsDto) {
    return this.prisma.notificationLog.findMany({
      where: {
        status: query.status,
        type: query.type,
        recipient: query.search
          ? { contains: query.search, mode: 'insensitive' }
          : undefined,
      },
      orderBy: { sent_at: 'desc' },
      include: {
        user: true,
      },
    });
  }

  async getStats() {
    const [sent, failed, pending] = await Promise.all([
      this.prisma.notificationLog.count({ where: { status: 'sent' } }),
      this.prisma.notificationLog.count({ where: { status: 'failed' } }),
      this.prisma.notificationLog.count({ where: { status: 'pending' } }),
    ]);

    const total = sent + failed + pending;

    return {
      total,
      sent,
      failed,
      pending,
      successRate: total ? (sent / total) * 100 : 0,
    };
  }
}
