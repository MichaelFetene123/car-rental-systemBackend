// reports.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ReportsExportService } from './reports-export/reports.export.service';
import { ReportsService } from './reports.service';
import { QueryReportDto } from './dto/query-report.dto';

@Roles(Role.Admin)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ReportsExportService,
  ) {}

  @Get('summary')
  getSummary(@Query() query: QueryReportDto) {
    return this.reportsService.getSummary(query);
  }

  @Get('trend')
  getTrend(@Query() query: QueryReportDto) {
    return this.reportsService.getTrend(query);
  }

  @Get('category-revenue')
  getRevenueByCategory(@Query() query: QueryReportDto) {
    return this.reportsService.getRevenueByCategory(query);
  }

  @Get('top-categories')
  getTopCategories(@Query() query: QueryReportDto) {
    return this.reportsService.getTopCategories(query);
  }

  @Get('most-booked')
  getMostBooked(@Query() query: QueryReportDto) {
    return this.reportsService.getMostBooked(query);
  }

  @Get('export')
  async exportReport(
    @Query() query: QueryReportDto,
    @Query('format') format: 'pdf' | 'csv',
    @Res() res: Response,
  ) {
    if (format === 'csv') {
      const csv = await this.exportService.exportCSV(query);

      res.header('Content-Type', 'text/csv');
      res.attachment('report.csv');

      return res.send(csv);
    }

    const pdfBuffer = await this.exportService.exportPDF(query);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=report.pdf',
      'Content-Length': pdfBuffer.length,
    });

    return res.end(pdfBuffer);
  }
}
