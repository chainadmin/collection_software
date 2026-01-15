import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Send, Archive, Search, Mail, Clock, CheckCircle, AlertCircle, Trash2, Reply, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function EmailManage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const sampleEmails = {
    inbox: [
      { id: "1", from: "robert.williams@email.com", subject: "Payment arrangement request", date: "2024-12-15", status: "unread", account: "ACC-2024-00001" },
      { id: "2", from: "jennifer.martinez@email.com", subject: "Re: Account verification", date: "2024-12-14", status: "read", account: "ACC-2024-00002" },
      { id: "3", from: "amanda.brown@email.com", subject: "Dispute claim", date: "2024-12-12", status: "unread", account: "ACC-2024-00004" },
    ],
    sent: [
      { id: "4", to: "robert.williams@email.com", subject: "Payment reminder - ACC-2024-00001", date: "2024-12-14", status: "delivered", account: "ACC-2024-00001" },
      { id: "5", to: "david.thompson@email.com", subject: "Account status update", date: "2024-12-13", status: "delivered", account: "ACC-2024-00003" },
    ],
    scheduled: [
      { id: "6", to: "jennifer.martinez@email.com", subject: "Payment due reminder", scheduledDate: "2025-01-10", status: "scheduled", account: "ACC-2024-00002" },
    ],
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Management</h1>
          <p className="text-muted-foreground">Manage debtor communications</p>
        </div>
        <Button data-testid="button-compose">
          <Mail className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Inbox className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Inbox</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <AlertCircle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-muted-foreground">Unread</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Send className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-muted-foreground">Sent Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">1</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search emails..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 max-w-md"
          data-testid="input-search"
        />
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <Inbox className="h-4 w-4 mr-2" />
            Inbox ({sampleEmails.inbox.length})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent">
            <Send className="h-4 w-4 mr-2" />
            Sent ({sampleEmails.sent.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            <Clock className="h-4 w-4 mr-2" />
            Scheduled ({sampleEmails.scheduled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {sampleEmails.inbox.map((email) => (
                  <div 
                    key={email.id} 
                    className={`flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer ${email.status === "unread" ? "bg-primary/5 border-primary/20" : ""}`}
                    data-testid={`row-email-${email.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${email.status === "unread" ? "bg-primary" : "bg-transparent"}`} />
                      <div>
                        <p className={`${email.status === "unread" ? "font-semibold" : ""}`}>{email.from}</p>
                        <p className="text-sm text-muted-foreground">{email.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="font-mono text-xs">{email.account}</Badge>
                      <span className="text-sm text-muted-foreground">{formatDate(email.date)}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon">
                          <Reply className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {sampleEmails.sent.map((email) => (
                  <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`row-email-${email.id}`}>
                    <div className="flex items-center gap-4">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <p>To: {email.to}</p>
                        <p className="text-sm text-muted-foreground">{email.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="font-mono text-xs">{email.account}</Badge>
                      <span className="text-sm text-muted-foreground">{formatDate(email.date)}</span>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {sampleEmails.scheduled.map((email) => (
                  <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`row-email-${email.id}`}>
                    <div className="flex items-center gap-4">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p>To: {email.to}</p>
                        <p className="text-sm text-muted-foreground">{email.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="font-mono text-xs">{email.account}</Badge>
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(email.scheduledDate)}
                      </Badge>
                      <Button variant="ghost" size="sm">Cancel</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
