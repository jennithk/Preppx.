export const studentRoutes = {
  root: '/student',
  login: '/student/login',
  register: '/student/register',
  createPassword: '/student/create-password',
  verifyOtp: '/student/verify-otp',
  forgotPassword: '/student/forgot-password',
  resetPassword: '/student/reset-password',
  dashboard: '/student/dashboard',
  profile: '/student/profile',
} as const;

export function withQuery(path: string, query: URLSearchParams | string) {
  const value = typeof query === 'string' ? query : query.toString();
  return value ? `${path}?${value}` : path;
}
