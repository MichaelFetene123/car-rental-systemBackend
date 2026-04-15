import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { category: 'asc' },
    });
  }
}
