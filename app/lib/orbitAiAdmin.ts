const ORBIT_AI_TEST_CREDIT_ADMIN_EMAILS = new Set([
  "rezo.manjgaladze@gmail.com",
  "nat.sulava@gmail.com",
]);

export const isOrbitAiTestCreditAdmin = (email?: string | null) =>
  Boolean(email && ORBIT_AI_TEST_CREDIT_ADMIN_EMAILS.has(email.trim().toLowerCase()));
