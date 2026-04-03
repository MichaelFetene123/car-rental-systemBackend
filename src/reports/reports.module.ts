import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from 'src/prisma.module';
import { ReportsExportService } from './reports-export/reports.export.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExportService],
})
export class ReportsModule {}
