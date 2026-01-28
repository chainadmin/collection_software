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

  const emails = {
    inbox: [] as any[],
    sent: [] as any[],
    scheduled: [] as any[],
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
                <p className="text-2xl font-bold">{emails.inbox.length}</p>
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
                <p className="text-2xl font-bold">{emails.inbox.filter((e: any) => e.status === "unread").length}</p>
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
                <p className="text-2xl font-bold">{emails.sent.length}</p>
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
                <p className="text-2xl font-bold">{emails.scheduled.length}</p>
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
            Inbox ({emails.inbox.length})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent">
            <Send className="h-4 w-4 mr-2" />
            Sent ({emails.sent.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            <Clock className="h-4 w-4 mr-2" />
            Scheduled ({emails.scheduled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {emails.inbox.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No messages in inbox</p>
                  </div>
                ) : null}
                {emails.inbox.map((email) => (
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
                {emails.sent.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No sent messages</p>
                  </div>
                ) : null}
                {emails.sent.map((email) => (
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
                {emails.scheduled.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No scheduled messages</p>
                  </div>
                ) : null}
                {emails.scheduled.map((email) => (
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
