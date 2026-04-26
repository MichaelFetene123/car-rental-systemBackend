export const jwtConstants = {
  accessSecret: process.env.JWT_ACCESS_SECRET || process.env.SECRET || 'replace-with-secure-secret',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    process.env.SECRET ||
    'replace-with-secure-refresh-secret',
  accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '900s',
  refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  refreshCookieName: process.env.JWT_REFRESH_COOKIE_NAME || 'car_rental_refresh_token',
  refreshCookieMaxAgeMs:
    Number(process.env.JWT_REFRESH_COOKIE_MAX_AGE_MS) ||
    7 * 24 * 60 * 60 * 1000,
};
