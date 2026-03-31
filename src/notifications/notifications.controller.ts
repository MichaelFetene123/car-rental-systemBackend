import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateEmailSettingsDto } from './dto/email-settings.dto';
import { UpdateSmsSettingsDto } from './dto/sms-settings.dto';
import { SendBulkNotificationDto } from './dto/send-bulk.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RequirePermission } from 'src/auth/decorator/permission.decorator';
import { Role } from 'src/common/enums/role.enum';
import { PermissionType } from 'src/common/enums/permission.enum';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('send')
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.MANAGE_NOTIFICATIONS)
  sendBulk(@Body() dto: SendBulkNotificationDto) {
    return this.service.sendBulk(dto);
  }

  @Post('settings/email')
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.MANAGE_NOTIFICATIONS)
  updateEmail(@Body() dto: UpdateEmailSettingsDto) {
    return this.service.updateEmailSettings(dto);
  }

  @Post('settings/sms')
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.MANAGE_NOTIFICATIONS)
  updateSms(@Body() dto: UpdateSmsSettingsDto) {
    return this.service.updateSmsSettings(dto);
  }

  @Get('settings')
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.MANAGE_NOTIFICATIONS)
  getSettings() {
    return this.service.getSettings();
  }

  @Get('logs')
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.MANAGE_NOTIFICATIONS)
  getLogs(@Query() query: QueryLogsDto) {
    return this.service.getLogs(query);
  }

  @Get('stats')
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.MANAGE_NOTIFICATIONS)
  getStats() {
    return this.service.getStats();
  }
}
