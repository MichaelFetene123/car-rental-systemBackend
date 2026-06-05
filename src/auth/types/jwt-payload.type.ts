export type JwtPayload = {
  sub: string;
  email?: string;
  full_name?: string;
  email_verified?: boolean;
  roles: string[];
  permissions: string[];
  tokenVersion: number;
};
