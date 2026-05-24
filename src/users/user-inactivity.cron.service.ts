import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';

const INACTIVITY_DAYS = 7;

@Injectable()
export class UserInactivityCronService {
  private readonly logger = new Logger(UserInactivityCronService.name);

  constructor(private readonly usersService: UsersService) {}

  @Cron(process.env.USER_INACTIVITY_CRON ?? CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markInactiveUsers() {
    const cutoff = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000);

    try {
      const result = await this.usersService.markInactiveUsers(cutoff);
      this.logger.log(`Marked ${result.count} users as inactive for inactivity.`);
    } catch (error) {
      this.logger.error('Failed to process inactive users', error);
    }
  }
}