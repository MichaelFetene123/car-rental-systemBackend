// dto/dashboard-response.dto.ts

export class RevenueOverviewDto {
  month: string;
  revenue: number;
}

export class WeeklyBookingDto {
  day: string;
  count: number;
}

export class FleetDistributionDto {
  type: string;
  count: number;
}

export class ActivityDto {
  type: 'booking' | 'user' | 'payment' | 'car';
  message: string;
  createdAt: Date;
}

export class DashboardResponseDto {
  availableCars: number;
  activeRentals: number;
  totalBookings: number;
  revenue: number;

  revenueOverview: RevenueOverviewDto[];
  weeklyBookings: WeeklyBookingDto[];
  fleetDistribution: FleetDistributionDto[];
  recentActivity: ActivityDto[];
}
