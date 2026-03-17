/**
 * Viprosell v1.2 Credit Service (Mock)
 */

export const CreditService = {
  async deductCredits(projectId: string, amount: number) {
    console.log(`[Billing] Deducted ${amount} credits for project ${projectId}.`);
    return { success: true };
  }
};
