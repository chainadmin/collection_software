import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Mail, Phone, DollarSign, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

export default function Clients() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [remittanceEmail, setRemittanceEmail] = useState("");
  const [remittanceFrequency, setRemittanceFrequency] = useState("monthly");
  const [remittanceMethod, setRemittanceMethod] = useState("check");

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Client Added", description: "New client has been added successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add client.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      return apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditingClient(null);
      resetForm();
      toast({ title: "Client Updated", description: "Client has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update client.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client Deleted", description: "Client has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCity("");
    setState("");
    setZipCode("");
    setRemittanceEmail("");
    setRemittanceFrequency("monthly");
    setRemittanceMethod("check");
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setContactName(client.contactName || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setAddress(client.address || "");
    setCity(client.city || "");
    setState(client.state || "");
    setZipCode(client.zipCode || "");
    setRemittanceEmail(client.remittanceEmail || "");
    setRemittanceFrequency(client.remittanceFrequency || "monthly");
    setRemittanceMethod(client.remittanceMethod || "check");
  };

  const handleSave = () => {
    if (!name) {
      toast({ title: "Error", description: "Please enter a client name.", variant: "destructive" });
      return;
    }

    const data = {
      name,
      contactName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      remittanceEmail,
      remittanceFrequency,
      remittanceMethod,
    };

    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const activeClients = clients.filter((c) => c.isActive);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-muted-foreground">Manage creditors and debt providers</p>
        </div>
        <Dialog open={showAddDialog || !!editingClient} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingClient(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-client">
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input 
                  placeholder="Enter client name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-client-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input 
                  placeholder="Primary contact"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  placeholder="client@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  placeholder="(555) 555-5555"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-phone"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address</Label>
                <Input 
                  placeholder="Street address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="input-address"
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input 
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  data-testid="input-city"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input 
                    placeholder="ST"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    data-testid="input-state"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input 
                    placeholder="12345"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    data-testid="input-zip"
                  />
                </div>
              </div>

              <div className="col-span-2 border-t pt-4 mt-2">
                <h3 className="font-medium mb-4">Remittance Settings</h3>
              </div>

              <div className="space-y-2">
                <Label>Remittance Email</Label>
                <Input 
                  placeholder="remittance@client.com"
                  type="email"
                  value={remittanceEmail}
                  onChange={(e) => setRemittanceEmail(e.target.value)}
                  data-testid="input-remittance-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Remittance Frequency</Label>
                <Select value={remittanceFrequency} onValueChange={setRemittanceFrequency}>
                  <SelectTrigger data-testid="select-remittance-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Remittance Method</Label>
                <Select value={remittanceMethod} onValueChange={setRemittanceMethod}>
                  <SelectTrigger data-testid="select-remittance-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH Transfer</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false);
                setEditingClient(null);
                resetForm();
              }}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                disabled={addMutation.isPending || updateMutation.isPending}
                data-testid="button-save-client"
              >
                {(addMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save Client"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-sm text-muted-foreground">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Building2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeClients.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">$0</p>
                <p className="text-sm text-muted-foreground">Pending Remittance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No clients found. Add your first client to get started.</p>
            </div>
          ) : (
            <div className="divide-y">
              {clients.map((client) => (
                <div 
                  key={client.id} 
                  className="flex items-center justify-between py-4"
                  data-testid={`row-client-${client.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{client.name}</p>
                        <Badge variant={client.isActive ? "default" : "secondary"}>
                          {client.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {client.contactName && <span>{client.contactName}</span>}
                        {client.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {client.remittanceFrequency === "weekly" && "Weekly"}
                      {client.remittanceFrequency === "bi_weekly" && "Bi-Weekly"}
                      {client.remittanceFrequency === "monthly" && "Monthly"}
                      {!client.remittanceFrequency && "Monthly"}
                    </Badge>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleEdit(client)}
                      data-testid={`button-edit-client-${client.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(client.id)}
                      data-testid={`button-delete-client-${client.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
