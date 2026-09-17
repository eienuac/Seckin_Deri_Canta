export async function register() {
  // Intentionally empty: process.on('unhandledRejection') is not Edge-safe
  // and caused Turbopack "Ecmascript file had an error" under Next.js 16.
  // CMS/DB failures are already logged via try/catch in layout & pages.
}
