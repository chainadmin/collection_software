import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Collector } from "@shared/schema";

/** Lets any collector leave a note or timed reminder for another collector in the org - e.g. "call back at 3:00". */
export function LeaveAlertButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [toCollectorId, setToCollectorId] = useState("");
  const [message, setMessage] = useState("");
  const [remindAt, setRemindAt] = useState("");

  const { data: collectors } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
    enabled: open,
  });

  const sendAlert = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/alerts", {
        toCollectorId,
        message: message.trim(),
        remindAt: remindAt ? new Date(remindAt).toISOString() : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reminder sent", description: "They'll see it next time they're online." });
      setOpen(false);
      setToCollectorId("");
      setMessage("");
      setRemindAt("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send the reminder.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Leave a reminder" data-testid="button-leave-alert">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave a Reminder</DialogTitle>
          <DialogDescription>
            Leave a note or timed reminder for another collector. It pops up for them the moment it's due.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alert-recipient">For</Label>
            <Select value={toCollectorId} onValueChange={setToCollectorId}>
              <SelectTrigger id="alert-recipient" data-testid="select-alert-recipient">
                <SelectValue placeholder="Choose a collector" />
              </SelectTrigger>
              <SelectContent>
                {collectors?.filter((c) => !c.isSystemAccount && c.status === "active").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-message">Message</Label>
            <Textarea
              id="alert-message"
              placeholder='e.g. "Call back at 3:00" or "Spoke to dtr, not gonna pay"'
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              data-testid="input-alert-message"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-remind-at">Remind at (optional)</Label>
            <Input
              id="alert-remind-at"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              data-testid="input-alert-remind-at"
            />
            <p className="text-xs text-muted-foreground">Leave blank to pop up as soon as they're next online.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => sendAlert.mutate()}
            disabled={!toCollectorId || !message.trim() || sendAlert.isPending}
            data-testid="button-send-alert"
          >
            {sendAlert.isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
