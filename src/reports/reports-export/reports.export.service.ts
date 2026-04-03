// reports.export.service.ts
import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports.service';
import { QueryReportDto } from '../dto/query-report.dto';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';

@Injectable()
export class ReportsExportService {
  constructor(private reportsService: ReportsService) {}

  // =========================
  // EXPORT PDF
  // =========================
  async exportPDF(query: QueryReportDto): Promise<Buffer> {
    const summary = await this.reportsService.getSummary(query);
    const trend = await this.reportsService.getTrend(query);
    const categories = await this.reportsService.getRevenueByCategory(query);
    const top = await this.reportsService.getTopCategories(query);
    const mostBooked = await this.reportsService.getMostBooked(query);

    const doc = new PDFDocument();
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    doc.on('end', () => {});

    // ===== CONTENT =====
    doc.fontSize(20).text('Car Rental Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('Summary');
    doc.text(`Total Revenue: $${summary.totalRevenue}`);
    doc.text(`Total Bookings: ${summary.totalBookings}`);
    doc.text(`Avg Daily Revenue: $${summary.avgDailyRevenue}`);
    doc.moveDown();

    doc.text('Trend');
    trend.forEach((t) => {
      doc.text(`${t.period}: $${t.revenue}`);
    });

    doc.moveDown();
    doc.text('Revenue by Category');
    categories.forEach((c) => {
      doc.text(`${c.category}: $${c.revenue}`);
    });

    doc.moveDown();
    doc.text('Top Categories');
    top.forEach((t) => {
      doc.text(`${t.category}: $${t.revenue}`);
    });

    doc.moveDown();
    doc.text('Most Booked');
    mostBooked.forEach((m) => {
      doc.text(`${m.category}: ${m.bookings}`);
    });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }

  // =========================
  // EXPORT CSV
  // =========================
  async exportCSV(query: QueryReportDto): Promise<string> {
    const categories = await this.reportsService.getRevenueByCategory(query);

    const parser = new Parser({
      fields: ['category', 'revenue'],
    });

    return parser.parse(categories);
  }
}
