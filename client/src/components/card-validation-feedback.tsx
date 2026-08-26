import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { CardValidationResult } from "@shared/card-validation";

export function CardValidationFeedback({ result }: { result: CardValidationResult }) {
  if (result.status === "incomplete") return result.network === "Unknown" ? null : <p className="mt-2 text-sm text-muted-foreground">Network: {result.network}</p>;
  if (result.status === "invalid") return <p className="mt-2 flex items-center gap-2 text-sm text-red-600" role="alert"><ShieldAlert className="h-4 w-4" />Please check the card number.</p>;
  return <div className="mt-2 space-y-1 text-sm" aria-live="polite">
    <p className="flex items-center gap-2 text-green-600"><ShieldCheck className="h-4 w-4" />Valid card number format</p>
    <p>Network: {result.network}</p><p>Type: {result.type}</p><p>Issuer: {result.issuer}</p><p>Country: {result.country}</p>
    <p className="text-xs text-muted-foreground">Format validation is not payment approval. Approval is determined by the payment processor.</p>
  </div>;
}
