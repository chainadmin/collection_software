import { useState, useEffect, useRef } from "react";
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
  Settings,
  Pencil,
  Calculator,
  Plus,
  Filter,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { lookupBin, getCardTypeFromNumber, type BinLookupResult } from "@/lib/bin-lookup";
import { Link } from "wouter";
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
import { RecordPaymentDialog } from "@/components/record-payment-dialog";
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
  PaymentCard,
  TimeClockEntry,
  DebtorReference,
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
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  
  // Additional info dialogs
  const [showAdditionalInfoDialog, setShowAdditionalInfoDialog] = useState(false);
  const [showAddEmploymentDialog, setShowAddEmploymentDialog] = useState(false);
  const [showAddReferenceDialog, setShowAddReferenceDialog] = useState(false);
  
  // Employment form state
  const [empEmployerName, setEmpEmployerName] = useState("");
  const [empEmployerPhone, setEmpEmployerPhone] = useState("");
  const [empEmployerAddress, setEmpEmployerAddress] = useState("");
  const [empPosition, setEmpPosition] = useState("");
  const [empSalary, setEmpSalary] = useState("");
  const [empIsCurrent, setEmpIsCurrent] = useState(true);
  
  // Reference form state
  const [refName, setRefName] = useState("");
  const [refRelationship, setRefRelationship] = useState("");
  const [refPhone, setRefPhone] = useState("");
  const [refAddress, setRefAddress] = useState("");
  const [refCity, setRefCity] = useState("");
  const [refState, setRefState] = useState("");
  const [refZipCode, setRefZipCode] = useState("");
  const [refNotes, setRefNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(true);
  const [pendingPaymentsOpen, setPendingPaymentsOpen] = useState(true);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardBillingZip, setCardBillingZip] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardType, setCardType] = useState("visa");
  const [binLookupResult, setBinLookupResult] = useState<BinLookupResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [paymentFrequency, setPaymentFrequency] = useState("one_time");
  const [specificPaymentDates, setSpecificPaymentDates] = useState("");
  const [showCallOutcomeDialog, setShowCallOutcomeDialog] = useState(false);
  const [clickedPhone, setClickedPhone] = useState("");
  const [showPaymentCalculator, setShowPaymentCalculator] = useState(false);
  const [calculatorMonths, setCalculatorMonths] = useState("12");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNoteRef = useRef<string>("");
  
  // Inline editing state
  const [showEditAddressDialog, setShowEditAddressDialog] = useState(false);
  const [showEditEmailDialog, setShowEditEmailDialog] = useState(false);
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<DebtorContact | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editContactValue, setEditContactValue] = useState("");
  const [editContactType, setEditContactType] = useState("phone");
  const [editContactLabel, setEditContactLabel] = useState("");
  
  // Bulk add state
  const [showBulkAddContactsDialog, setShowBulkAddContactsDialog] = useState(false);
  const [showBulkAddNotesDialog, setShowBulkAddNotesDialog] = useState(false);
  const [bulkContactsText, setBulkContactsText] = useState("");
  const [bulkNotesText, setBulkNotesText] = useState("");

  const { data: debtors, isLoading: debtorsLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: collectors, isLoading: collectorsLoading, isError: collectorsError } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const currentCollector = collectors?.find((c) => c.role === "collector") || collectors?.[0];
  const isReady = !collectorsLoading && currentCollector;
  const selectedDebtor = debtors?.find((d) => d.id === selectedDebtorId);

  const { data: activeTimeEntry } = useQuery<TimeClockEntry | null>({
    queryKey: ["/api/time-clock/active", currentCollector?.id],
    enabled: !!currentCollector,
  });

  const isClockedIn = !!activeTimeEntry;

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!currentCollector) throw new Error("No collector found");
      return apiRequest("POST", "/api/time-clock/clock-in", {
        collectorId: currentCollector.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/active", currentCollector?.id] });
      toast({ title: "Clocked in", description: "You are now on the clock." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clock in.", variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!currentCollector) throw new Error("No collector found");
      return apiRequest("POST", "/api/time-clock/clock-out", {
        collectorId: currentCollector.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/active", currentCollector?.id] });
      toast({ title: "Clocked out", description: "You are now off the clock." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clock out.", variant: "destructive" });
    },
  });

  const getClockDuration = () => {
    if (!activeTimeEntry) return null;
    const clockIn = new Date(activeTimeEntry.clockIn);
    const now = new Date();
    const diffMs = now.getTime() - clockIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const { data: contacts } = useQuery<DebtorContact[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "contacts"],
    enabled: !!selectedDebtorId,
  });

  const { data: employment } = useQuery<EmploymentRecord[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "employment"],
    enabled: !!selectedDebtorId,
  });

  const { data: references } = useQuery<DebtorReference[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "references"],
    enabled: !!selectedDebtorId,
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "bank-accounts"],
    enabled: !!selectedDebtorId,
  });

  const { data: paymentCards } = useQuery<PaymentCard[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "cards"],
    enabled: !!selectedDebtorId,
  });

  const { data: notes } = useQuery<Note[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "notes"],
    enabled: !!selectedDebtorId,
  });

  const { data: debtorPayments } = useQuery<Payment[]>({
    queryKey: ["/api/debtors", selectedDebtorId, "payments"],
    enabled: !!selectedDebtorId,
  });

  const lastPayment = debtorPayments
    ?.filter((p) => p.status === "processed")
    ?.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())?.[0];

  // Collection-specific statuses that can be worked
  const workableStatuses = ["newbiz", "1st_message", "final", "promise", "payments_pending", "open", "in_payment"];
  
  const workQueue = isReady
    ? (debtors
        ?.filter((d) => {
          const isWorkable = workableStatuses.includes(d.status);
          const isAssigned = d.assignedCollectorId === currentCollector.id;
          const matchesFilter = statusFilter === "all" || d.status === statusFilter;
          return isWorkable && isAssigned && matchesFilter;
        })
        ?.sort((a, b) => {
          if (!a.nextFollowUpDate && !b.nextFollowUpDate) return 0;
          if (!a.nextFollowUpDate) return 1;
          if (!b.nextFollowUpDate) return -1;
          return new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
        }) ?? [])
    : [];
    
  // Get counts for status filter dropdown
  const getStatusCounts = () => {
    if (!debtors || !currentCollector) return {};
    return debtors.reduce((acc, d) => {
      if (d.assignedCollectorId === currentCollector.id && workableStatuses.includes(d.status)) {
        acc[d.status] = (acc[d.status] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  };
  const statusCounts = getStatusCounts();
  
  // Color mapping for collection statuses
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      newbiz: "bg-blue-500",
      "1st_message": "bg-cyan-500",
      final: "bg-orange-500",
      promise: "bg-yellow-500",
      payments_pending: "bg-green-500",
      decline: "bg-red-500",
      open: "bg-gray-500",
      in_payment: "bg-emerald-500",
      disputed: "bg-purple-500",
      settled: "bg-teal-500",
      closed: "bg-gray-400",
      bankruptcy: "bg-rose-600",
      legal: "bg-amber-600",
    };
    return colors[status] || "bg-gray-500";
  };
  
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "decline") return "destructive";
    if (status === "payments_pending" || status === "promise") return "default";
    return "secondary";
  };

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
    mutationFn: async (data: { debtorId: string; amount: number; paymentMethod: string; cardId?: string }) => {
      if (!currentCollector) throw new Error("No collector found");
      return apiRequest("POST", `/api/debtors/${data.debtorId}/payments`, {
        debtorId: data.debtorId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        paymentDate: new Date().toISOString().split("T")[0],
        status: "pending",
        processedBy: currentCollector.id,
        cardId: data.cardId,
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

  const addCardMutation = useMutation({
    mutationFn: async (data: { debtorId: string; cardType: string; cardNumber: string; cardNumberLast4: string; expiryMonth: string; expiryYear: string; cardholderName: string; billingZip: string; cvv: string }) => {
      return apiRequest("POST", `/api/debtors/${data.debtorId}/cards`, {
        cardType: data.cardType,
        cardNumber: data.cardNumber,
        cardNumberLast4: data.cardNumberLast4,
        expiryMonth: data.expiryMonth,
        expiryYear: data.expiryYear,
        cardholderName: data.cardholderName,
        billingZip: data.billingZip,
        cvv: data.cvv,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "cards"] });
      setShowCardDialog(false);
      setCardNumber("");
      setCardExpiry("");
      setCardHolderName("");
      setCardBillingZip("");
      setCardCvv("");
      setBinLookupResult(null);
      toast({ title: "Card added", description: "Payment card has been saved on file." });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: { contactId: string; updates: Partial<DebtorContact> }) => {
      return apiRequest("PATCH", `/api/contacts/${data.contactId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "contacts"] });
      setShowEditContactDialog(false);
      setEditingContact(null);
      toast({ title: "Contact updated", description: "Contact information saved." });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: { debtorId: string; type: string; value: string; label?: string }) => {
      return apiRequest("POST", `/api/debtors/${data.debtorId}/contacts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "contacts"] });
      setShowAddContactDialog(false);
      setEditContactValue("");
      setEditContactType("phone");
      setEditContactLabel("");
      toast({ title: "Contact added", description: "New contact added." });
    },
  });

  const addEmploymentMutation = useMutation({
    mutationFn: async (data: { debtorId: string; employerName: string; employerPhone?: string; employerAddress?: string; position?: string; salary?: number; isCurrent?: boolean }) => {
      return apiRequest("POST", `/api/debtors/${data.debtorId}/employment`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "employment"] });
      setShowAddEmploymentDialog(false);
      setEmpEmployerName("");
      setEmpEmployerPhone("");
      setEmpEmployerAddress("");
      setEmpPosition("");
      setEmpSalary("");
      setEmpIsCurrent(true);
      toast({ title: "Employment added", description: "Employment record saved." });
    },
  });

  const addReferenceMutation = useMutation({
    mutationFn: async (data: { debtorId: string; name: string; relationship?: string; phone?: string; address?: string; city?: string; state?: string; zipCode?: string; notes?: string }) => {
      return apiRequest("POST", `/api/debtors/${data.debtorId}/references`, {
        ...data,
        addedDate: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "references"] });
      setShowAddReferenceDialog(false);
      setRefName("");
      setRefRelationship("");
      setRefPhone("");
      setRefAddress("");
      setRefCity("");
      setRefState("");
      setRefZipCode("");
      setRefNotes("");
      toast({ title: "Reference added", description: "Reference record saved." });
    },
  });

  // Auto-save notes with debounce
  useEffect(() => {
    if (!quickNote.trim() || !selectedDebtorId || !currentCollector) {
      return;
    }
    if (quickNote === lastSavedNoteRef.current) {
      return;
    }
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(() => {
      if (quickNote.trim() && quickNote !== lastSavedNoteRef.current) {
        lastSavedNoteRef.current = quickNote;
        addNoteMutation.mutate({
          debtorId: selectedDebtorId,
          content: quickNote.trim(),
          noteType: "general",
        });
      }
    }, 3000); // Auto-save after 3 seconds of inactivity
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [quickNote, selectedDebtorId, currentCollector]);

  // Reset note when switching accounts
  useEffect(() => {
    setQuickNote("");
    lastSavedNoteRef.current = "";
  }, [selectedDebtorId]);

  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    setCardNumber(cleaned);
    
    if (cleaned.length >= 6) {
      const result = lookupBin(cleaned);
      setBinLookupResult(result);
      if (result.cardBrand) {
        const detectedType = getCardTypeFromNumber(cleaned);
        setCardType(detectedType);
      }
    } else {
      setBinLookupResult(null);
    }
  };

  const handleAddCard = () => {
    if (!selectedDebtorId || !cardNumber || !cardExpiry || !cardHolderName) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    
    const binResult = lookupBin(cardNumber);
    if (!binResult.isValid) {
      toast({ 
        title: "Card Validation Failed", 
        description: binResult.error || "Invalid card number", 
        variant: "destructive" 
      });
      return;
    }
    
    const cardNumberLast4 = cardNumber.slice(-4);
    const expiryParts = cardExpiry.split("/");
    if (expiryParts.length !== 2) {
      toast({ title: "Error", description: "Please enter expiry as MM/YY.", variant: "destructive" });
      return;
    }
    addCardMutation.mutate({
      debtorId: selectedDebtorId,
      cardType: binResult.cardBrand?.toLowerCase() || cardType,
      cardNumber,
      cardNumberLast4,
      expiryMonth: expiryParts[0],
      expiryYear: `20${expiryParts[1]}`,
      cardholderName: cardHolderName,
      billingZip: cardBillingZip,
      cvv: cardCvv,
    });
  };

  const handleStatusChange = (newStatus: string) => {
    if (!selectedDebtorId) return;
    updateDebtorMutation.mutate(
      {
        id: selectedDebtorId,
        updates: { status: newStatus },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
          toast({ title: "Status updated", description: `Account status changed to ${newStatus}.` });
        },
      }
    );
  };

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

  const openEditAddressDialog = () => {
    if (!selectedDebtor) return;
    setEditAddress(selectedDebtor.address || "");
    setEditCity(selectedDebtor.city || "");
    setEditState(selectedDebtor.state || "");
    setEditZipCode(selectedDebtor.zipCode || "");
    setShowEditAddressDialog(true);
  };

  const handleSaveAddress = () => {
    if (!selectedDebtorId) return;
    updateDebtorMutation.mutate(
      {
        id: selectedDebtorId,
        updates: {
          address: editAddress,
          city: editCity,
          state: editState,
          zipCode: editZipCode,
        },
      },
      {
        onSuccess: () => {
          setShowEditAddressDialog(false);
          toast({ title: "Address updated", description: "Address saved successfully." });
        },
      }
    );
  };

  const openEditEmailDialog = () => {
    if (!selectedDebtor) return;
    setEditEmail(selectedDebtor.email || "");
    setShowEditEmailDialog(true);
  };

  const handleSaveEmail = () => {
    if (!selectedDebtorId) return;
    updateDebtorMutation.mutate(
      {
        id: selectedDebtorId,
        updates: { email: editEmail },
      },
      {
        onSuccess: () => {
          setShowEditEmailDialog(false);
          toast({ title: "Email updated", description: "Email saved successfully." });
        },
      }
    );
  };

  const openEditContactDialog = (contact: DebtorContact) => {
    setEditingContact(contact);
    setEditContactValue(contact.value);
    setEditContactType(contact.type);
    setEditContactLabel(contact.label || "");
    setShowEditContactDialog(true);
  };

  const handleSaveContact = () => {
    if (!editingContact) return;
    updateContactMutation.mutate({
      contactId: editingContact.id,
      updates: {
        value: editContactValue,
        type: editContactType,
        label: editContactLabel,
      },
    });
  };

  const openAddContactDialog = () => {
    setEditContactValue("");
    setEditContactType("phone");
    setEditContactLabel("");
    setShowAddContactDialog(true);
  };

  const handleAddContact = () => {
    if (!selectedDebtorId || !editContactValue.trim()) return;
    addContactMutation.mutate({
      debtorId: selectedDebtorId,
      type: editContactType,
      value: editContactValue.trim(),
      label: editContactLabel || undefined,
    });
  };

  const handleBulkAddContacts = async () => {
    if (!selectedDebtorId || !bulkContactsText.trim()) return;
    const lines = bulkContactsText.split("\n").filter(line => line.trim());
    let addedCount = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Try to detect if it's a phone number or email
      const isEmail = trimmedLine.includes("@");
      const type = isEmail ? "email" : "phone";
      
      try {
        await apiRequest("POST", `/api/debtors/${selectedDebtorId}/contacts`, {
          debtorId: selectedDebtorId,
          type,
          value: trimmedLine,
        });
        addedCount++;
      } catch (error) {
        console.error("Failed to add contact:", trimmedLine);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "contacts"] });
    setShowBulkAddContactsDialog(false);
    setBulkContactsText("");
    toast({ title: "Contacts added", description: `Added ${addedCount} contact(s).` });
  };

  const handleBulkAddNotes = async () => {
    if (!selectedDebtorId || !bulkNotesText.trim() || !currentCollector) return;
    const lines = bulkNotesText.split("\n").filter(line => line.trim());
    let addedCount = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      try {
        await apiRequest("POST", `/api/debtors/${selectedDebtorId}/notes`, {
          debtorId: selectedDebtorId,
          content: trimmedLine,
          noteType: "general",
          collectorId: currentCollector.id,
          createdDate: new Date().toISOString().split("T")[0],
        });
        addedCount++;
      } catch (error) {
        console.error("Failed to add note:", trimmedLine);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "notes"] });
    setShowBulkAddNotesDialog(false);
    setBulkNotesText("");
    toast({ title: "Notes added", description: `Added ${addedCount} note(s).` });
  };

  const handleRecordPayment = async () => {
    if (!selectedDebtorId || !paymentAmount || !currentCollector) return;
    const amount = Math.round(parseFloat(paymentAmount) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid payment amount.", variant: "destructive" });
      return;
    }
    
    let cardIdToUse = selectedCardId;
    
    // If card payment with new card info, save the card first
    if (paymentMethod === "card" && (!selectedCardId || selectedCardId === "") && cardNumber) {
      if (cardNumber.length < 13) {
        toast({ title: "Error", description: "Please enter a valid card number.", variant: "destructive" });
        return;
      }
      
      const [expiryMonth, expiryYear] = cardExpiry.split("/");
      if (!expiryMonth || !expiryYear) {
        toast({ title: "Error", description: "Please enter expiry in MM/YY format.", variant: "destructive" });
        return;
      }
      
      try {
        const response = await apiRequest("POST", `/api/debtors/${selectedDebtorId}/cards`, {
          debtorId: selectedDebtorId,
          cardType,
          cardNumber,
          cardNumberLast4: cardNumber.slice(-4),
          expiryMonth,
          expiryYear: `20${expiryYear}`,
          cardholderName: cardHolderName,
          billingZip: cardBillingZip,
          cvv: cardCvv,
        });
        const newCard = await response.json();
        cardIdToUse = newCard.id;
        queryClient.invalidateQueries({ queryKey: ["/api/debtors", selectedDebtorId, "cards"] });
      } catch (error) {
        toast({ title: "Error", description: "Failed to save card.", variant: "destructive" });
        return;
      }
    }
    
    addPaymentMutation.mutate({
      debtorId: selectedDebtorId,
      amount,
      paymentMethod,
      cardId: cardIdToUse || undefined,
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
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Work Queue</h2>
            <div className="flex items-center gap-2">
              {currentCollector && (
                <Badge variant="secondary" className="text-xs">
                  @{currentCollector.username}
                </Badge>
              )}
              <Link href="/admin/reporting/dashboard">
                <Button size="icon" variant="ghost" className="h-7 w-7" data-testid="button-admin-settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mb-2">
            {isClockedIn ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => clockOutMutation.mutate()}
                disabled={clockOutMutation.isPending}
                className="flex-1"
                data-testid="button-clock-out"
              >
                <Clock className="h-4 w-4 mr-1" />
                Clock Out
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending || !isReady}
                className="flex-1"
                data-testid="button-clock-in"
              >
                <Clock className="h-4 w-4 mr-1" />
                Clock In
              </Button>
            )}
            {isClockedIn && (
              <Badge variant="outline" className="text-xs font-mono">
                {getClockDuration()}
              </Badge>
            )}
          </div>
          <div className="mb-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-work-by-status">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Work By Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})</SelectItem>
                <SelectItem value="newbiz">New Business ({statusCounts["newbiz"] || 0})</SelectItem>
                <SelectItem value="1st_message">1st Message ({statusCounts["1st_message"] || 0})</SelectItem>
                <SelectItem value="final">Final ({statusCounts["final"] || 0})</SelectItem>
                <SelectItem value="promise">Promise ({statusCounts["promise"] || 0})</SelectItem>
                <SelectItem value="payments_pending">Payments Pending ({statusCounts["payments_pending"] || 0})</SelectItem>
                <SelectItem value="open">Open ({statusCounts["open"] || 0})</SelectItem>
                <SelectItem value="in_payment">In Payment ({statusCounts["in_payment"] || 0})</SelectItem>
              </SelectContent>
            </Select>
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
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(debtor.status)}`} />
                      <span className="font-medium text-sm">
                        {debtor.firstName} {debtor.lastName}
                      </span>
                    </div>
                    <Badge variant={getStatusBadgeVariant(debtor.status)} className="text-xs capitalize">
                      {debtor.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs pl-4">
                    <span className="font-mono">{formatCurrency(debtor.currentBalance)}</span>
                    <span className={getPriorityColor(debtor)}>
                      {debtor.nextFollowUpDate ? formatDate(debtor.nextFollowUpDate) : "No follow-up"}
                    </span>
                  </div>
                  {debtor.fileNumber && (
                    <p className="text-xs text-muted-foreground pl-4 font-mono">{debtor.fileNumber}</p>
                  )}
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
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold">
                      {selectedDebtor.firstName} {selectedDebtor.lastName}
                    </h1>
                    <Select
                      value={selectedDebtor.status}
                      onValueChange={handleStatusChange}
                      disabled={!isReady}
                    >
                      <SelectTrigger className="w-[160px] h-8" data-testid="select-status">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getStatusColor(selectedDebtor.status)}`} />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newbiz">New Business</SelectItem>
                        <SelectItem value="1st_message">1st Message</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                        <SelectItem value="promise">Promise</SelectItem>
                        <SelectItem value="payments_pending">Payments Pending</SelectItem>
                        <SelectItem value="decline">Decline</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_payment">In Payment</SelectItem>
                        <SelectItem value="disputed">Disputed</SelectItem>
                        <SelectItem value="settled">Settled</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="bankruptcy">Bankruptcy</SelectItem>
                        <SelectItem value="legal">Legal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">File #: </span>
                      <span className="font-mono">{selectedDebtor.fileNumber || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Acct #: </span>
                      <span className="font-mono">{selectedDebtor.accountNumber}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SSN: </span>
                      <span className="font-mono">{selectedDebtor.ssn || `***-**-${selectedDebtor.ssnLast4 || "????"}`}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DOB: </span>
                      <span>{selectedDebtor.dateOfBirth ? formatDate(selectedDebtor.dateOfBirth) : "N/A"}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-muted-foreground">Address: </span>
                      <span>
                        {selectedDebtor.address 
                          ? `${selectedDebtor.address}, ${selectedDebtor.city || ""} ${selectedDebtor.state || ""} ${selectedDebtor.zipCode || ""}`.trim()
                          : "N/A"}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={openEditAddressDialog}
                        data-testid="button-edit-address"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Client: </span>
                      <span>{selectedDebtor.clientName || "N/A"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Original Creditor: </span>
                      <span>{selectedDebtor.originalCreditor || "N/A"}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold font-mono">{formatCurrency(selectedDebtor.currentBalance)}</p>
                  <p className="text-xs text-muted-foreground">
                    Original: {formatCurrency(selectedDebtor.originalBalance)}
                  </p>
                  {lastPayment && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last Pay: {formatCurrency(lastPayment.amount)} on {formatDate(lastPayment.paymentDate)}
                    </p>
                  )}
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
                variant="outline"
                onClick={() => setShowPaymentCalculator(true)}
                disabled={!isReady}
                data-testid="button-payment-calculator"
              >
                <Calculator className="h-4 w-4 mr-1" />
                Calculator
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAdditionalInfoDialog(true)}
                disabled={!isReady || !selectedDebtorId}
                data-testid="button-additional-info"
              >
                <FileText className="h-4 w-4 mr-1" />
                Additional Info
              </Button>
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
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Contact Information
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowBulkAddContactsDialog(true)}
                        data-testid="button-bulk-add-contacts"
                      >
                        Bulk Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={openAddContactDialog}
                        data-testid="button-add-contact"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contacts && contacts.length > 0 ? (
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                            data-testid={`contact-${contact.id}`}
                          >
                            <div
                              className={`flex items-center gap-3 flex-1 ${contact.type === "phone" ? "cursor-pointer hover-elevate rounded-md" : ""}`}
                              onClick={() => {
                                if (contact.type === "phone") {
                                  setClickedPhone(contact.value);
                                  setShowCallOutcomeDialog(true);
                                }
                              }}
                            >
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
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditContactDialog(contact);
                                }}
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {contact.type === "phone" && (
                                <Phone className="h-4 w-4 text-primary" />
                              )}
                            </div>
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
                        <div className="flex justify-end mb-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAddEmploymentDialog(true);
                            }}
                            data-testid="button-add-employment"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
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

                <Collapsible open={referencesOpen} onOpenChange={setReferencesOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover-elevate rounded-t-lg">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            References
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${referencesOpen ? "rotate-90" : ""}`}
                          />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="flex justify-end mb-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAddReferenceDialog(true);
                            }}
                            data-testid="button-add-reference"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                        {references && references.length > 0 ? (
                          <div className="space-y-2">
                            {references.map((ref) => (
                              <div key={ref.id} className="p-3 rounded-md bg-muted/50" data-testid={`card-reference-${ref.id}`}>
                                <div className="flex items-center justify-between">
                                  <p className="font-medium" data-testid={`text-reference-name-${ref.id}`}>{ref.name}</p>
                                  {ref.relationship && (
                                    <Badge variant="secondary" className="text-xs">{ref.relationship}</Badge>
                                  )}
                                </div>
                                {ref.phone && (
                                  <p className="text-xs font-mono mt-1" data-testid={`text-reference-phone-${ref.id}`}>{ref.phone}</p>
                                )}
                                {(ref.address || ref.city || ref.state) && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {[ref.address, ref.city, ref.state, ref.zipCode].filter(Boolean).join(", ")}
                                  </p>
                                )}
                                {ref.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">{ref.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No references on file</p>
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

                <Collapsible open={cardsOpen} onOpenChange={setCardsOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover-elevate rounded-t-lg">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Payment Cards
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${cardsOpen ? "rotate-90" : ""}`}
                          />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="mb-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCardDialog(true)}
                            disabled={!isReady}
                            data-testid="button-add-card"
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Add Card
                          </Button>
                        </div>
                        {paymentCards && paymentCards.length > 0 ? (
                          <div className="space-y-2">
                            {paymentCards.map((card) => (
                              <div key={card.id} className="p-3 rounded-md bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium capitalize">{card.cardType}</p>
                                  <Badge variant="secondary" className="text-xs font-mono">
                                    {card.cardNumber || `**** ${card.cardNumberLast4}`}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Exp: {card.expiryMonth}/{card.expiryYear} | {card.cardholderName}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No payment cards on file</p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <Collapsible open={pendingPaymentsOpen} onOpenChange={setPendingPaymentsOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer" data-testid="trigger-pending-payments">
                        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Pending Payments
                            {debtorPayments?.filter((p) => p.status === "pending").length ? (
                              <Badge variant="secondary" className="ml-1">
                                {debtorPayments.filter((p) => p.status === "pending").length}
                              </Badge>
                            ) : null}
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${pendingPaymentsOpen ? "rotate-90" : ""}`}
                          />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {debtorPayments?.filter((p) => p.status === "pending").length ? (
                          <div className="space-y-2">
                            {debtorPayments
                              .filter((p) => p.status === "pending")
                              .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
                              .map((payment) => (
                                <div
                                  key={payment.id}
                                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                                  data-testid={`pending-payment-${payment.id}`}
                                >
                                  <div>
                                    <p className="font-mono font-medium">{formatCurrency(payment.amount)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {payment.paymentMethod === "ach" && "ACH Transfer"}
                                      {payment.paymentMethod === "card" && "Credit/Debit Card"}
                                      {payment.paymentMethod === "check" && "Check"}
                                      {" "}• {payment.frequency === "one_time" ? "One-time" : payment.frequency}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm">{formatDate(payment.paymentDate)}</p>
                                    <StatusBadge status={payment.status} size="sm" />
                                  </div>
                                </div>
                              ))}
                            <p className="text-xs text-muted-foreground mt-2">
                              Total: {formatCurrency(debtorPayments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0))}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No pending payments scheduled</p>
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
                        <div className="flex justify-end mb-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowBulkAddNotesDialog(true)}
                            data-testid="button-bulk-add-notes"
                          >
                            Bulk Add Notes
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Add a quick note... (auto-saves after 3 seconds)"
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
                          {quickNote.trim() && quickNote !== lastSavedNoteRef.current && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                              Auto-saving...
                            </p>
                          )}
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

      {selectedDebtorId && selectedDebtor && currentCollector && (
        <RecordPaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          debtorId={selectedDebtorId}
          debtorName={`${selectedDebtor.firstName} ${selectedDebtor.lastName}`}
          collectorId={currentCollector.id}
        />
      )}

      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Card</DialogTitle>
            <DialogDescription>
              Add a card on file for{" "}
              {selectedDebtor && `${selectedDebtor.firstName} ${selectedDebtor.lastName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Card Type</label>
              <Select value={cardType} onValueChange={setCardType}>
                <SelectTrigger data-testid="select-card-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                  <SelectItem value="amex">American Express</SelectItem>
                  <SelectItem value="discover">Discover</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Card Number</label>
              <Input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                maxLength={19}
                data-testid="input-card-number"
              />
              {binLookupResult && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${binLookupResult.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {binLookupResult.isValid ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )}
                  <span>
                    {binLookupResult.isValid 
                      ? `${binLookupResult.cardBrand} - ${binLookupResult.issuer}`
                      : binLookupResult.error}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Expiry (MM/YY)</label>
                <Input
                  type="text"
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  maxLength={5}
                  data-testid="input-card-expiry"
                />
              </div>
              <div>
                <label className="text-sm font-medium">CVV</label>
                <Input
                  type="text"
                  placeholder="123"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                  maxLength={4}
                  data-testid="input-card-cvv"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Cardholder Name</label>
              <Input
                type="text"
                placeholder="John Doe"
                value={cardHolderName}
                onChange={(e) => setCardHolderName(e.target.value)}
                data-testid="input-cardholder-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Billing ZIP (optional)</label>
              <Input
                type="text"
                placeholder="12345"
                value={cardBillingZip}
                onChange={(e) => setCardBillingZip(e.target.value)}
                maxLength={10}
                data-testid="input-billing-zip"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCardDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCard}
              disabled={addCardMutation.isPending}
              data-testid="button-confirm-add-card"
            >
              {addCardMutation.isPending ? "Saving..." : "Save Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCallOutcomeDialog} onOpenChange={setShowCallOutcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call Outcome</DialogTitle>
            <DialogDescription>
              Record the outcome of your call to {clickedPhone}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground text-center">What was the result of your call?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleCallOutcome("connected");
                  setShowCallOutcomeDialog(false);
                }}
                data-testid="outcome-connected"
              >
                <PhoneIncoming className="h-4 w-4 mr-2" />
                Connected
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleCallOutcome("no_answer");
                  setShowCallOutcomeDialog(false);
                }}
                data-testid="outcome-no-answer"
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                No Answer
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleCallOutcome("voicemail");
                  setShowCallOutcomeDialog(false);
                }}
                data-testid="outcome-voicemail"
              >
                <Voicemail className="h-4 w-4 mr-2" />
                Voicemail
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleCallOutcome("busy");
                  setShowCallOutcomeDialog(false);
                }}
                data-testid="outcome-busy"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Busy
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleCallOutcome("wrong_number");
                  setShowCallOutcomeDialog(false);
                }}
                data-testid="outcome-wrong-number"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Wrong Number
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  handleCallOutcome("promise");
                  setShowCallOutcomeDialog(false);
                }}
                data-testid="outcome-promise"
              >
                <CalendarClock className="h-4 w-4 mr-2" />
                Promise
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCallOutcomeDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentCalculator} onOpenChange={setShowPaymentCalculator}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Calculator</DialogTitle>
            <DialogDescription>
              Calculate payment plans based on account balance
            </DialogDescription>
          </DialogHeader>
          {selectedDebtor && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-3xl font-bold font-mono">{formatCurrency(selectedDebtor.currentBalance)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Number of Months</label>
                <Input
                  type="number"
                  value={calculatorMonths}
                  onChange={(e) => setCalculatorMonths(e.target.value)}
                  min="1"
                  max="60"
                  data-testid="input-calculator-months"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Payment Plans:</p>
                <div className="grid gap-2">
                  <div className="p-3 rounded-md bg-muted/50 flex justify-between">
                    <span className="text-sm">Full Payment:</span>
                    <span className="font-mono font-medium">{formatCurrency(selectedDebtor.currentBalance)}</span>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 flex justify-between">
                    <span className="text-sm">{calculatorMonths} Monthly Payments:</span>
                    <span className="font-mono font-medium">{formatCurrency(Math.ceil(selectedDebtor.currentBalance / parseInt(calculatorMonths || "12")))}/mo</span>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 flex justify-between">
                    <span className="text-sm">50% Settlement:</span>
                    <span className="font-mono font-medium">{formatCurrency(Math.ceil(selectedDebtor.currentBalance * 0.5))}</span>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 flex justify-between">
                    <span className="text-sm">40% Settlement:</span>
                    <span className="font-mono font-medium">{formatCurrency(Math.ceil(selectedDebtor.currentBalance * 0.4))}</span>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 flex justify-between">
                    <span className="text-sm">25% Settlement:</span>
                    <span className="font-mono font-medium">{formatCurrency(Math.ceil(selectedDebtor.currentBalance * 0.25))}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentCalculator(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowPaymentCalculator(false);
              setShowPaymentDialog(true);
            }}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditAddressDialog} onOpenChange={setShowEditAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
            <DialogDescription>
              Update the debtor's address information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Street Address</label>
              <Input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="123 Main Street"
                data-testid="input-edit-address"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-sm font-medium">City</label>
                <Input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Austin"
                  data-testid="input-edit-city"
                />
              </div>
              <div>
                <label className="text-sm font-medium">State</label>
                <Input
                  type="text"
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  placeholder="TX"
                  maxLength={2}
                  data-testid="input-edit-state"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">ZIP Code</label>
              <Input
                type="text"
                value={editZipCode}
                onChange={(e) => setEditZipCode(e.target.value)}
                placeholder="78701"
                maxLength={10}
                data-testid="input-edit-zip"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAddressDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAddress} disabled={updateDebtorMutation.isPending}>
              {updateDebtorMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditEmailDialog} onOpenChange={setShowEditEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Email</DialogTitle>
            <DialogDescription>
              Update the debtor's email address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="example@email.com"
                data-testid="input-edit-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEmail} disabled={updateDebtorMutation.isPending}>
              {updateDebtorMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditContactDialog} onOpenChange={setShowEditContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={editContactType} onValueChange={setEditContactType}>
                <SelectTrigger data-testid="select-edit-contact-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Value</label>
              <Input
                type="text"
                value={editContactValue}
                onChange={(e) => setEditContactValue(e.target.value)}
                placeholder={editContactType === "phone" ? "(555) 123-4567" : "email@example.com"}
                data-testid="input-edit-contact-value"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Label (optional)</label>
              <Input
                type="text"
                value={editContactLabel}
                onChange={(e) => setEditContactLabel(e.target.value)}
                placeholder="Home, Work, Cell, etc."
                data-testid="input-edit-contact-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditContactDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveContact} disabled={updateContactMutation.isPending}>
              {updateContactMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new phone number or email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={editContactType} onValueChange={setEditContactType}>
                <SelectTrigger data-testid="select-add-contact-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Value</label>
              <Input
                type="text"
                value={editContactValue}
                onChange={(e) => setEditContactValue(e.target.value)}
                placeholder={editContactType === "phone" ? "(555) 123-4567" : "email@example.com"}
                data-testid="input-add-contact-value"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Label (optional)</label>
              <Input
                type="text"
                value={editContactLabel}
                onChange={(e) => setEditContactLabel(e.target.value)}
                placeholder="Home, Work, Cell, etc."
                data-testid="input-add-contact-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContactDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={addContactMutation.isPending}>
              {addContactMutation.isPending ? "Adding..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkAddContactsDialog} onOpenChange={setShowBulkAddContactsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add Contacts</DialogTitle>
            <DialogDescription>
              Add multiple phone numbers or emails, one per line. The system will auto-detect if each entry is a phone number or email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="(555) 123-4567&#10;(555) 987-6543&#10;email@example.com"
              value={bulkContactsText}
              onChange={(e) => setBulkContactsText(e.target.value)}
              className="min-h-[150px]"
              data-testid="textarea-bulk-contacts"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAddContactsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAddContacts} disabled={!bulkContactsText.trim()}>
              Add All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkAddNotesDialog} onOpenChange={setShowBulkAddNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add Notes</DialogTitle>
            <DialogDescription>
              Add multiple notes, one per line. Each line will be saved as a separate note.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="First note here&#10;Second note here&#10;Third note here"
              value={bulkNotesText}
              onChange={(e) => setBulkNotesText(e.target.value)}
              className="min-h-[150px]"
              data-testid="textarea-bulk-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAddNotesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAddNotes} disabled={!bulkNotesText.trim()}>
              Add All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddEmploymentDialog} onOpenChange={setShowAddEmploymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employment Record</DialogTitle>
            <DialogDescription>
              Add employer information for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Employer Name *</label>
              <Input
                value={empEmployerName}
                onChange={(e) => setEmpEmployerName(e.target.value)}
                placeholder="Company name"
                data-testid="input-employer-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={empEmployerPhone}
                onChange={(e) => setEmpEmployerPhone(e.target.value)}
                placeholder="Employer phone number"
                data-testid="input-employer-phone"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                value={empEmployerAddress}
                onChange={(e) => setEmpEmployerAddress(e.target.value)}
                placeholder="Employer address"
                data-testid="input-employer-address"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Position/Title</label>
              <Input
                value={empPosition}
                onChange={(e) => setEmpPosition(e.target.value)}
                placeholder="Job title"
                data-testid="input-employer-position"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Annual Salary</label>
              <Input
                type="number"
                value={empSalary}
                onChange={(e) => setEmpSalary(e.target.value)}
                placeholder="Annual salary"
                data-testid="input-employer-salary"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emp-is-current"
                checked={empIsCurrent}
                onChange={(e) => setEmpIsCurrent(e.target.checked)}
                data-testid="checkbox-employer-current"
              />
              <label htmlFor="emp-is-current" className="text-sm">Current employer</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEmploymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDebtorId && empEmployerName) {
                  addEmploymentMutation.mutate({
                    debtorId: selectedDebtorId,
                    employerName: empEmployerName,
                    employerPhone: empEmployerPhone || undefined,
                    employerAddress: empEmployerAddress || undefined,
                    position: empPosition || undefined,
                    salary: empSalary ? parseFloat(empSalary) : undefined,
                    isCurrent: empIsCurrent,
                  });
                }
              }}
              disabled={!empEmployerName || addEmploymentMutation.isPending}
              data-testid="button-save-employment"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddReferenceDialog} onOpenChange={setShowAddReferenceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reference</DialogTitle>
            <DialogDescription>
              Add a personal or professional reference for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={refName}
                onChange={(e) => setRefName(e.target.value)}
                placeholder="Reference name"
                data-testid="input-reference-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Relationship</label>
              <Select value={refRelationship} onValueChange={setRefRelationship}>
                <SelectTrigger data-testid="select-reference-relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="friend">Friend</SelectItem>
                  <SelectItem value="coworker">Coworker</SelectItem>
                  <SelectItem value="neighbor">Neighbor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={refPhone}
                onChange={(e) => setRefPhone(e.target.value)}
                placeholder="Phone number"
                data-testid="input-reference-phone"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                value={refAddress}
                onChange={(e) => setRefAddress(e.target.value)}
                placeholder="Street address"
                data-testid="input-reference-address"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">City</label>
                <Input
                  value={refCity}
                  onChange={(e) => setRefCity(e.target.value)}
                  placeholder="City"
                  data-testid="input-reference-city"
                />
              </div>
              <div>
                <label className="text-sm font-medium">State</label>
                <Input
                  value={refState}
                  onChange={(e) => setRefState(e.target.value)}
                  placeholder="State"
                  data-testid="input-reference-state"
                />
              </div>
              <div>
                <label className="text-sm font-medium">ZIP</label>
                <Input
                  value={refZipCode}
                  onChange={(e) => setRefZipCode(e.target.value)}
                  placeholder="ZIP"
                  data-testid="input-reference-zip"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={refNotes}
                onChange={(e) => setRefNotes(e.target.value)}
                placeholder="Additional notes about this reference"
                data-testid="textarea-reference-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddReferenceDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDebtorId && refName) {
                  addReferenceMutation.mutate({
                    debtorId: selectedDebtorId,
                    name: refName,
                    relationship: refRelationship || undefined,
                    phone: refPhone || undefined,
                    address: refAddress || undefined,
                    city: refCity || undefined,
                    state: refState || undefined,
                    zipCode: refZipCode || undefined,
                    notes: refNotes || undefined,
                  });
                }
              }}
              disabled={!refName || addReferenceMutation.isPending}
              data-testid="button-save-reference"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdditionalInfoDialog} onOpenChange={setShowAdditionalInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Additional Information</DialogTitle>
            <DialogDescription>
              Complete account details including contacts, employment, and references.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contacts ({contacts?.length || 0})
                </h3>
                <Button size="sm" variant="outline" onClick={() => { setShowAdditionalInfoDialog(false); setShowAddContactDialog(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              {contacts && contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="p-2 rounded bg-muted/50 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm">{contact.value}</span>
                        {contact.label && <Badge variant="outline" className="ml-2 text-xs">{contact.label}</Badge>}
                      </div>
                      <Badge variant="secondary" className="text-xs">{contact.type}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts on file</p>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Employment ({employment?.length || 0})
                </h3>
                <Button size="sm" variant="outline" onClick={() => { setShowAdditionalInfoDialog(false); setShowAddEmploymentDialog(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              {employment && employment.length > 0 ? (
                <div className="space-y-2">
                  {employment.map((record) => (
                    <div key={record.id} className="p-3 rounded bg-muted/50">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{record.employerName}</p>
                        {record.isCurrent && <Badge variant="secondary" className="text-xs">Current</Badge>}
                      </div>
                      {record.position && <p className="text-sm text-muted-foreground">{record.position}</p>}
                      {record.employerPhone && <p className="text-xs font-mono mt-1">{record.employerPhone}</p>}
                      {record.employerAddress && <p className="text-xs text-muted-foreground">{record.employerAddress}</p>}
                      {record.salary && <p className="text-xs text-muted-foreground">Salary: {formatCurrency(record.salary)}/year</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No employment records</p>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  References ({references?.length || 0})
                </h3>
                <Button size="sm" variant="outline" onClick={() => { setShowAdditionalInfoDialog(false); setShowAddReferenceDialog(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              {references && references.length > 0 ? (
                <div className="space-y-2">
                  {references.map((ref) => (
                    <div key={ref.id} className="p-3 rounded bg-muted/50">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{ref.name}</p>
                        {ref.relationship && <Badge variant="secondary" className="text-xs">{ref.relationship}</Badge>}
                      </div>
                      {ref.phone && <p className="text-xs font-mono mt-1">{ref.phone}</p>}
                      {(ref.address || ref.city || ref.state) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {[ref.address, ref.city, ref.state, ref.zipCode].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {ref.notes && <p className="text-xs text-muted-foreground mt-1 italic">{ref.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No references on file</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAdditionalInfoDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
