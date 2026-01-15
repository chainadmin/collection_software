import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User, FileText, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Debtor } from "@shared/schema";

interface AccountSearchProps {
  onSelect?: (debtor: Debtor) => void;
  buttonVariant?: "default" | "outline" | "ghost";
}

export function AccountSearch({ onSelect, buttonVariant = "outline" }: AccountSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const filteredDebtors = debtors.filter((debtor) => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    const fullName = `${debtor.firstName} ${debtor.lastName}`.toLowerCase();
    return (
      fullName.includes(term) ||
      debtor.fileNumber?.toLowerCase().includes(term) ||
      debtor.accountNumber.toLowerCase().includes(term) ||
      debtor.ssn?.includes(term) ||
      debtor.ssnLast4?.includes(term)
    );
  });

  const handleSelect = (debtor: Debtor) => {
    onSelect?.(debtor);
    setOpen(false);
    setSearchTerm("");
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "in_payment":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "settled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      case "disputed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size="default" data-testid="button-account-search">
          <Search className="h-4 w-4 mr-2" />
          Search Accounts
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Search Accounts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, file number, account, or SSN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-account-search"
              autoFocus
            />
          </div>
          <ScrollArea className="h-[300px]">
            {searchTerm && filteredDebtors.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No accounts found matching "{searchTerm}"
              </p>
            )}
            {!searchTerm && (
              <p className="text-center text-muted-foreground py-8">
                Enter a search term to find accounts
              </p>
            )}
            <div className="space-y-2">
              {filteredDebtors.map((debtor) => (
                <button
                  key={debtor.id}
                  onClick={() => handleSelect(debtor)}
                  className="w-full text-left p-3 rounded-md border hover-elevate active-elevate-2 transition-colors"
                  data-testid={`search-result-${debtor.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {debtor.firstName} {debtor.lastName}
                        </span>
                        <Badge variant="outline" className={getStatusColor(debtor.status)}>
                          {debtor.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {debtor.fileNumber && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {debtor.fileNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {debtor.accountNumber}
                        </span>
                        {debtor.ssn && (
                          <span className="font-mono">{debtor.ssn}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-medium">
                        {formatCurrency(debtor.currentBalance)}
                      </p>
                      <p className="text-xs text-muted-foreground">Balance</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
