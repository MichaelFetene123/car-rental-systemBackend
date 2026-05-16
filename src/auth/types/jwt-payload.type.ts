export type JwtPayload = {
  sub: string;
  email?: string;
  full_name?: string;
  roles: string[];
  permissions: string[];
  tokenVersion: number;
};
