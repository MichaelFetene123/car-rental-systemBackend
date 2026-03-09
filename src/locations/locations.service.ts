import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class LocationsService {
    constructor( private prisma:PrismaService) {}

    getLocations() {
        return this.prisma.location.findMany();
    }
}
