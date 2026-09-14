/**
 * Pure access-gate logic for whether an organization's subscription/active
 * state permits access. Kept separate from storage lookups so it can be
 * unit tested without a database, and so `isActive` (the flag the global
 * admin's on/off toggle writes) is always the first and overriding check.
 */
export interface OrgAccessInput {
  isActive: boolean | null;
  subscriptionStatus?: string | null;
  trialEndDate?: string | null;
  billingStartDate?: string | null;
}

export function computeSubscriptionAccess(
  org: OrgAccessInput,
): { active: boolean; reason?: string } {
  // The global admin's organization toggle is authoritative: an inactive
  // organization is blocked no matter what its subscription status says.
  if (!org.isActive) {
    return { active: false, reason: "Organization is inactive" };
  }

  if (org.subscriptionStatus === "active") {
    return { active: true };
  }

  if (org.subscriptionStatus === "trial") {
    const today = new Date();
    const trialEnd = org.trialEndDate ? new Date(org.trialEndDate) : null;
    const billingStart = org.billingStartDate ? new Date(org.billingStartDate) : null;

    // Some organizations have a free month configured after creation.
    // In that case, keep trial access until the later of trial end or billing start date.
    const accessEndDate = trialEnd && billingStart
      ? (trialEnd > billingStart ? trialEnd : billingStart)
      : (billingStart || trialEnd);

    if (!accessEndDate) {
      return { active: true };
    }

    if (today <= accessEndDate) {
      return { active: true };
    }
    return { active: false, reason: "Trial has expired. Please subscribe to continue." };
  }

  // Default: allow access for legacy orgs without subscription status
  return { active: true };
}
