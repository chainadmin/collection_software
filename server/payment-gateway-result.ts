export function isPotentialDuplicateGatewayMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return /duplicate|already\s+(?:been\s+)?(?:processed|submitted)|previously\s+(?:processed|submitted)/i.test(message);
}

export type AuthorizeNetDisposition = "approved" | "declined" | "ambiguous";

export function classifyAuthorizeNetDisposition(
  responseCode: string | number | null | undefined,
  hasApprovalMessage: boolean,
  errorMessage: string | null | undefined,
): AuthorizeNetDisposition {
  const code = responseCode == null ? "" : String(responseCode);
  if (code === "1" && hasApprovalMessage) return "approved";
  if ((code === "2" || code === "3") && errorMessage && !isPotentialDuplicateGatewayMessage(errorMessage)) {
    return "declined";
  }
  return "ambiguous";
}