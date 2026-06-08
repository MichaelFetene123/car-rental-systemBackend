// reports.export.service.ts
import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports.service';
import { QueryReportDto } from '../dto/query-report.dto';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import * as ExcelJS from 'exceljs';

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

  // =========================
  // EXPORT XLSX
  // =========================
  async exportXLSX(query: QueryReportDto): Promise<Buffer> {
    const summary = await this.reportsService.getSummary(query);
    const trend = await this.reportsService.getTrend(query);
    const categories = await this.reportsService.getRevenueByCategory(query);
    
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Summary & Trends
    const sheet1 = workbook.addWorksheet('Summary & Trends');
    sheet1.columns = [
      { header: 'Period', key: 'period', width: 20 },
      { header: 'Revenue', key: 'revenue', width: 15 },
      { header: 'Bookings', key: 'bookings', width: 15 },
      { header: 'Cars', key: 'cars', width: 15 },
    ];
    
    // Add summary header
    sheet1.insertRow(1, ['Report Summary']);
    sheet1.insertRow(2, ['Total Revenue', summary.totalRevenue]);
    sheet1.insertRow(3, ['Total Bookings', summary.totalBookings]);
    sheet1.insertRow(4, ['Avg Daily Revenue', summary.avgDailyRevenue]);
    sheet1.insertRow(5, []); // empty row
    
    // Make the header for trend table start at row 6
    sheet1.getRow(6).values = ['Period', 'Revenue', 'Bookings', 'Cars Rented'];
    sheet1.getRow(6).font = { bold: true };
    
    let currentRow = 7;
    trend.forEach(t => {
      sheet1.getRow(currentRow).values = [t.period, t.revenue, t.bookings, t.cars];
      currentRow++;
    });
    
    // Sheet 2: Category Breakdown
    const sheet2 = workbook.addWorksheet('Category Breakdown');
    sheet2.columns = [
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Revenue', key: 'revenue', width: 15 },
      { header: 'Bookings', key: 'bookings', width: 15 },
    ];
    
    sheet2.getRow(1).font = { bold: true };
    
    categories.forEach(c => {
      sheet2.addRow([c.category, c.revenue, c.bookings]);
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
