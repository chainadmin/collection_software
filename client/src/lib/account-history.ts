export const ACCOUNT_CHANGED_EVENT = "account-workspace-changed";

export type AccountHistory = {
  currentAccountId: string | null;
  previousAccountId: string | null;
};

export function recordAccountChange(history: AccountHistory, accountId: string): AccountHistory {
  if (!accountId || history.currentAccountId === accountId) return history;

  return {
    currentAccountId: accountId,
    previousAccountId: history.currentAccountId,
  };
}

export function announceAccountChange(accountId: string) {
  window.dispatchEvent(new CustomEvent(ACCOUNT_CHANGED_EVENT, { detail: { accountId } }));
}
