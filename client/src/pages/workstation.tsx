import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  MessageSquare,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  ChevronRight,
  SkipForward,
  PhoneOff,
  PhoneIncoming,
  Voicemail,
  CalendarClock,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  Debtor,
  DebtorContact,
  EmploymentRecord,
  BankAccount,
  Note,
  Collector,
  Payment,
} from "@shared/schema";

type CallOutcome = "connected" | "no_answer" | "voicemail" | "busy" | "wrong_number" | "promise";

export default function Workstation() {
  const { toast } = useToast();
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [quickNote, setQuickNote] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ach");
  const [employmentOpen, setEmploymentOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

  const { data: debtors, isLoading: debtorsLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: collectors, isLoading: collectorsLoading, isError: collectorsError } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const currentCollector = collectors?.find((c) => c.role === "collector") || collectors?.[0];
  const isReady = !collectorsLoading && currentCollector;
  const selectedDebtor = debtors?.find((d) => d.id === selectedDebtorId);

  const { data: contacts } = useQuery<DebtorContact[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "contacts"],
    enabled: !!selectedDebtorId,
  });

  const { data: employment } = useQuery<EmploymentRecord[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "employment"],
    enabled: !!selectedDebtorId,
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "bank-accounts"],
    enabled: !!selectedDebtorId,
  });

  const { data: notes } = useQuery<Note[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "notes"],
    enabled: !!selectedDebtorId,
  });

  const workQueue = isReady
    ? (debtors
        ?.filter((d) => {
          const isWorkable = d.status === "open" || d.status === "in_payment";
          const isAssigned = d.assignedCollectorId === currentCollector.id;
          return isWorkable && isAssigned;
        })
        ?.sort((a, b) => {
          if (!a.nextFollowUpDate && !b.nextFollowUpDate) return 0;
          if (!a.nextFollowUpDate) return 1;
          if (!b.nextFollowUpDate) return -1;
          return new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
        }) ?? [])
    : [];

  const addNoteMutation = useMutation({
    mutationFn: async (data: { debtorId: string; content: string; noteType: string }) => {
      if (!currentCollector) throw new Error("No collector found");
      return apiRequest("POST", `/api/debtors/${data.debtorId}/notes`, {
        debtorId: data.debtorId,
        content: data.content,
        noteType: data.noteType,
        collectorId: currentCollector.id,
        createdDate: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "notes"] });
      setQuickNote("");
      toast({ title: "Note added", description: "Your note has been saved." });
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (data: { debtorId: string; amount: number; paymentMethod: string }) => {
      if (!currentCollector) throw new Error("No collector found");
      return apiRequest("POST", `/api/debtors/${data.debtorId}/payments`, {
        debtorId: data.debtorId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        paymentDate: new Date().toISOString().split("T")[0],
        status: "pending",
        processedBy: currentCollector.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "payments"] });
      setShowPaymentDialog(false);
      setPaymentAmount("");
      toast({ title: "Payment recorded", description: "Payment has been added to the queue." });
    },
  });

  const updateDebtorMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Debtor> }) => {
      return apiRequest("PATCH", `/api/debtors/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
    },
  });

  const handleCallOutcome = (outcome: CallOutcome) => {
    if (!selectedDebtorId || !currentCollector) return;

    const today = new Date().toISOString().split("T")[0];
    let nextFollowUp: string | null = null;
    let noteContent = "";
    let noteType = "call";

    switch (outcome) {
      case "connected":
        noteContent = "Connected with debtor - discussed account";
        nextFollowUp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "no_answer":
        noteContent = "No answer - left callback";
        nextFollowUp = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "voicemail":
        noteContent = "Left voicemail message";
        nextFollowUp = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "busy":
        noteContent = "Line busy - will try again";
        nextFollowUp = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "wrong_number":
        noteContent = "Wrong number - needs research";
        noteType = "research";
        break;
      case "promise":
        noteContent = "Promise to pay obtained";
        noteType = "promise";
        nextFollowUp = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
    }

    addNoteMutation.mutate({
      debtorId: selectedDebtorId,
      content: noteContent,
      noteType,
    });

    updateDebtorMutation.mutate({
      id: selectedDebtorId,
      updates: {
        lastContactDate: today,
        nextFollowUpDate: nextFollowUp,
      },
    });

    toast({ title: "Call logged", description: noteContent });
  };

  const handleAddQuickNote = () => {
    if (!selectedDebtorId || !quickNote.trim() || !currentCollector) return;
    addNoteMutation.mutate({
      debtorId: selectedDebtorId,
      content: quickNote.trim(),
      noteType: "general",
    });
  };

  const handleRecordPayment = () => {
    if (!selectedDebtorId || !paymentAmount || !currentCollector) return;
    const amount = Math.round(parseFloat(paymentAmount) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid payment amount.", variant: "destructive" });
      return;
    }
    addPaymentMutation.mutate({
      debtorId: selectedDebtorId,
      amount,
      paymentMethod,
    });
  };

  const advanceToNext = () => {
    const currentIndex = workQueue.findIndex((d) => d.id === selectedDebtorId);
    if (currentIndex < workQueue.length - 1) {
      setSelectedDebtorId(workQueue[currentIndex + 1].id);
    } else if (workQueue.length > 0) {
      setSelectedDebtorId(workQueue[0].id);
    }
  };

  const getCollectorName = (collectorId: string) => {
    const collector = collectors?.find((c) => c.id === collectorId);
    return collector?.name || "Unknown";
  };

  const getPriorityColor = (debtor: Debtor) => {
    if (!debtor.nextFollowUpDate) return "text-muted-foreground";
    const followUp = new Date(debtor.nextFollowUpDate);
    const today = new Date();
    const diffDays = Math.ceil((followUp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "text-destructive";
    if (diffDays === 0) return "text-orange-500";
    if (diffDays <= 2) return "text-yellow-500";
    return "text-muted-foreground";
  };

  const getPriorityDot = (debtor: Debtor) => {
    if (!debtor.nextFollowUpDate) return "bg-muted-foreground";
    const followUp = new Date(debtor.nextFollowUpDate);
    const today = new Date();
    const diffDays = Math.ceil((followUp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "bg-destructive";
    if (diffDays === 0) return "bg-orange-500";
    if (diffDays <= 2) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-80 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">Work Queue</h2>
            {currentCollector && (
              <Badge variant="secondary" className="text-xs">
                @{currentCollector.username}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{workQueue.length} accounts to work</p>
        </div>
        <ScrollArea className="flex-1">
          {(debtorsLoading || collectorsLoading) ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : collectorsError ? (
            <div className="p-4 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm">Failed to load collector data</p>
              <p className="text-xs">Please refresh the page</p>
            </div>
          ) : !currentCollector ? (
            <div className="p-4 text-center text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No collector profile found</p>
            </div>
          ) : workQueue.length > 0 ? (
            <div className="p-2 space-y-1">
              {workQueue.map((debtor) => (
                <div
                  key={debtor.id}
                  onClick={() => setSelectedDebtorId(debtor.id)}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    selectedDebtorId === debtor.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover-elevate"
                  }`}
                  data-testid={`queue-item-${debtor.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${getPriorityDot(debtor)}`} />
                      <span className="font-medium text-sm">
                        {debtor.firstName} {debtor.lastName}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {debtor.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs pl-4">
                    <span className="font-mono">{formatCurrency(debtor.currentBalance)}</span>
                    <span className={getPriorityColor(debtor)}>
                      {debtor.nextFollowUpDate ? formatDate(debtor.nextFollowUpDate) : "No follow-up"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No accounts in queue</p>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDebtor ? (
          <>
            <div className="p-4 border-b bg-card">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold">
                      {selectedDebtor.firstName} {selectedDebtor.lastName}
                    </h1>
                    <StatusBadge status={selectedDebtor.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Account #{selectedDebtor.accountNumber} | SSN: ***-**-{selectedDebtor.ssnLast4 || "????"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-mono">{formatCurrency(selectedDebtor.currentBalance)}</p>
                  <p className="text-xs text-muted-foreground">
                    Original: {formatCurrency(selectedDebtor.originalBalance)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 border-b bg-muted/50 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-2">Call Outcome:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCallOutcome("connected")}
                disabled={!isReady}
                data-testid="button-connected"
              >
                <PhoneIncoming className="h-4 w-4 mr-1" />
                Connected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCallOutcome("no_answer")}
                disabled={!isReady}
                data-testid="button-no-answer"
              >
                <PhoneOff className="h-4 w-4 mr-1" />
                No Answer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCallOutcome("voicemail")}
                disabled={!isReady}
                data-testid="button-voicemail"
              >
                <Voicemail className="h-4 w-4 mr-1" />
                Voicemail
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCallOutcome("promise")}
                disabled={!isReady}
                data-testid="button-promise"
              >
                <CalendarClock className="h-4 w-4 mr-1" />
                Promise
              </Button>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Button
                size="sm"
                onClick={() => setShowPaymentDialog(true)}
                disabled={!isReady}
                data-testid="button-record-payment"
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Record Payment
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={advanceToNext}
                data-testid="button-next-account"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Next
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contacts && contacts.length > 0 ? (
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              {contact.type === "phone" ? (
                                <Phone className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Mail className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <p className="font-mono text-sm">{contact.value}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {contact.label || contact.type}
                                  {contact.isPrimary && " (Primary)"}
                                </p>
                              </div>
                            </div>
                            {contact.type === "phone" && (
                              <Button size="sm" variant="ghost">
                                <Phone className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No contact information on file</p>
                    )}
                  </CardContent>
                </Card>

                <Collapsible open={employmentOpen} onOpenChange={setEmploymentOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover-elevate rounded-t-lg">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Employment Records
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${employmentOpen ? "rotate-90" : ""}`}
                          />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {employment && employment.length > 0 ? (
                          <div className="space-y-2">
                            {employment.map((record) => (
                              <div key={record.id} className="p-3 rounded-md bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">{record.employerName}</p>
                                  {record.isCurrent && (
                                    <Badge variant="secondary" className="text-xs">Current</Badge>
                                  )}
                                </div>
                                {record.position && (
                                  <p className="text-sm text-muted-foreground">{record.position}</p>
                                )}
                                {record.employerPhone && (
                                  <p className="text-xs font-mono mt-1">{record.employerPhone}</p>
                                )}
                                {record.salary && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Salary: {formatCurrency(record.salary)}/year
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No employment records</p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <Collapsible open={bankOpen} onOpenChange={setBankOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover-elevate rounded-t-lg">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Bank Accounts
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${bankOpen ? "rotate-90" : ""}`}
                          />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {bankAccounts && bankAccounts.length > 0 ? (
                          <div className="space-y-2">
                            {bankAccounts.map((account) => (
                              <div key={account.id} className="p-3 rounded-md bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">{account.bankName}</p>
                                  <Badge
                                    variant={account.isVerified ? "secondary" : "outline"}
                                    className="text-xs"
                                  >
                                    {account.isVerified ? "Verified" : "Unverified"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground capitalize">
                                  {account.accountType} ending in {account.accountNumberLast4 || "****"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No bank accounts on file</p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover-elevate rounded-t-lg">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Notes & Activity
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${notesOpen ? "rotate-90" : ""}`}
                          />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Add a quick note..."
                            value={quickNote}
                            onChange={(e) => setQuickNote(e.target.value)}
                            className="min-h-[60px] resize-none"
                            data-testid="input-quick-note"
                          />
                          <Button
                            size="icon"
                            onClick={handleAddQuickNote}
                            disabled={!quickNote.trim() || addNoteMutation.isPending || !isReady}
                            data-testid="button-add-note"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                        {notes && notes.length > 0 ? (
                          <div className="space-y-2">
                            {notes.map((note) => (
                              <div key={note.id} className="p-3 rounded-md bg-muted/50">
                                <div className="flex items-center justify-between mb-1">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {note.noteType}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(note.createdDate)}
                                  </span>
                                </div>
                                <p className="text-sm">{note.content}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  By: {getCollectorName(note.collectorId)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No notes yet</p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-1">Select an Account</h3>
              <p className="text-sm">Choose an account from the work queue to begin</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter the payment details for{" "}
              {selectedDebtor && `${selectedDebtor.firstName} ${selectedDebtor.lastName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Amount ($)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ach">ACH Transfer</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={addPaymentMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {addPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
