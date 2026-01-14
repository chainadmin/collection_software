import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  CreditCard,
  FileText,
  Clock,
  Plus,
  MoreHorizontal,
  Calendar,
  DollarSign,
  User,
  Briefcase,
  Landmark,
  Edit,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate, formatPhone, maskSSN, getInitials, maskAccountNumber } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Debtor, DebtorContact, EmploymentRecord, BankAccount, Payment, Note } from "@shared/schema";

export default function DebtorDetail() {
  const [, params] = useRoute("/debtors/:id");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("contact");
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ach");

  const debtorId = params?.id;

  const { data: debtor, isLoading: debtorLoading } = useQuery<Debtor>({
    queryKey: ["/api/debtors", debtorId],
    enabled: !!debtorId,
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery<DebtorContact[]>({
    queryKey: ["/api/debtors", debtorId, "contacts"],
    enabled: !!debtorId,
  });

  const { data: employment, isLoading: employmentLoading } = useQuery<EmploymentRecord[]>({
    queryKey: ["/api/debtors", debtorId, "employment"],
    enabled: !!debtorId,
  });

  const { data: bankAccounts, isLoading: bankLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/debtors", debtorId, "bank-accounts"],
    enabled: !!debtorId,
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/debtors", debtorId, "payments"],
    enabled: !!debtorId,
  });

  const { data: notes, isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: ["/api/debtors", debtorId, "notes"],
    enabled: !!debtorId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: { content: string; noteType: string }) => {
      return apiRequest("POST", `/api/debtors/${debtorId}/notes`, {
        ...data,
        debtorId,
        collectorId: "current-user",
        createdDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "notes"] });
      setShowAddNoteDialog(false);
      setNoteContent("");
      setNoteType("general");
      toast({ title: "Note added", description: "Note has been saved to the account." });
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (data: { amount: number; paymentMethod: string }) => {
      return apiRequest("POST", `/api/debtors/${debtorId}/payments`, {
        ...data,
        debtorId,
        paymentDate: new Date().toISOString(),
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId] });
      setShowAddPaymentDialog(false);
      setPaymentAmount("");
      toast({ title: "Payment recorded", description: "Payment has been added to the account." });
    },
  });

  if (debtorLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!debtor) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h2 className="text-lg font-medium mb-2">Debtor not found</h2>
        <Button asChild>
          <Link href="/debtors">Back to Debtors</Link>
        </Button>
      </div>
    );
  }

  const phoneContacts = contacts?.filter((c) => c.type === "phone") || [];
  const emailContacts = contacts?.filter((c) => c.type === "email") || [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild data-testid="button-back">
          <Link href="/debtors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(`${debtor.firstName} ${debtor.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold">
                {debtor.firstName} {debtor.lastName}
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono">{debtor.accountNumber}</span>
                <StatusBadge status={debtor.status} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-edit-debtor">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button onClick={() => setShowAddPaymentDialog(true)} data-testid="button-add-payment">
            <DollarSign className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current Balance
                </p>
                <p className="text-xl font-semibold font-mono">
                  {formatCurrency(debtor.currentBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Original Balance
                </p>
                <p className="text-xl font-semibold font-mono">
                  {formatCurrency(debtor.originalBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Last Contact
                </p>
                <p className="text-sm font-medium">
                  {debtor.lastContactDate ? formatDate(debtor.lastContactDate) : "Never"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  DOB / SSN
                </p>
                <p className="text-sm font-medium">
                  {debtor.dateOfBirth ? formatDate(debtor.dateOfBirth) : "N/A"}{" "}
                  {debtor.ssnLast4 && <span className="text-muted-foreground">/ {maskSSN(debtor.ssnLast4)}</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="contact" className="gap-2" data-testid="tab-contact">
            <Phone className="h-4 w-4" />
            Contact Info
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-2" data-testid="tab-employment">
            <Briefcase className="h-4 w-4" />
            POE
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2" data-testid="tab-bank">
            <Landmark className="h-4 w-4" />
            Bank Info
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2" data-testid="tab-payments">
            <CreditCard className="h-4 w-4" />
            Payment History
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2" data-testid="tab-notes">
            <FileText className="h-4 w-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Numbers
                </CardTitle>
                <Button variant="ghost" size="sm" data-testid="button-add-phone">
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {contactsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : phoneContacts.length > 0 ? (
                  <div className="space-y-3">
                    {phoneContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`phone-${contact.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${contact.isValid ? "bg-green-500" : "bg-red-500"}`} />
                          <div>
                            <p className="text-sm font-medium font-mono">{formatPhone(contact.value)}</p>
                            <p className="text-xs text-muted-foreground capitalize">{contact.label || "Phone"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {contact.isPrimary && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Primary</span>
                          )}
                          <Button variant="ghost" size="icon" data-testid={`call-${contact.id}`}>
                            <Phone className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No phone numbers on file</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Addresses
                </CardTitle>
                <Button variant="ghost" size="sm" data-testid="button-add-email">
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {contactsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : emailContacts.length > 0 ? (
                  <div className="space-y-3">
                    {emailContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`email-${contact.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${contact.isValid ? "bg-green-500" : "bg-red-500"}`} />
                          <div>
                            <p className="text-sm font-medium">{contact.value}</p>
                            <p className="text-xs text-muted-foreground capitalize">{contact.label || "Email"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {contact.isPrimary && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Primary</span>
                          )}
                          <Button variant="ghost" size="icon" data-testid={`send-email-${contact.id}`}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No email addresses on file</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">Place of Employment (POE)</CardTitle>
              <Button variant="ghost" size="sm" data-testid="button-add-employment">
                <Plus className="h-4 w-4 mr-2" />
                Add Employer
              </Button>
            </CardHeader>
            <CardContent>
              {employmentLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : employment && employment.length > 0 ? (
                <div className="space-y-4">
                  {employment.map((emp) => (
                    <div
                      key={emp.id}
                      className="p-4 rounded-md border"
                      data-testid={`employment-${emp.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{emp.employerName}</p>
                            {emp.position && <p className="text-sm text-muted-foreground">{emp.position}</p>}
                            {emp.employerPhone && (
                              <p className="text-sm font-mono mt-1">{formatPhone(emp.employerPhone)}</p>
                            )}
                            {emp.employerAddress && (
                              <p className="text-sm text-muted-foreground mt-1">{emp.employerAddress}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {emp.isCurrent ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
                              <CheckCircle className="h-3 w-3" />
                              Current
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded">
                              <XCircle className="h-3 w-3" />
                              Former
                            </span>
                          )}
                          {emp.salary && (
                            <p className="text-sm font-mono mt-2">{formatCurrency(emp.salary)}/yr</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No employment records on file</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">Bank Accounts</CardTitle>
              <Button variant="ghost" size="sm" data-testid="button-add-bank">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </CardHeader>
            <CardContent>
              {bankLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : bankAccounts && bankAccounts.length > 0 ? (
                <div className="space-y-4">
                  {bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-4 rounded-md border"
                      data-testid={`bank-${account.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Landmark className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{account.bankName}</p>
                            <p className="text-sm text-muted-foreground capitalize">{account.accountType}</p>
                            {account.routingNumber && (
                              <p className="text-sm font-mono mt-1">Routing: {account.routingNumber}</p>
                            )}
                            {account.accountNumberLast4 && (
                              <p className="text-sm font-mono">Account: {maskAccountNumber(account.accountNumberLast4)}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {account.isVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded">
                              <Clock className="h-3 w-3" />
                              Unverified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No bank accounts on file</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">Payment History</CardTitle>
              <Button onClick={() => setShowAddPaymentDialog(true)} data-testid="button-add-payment-tab">
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : payments && payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Amount</th>
                        <th className="pb-3 pr-4">Method</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b last:border-0" data-testid={`payment-${payment.id}`}>
                          <td className="py-3 pr-4 text-sm">{formatDate(payment.paymentDate)}</td>
                          <td className="py-3 pr-4 text-sm font-mono font-medium">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="py-3 pr-4 text-sm uppercase">{payment.paymentMethod}</td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={payment.status} size="sm" />
                          </td>
                          <td className="py-3 pr-4 text-sm font-mono text-muted-foreground">
                            {payment.referenceNumber || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No payment history</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">Notes & Timeline</CardTitle>
              <Button onClick={() => setShowAddNoteDialog(true)} data-testid="button-add-note">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </CardHeader>
            <CardContent>
              {notesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : notes && notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 rounded-md border-l-4 border-l-primary bg-muted/30"
                      data-testid={`note-${note.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground capitalize">
                          {note.noteType}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(note.createdDate)}</span>
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No notes on this account</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>Add a note to this debtor's account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="noteType">Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger id="noteType" data-testid="select-note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="promise">Promise to Pay</SelectItem>
                  <SelectItem value="dispute">Dispute</SelectItem>
                  <SelectItem value="skip">Skip Trace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="noteContent">Note</Label>
              <Textarea
                id="noteContent"
                placeholder="Enter your note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                data-testid="input-note-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNoteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addNoteMutation.mutate({ content: noteContent, noteType })}
              disabled={!noteContent || addNoteMutation.isPending}
              data-testid="button-save-note"
            >
              {addNoteMutation.isPending ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment for this account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentAmount">Amount ($)</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod" data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addPaymentMutation.mutate({
                  amount: Math.round(parseFloat(paymentAmount) * 100),
                  paymentMethod,
                })
              }
              disabled={!paymentAmount || addPaymentMutation.isPending}
              data-testid="button-save-payment"
            >
              {addPaymentMutation.isPending ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
