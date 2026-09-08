import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatPhone } from "@/lib/utils";
import type { DebtorReference } from "@shared/schema";

type ReferenceDraft = {
  name: string;
  relationship: string;
  phone: string;
  phone2: string;
  phone3: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
};

const emptyReference = (): ReferenceDraft => ({
  name: "",
  relationship: "",
  phone: "",
  phone2: "",
  phone3: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  notes: "",
});

const draftFrom = (reference: DebtorReference): ReferenceDraft => ({
  name: reference.name,
  relationship: reference.relationship || "",
  phone: reference.phone || "",
  phone2: reference.phone2 || "",
  phone3: reference.phone3 || "",
  address: reference.address || "",
  city: reference.city || "",
  state: reference.state || "",
  zipCode: reference.zipCode || "",
  notes: reference.notes || "",
});

export function parseCustomFields(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function ReferenceEditor({
  debtorId,
  references,
}: {
  debtorId: string;
  references: DebtorReference[];
}) {
  const [editing, setEditing] = useState<DebtorReference | null | "new">(null);
  const [draft, setDraft] = useState<ReferenceDraft>(emptyReference());
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Reference name is required.");
      const data = {
        ...draft,
        name: draft.name.trim(),
        relationship: draft.relationship || null,
        phone: draft.phone || null,
        phone2: draft.phone2 || null,
        phone3: draft.phone3 || null,
        address: draft.address || null,
        city: draft.city || null,
        state: draft.state || null,
        zipCode: draft.zipCode || null,
        notes: draft.notes || null,
      };
      return editing === "new"
        ? apiRequest("POST", `/api/debtors/${debtorId}/references`, data)
        : apiRequest("PATCH", `/api/references/${editing!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "references"] });
      setEditing(null);
    },
    onError: (error: Error) => setError(error.message || "Unable to save reference."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/references/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "references"] }),
    onError: (error: Error) => setError(error.message || "Unable to remove reference."),
  });

  const open = (reference?: DebtorReference) => {
    setEditing(reference || "new");
    setDraft(reference ? draftFrom(reference) : emptyReference());
    setError("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">References</CardTitle>
        <Button size="sm" variant="outline" onClick={() => open()}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {references.length ? references.map((reference) => (
          <div key={reference.id} className="rounded-md border p-3">
            <div className="flex justify-between gap-2">
              <p className="font-medium">
                {reference.name}{" "}
                {reference.relationship && (
                  <span className="font-normal text-muted-foreground">({reference.relationship})</span>
                )}
              </p>
              <span className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => open(reference)} aria-label={`Edit ${reference.name}`}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remove reference ${reference.name}?`)) remove.mutate(reference.id);
                  }}
                  aria-label={`Remove ${reference.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </div>
            {[reference.phone, reference.phone2, reference.phone3].filter(Boolean).map((phone, index) => (
              <p key={index} className="font-mono text-sm">{formatPhone(phone!)}</p>
            ))}
            {[reference.address, reference.city, reference.state, reference.zipCode].some(Boolean) && (
              <p className="text-sm text-muted-foreground">
                {[reference.address, reference.city, reference.state, reference.zipCode].filter(Boolean).join(", ")}
              </p>
            )}
            {reference.notes && <p className="text-sm text-muted-foreground">{reference.notes}</p>}
          </div>
        )) : (
          <p className="py-4 text-center text-sm text-muted-foreground">No references on file</p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(openState) => { if (!openState) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add Reference" : "Edit Reference"}</DialogTitle>
            <DialogDescription>Blank optional values are explicitly cleared when saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(["name", "relationship", "phone", "phone2", "phone3", "address", "city", "state", "zipCode", "notes"] as const).map((field) => (
              <div key={field}>
                <Label htmlFor={`reference-${field}`}>
                  {field.replace(/([A-Z]|\d)/g, " $1").replace(/^./, (character) => character.toUpperCase())}
                  {field === "name" ? " *" : ""}
                </Label>
                <Input
                  id={`reference-${field}`}
                  value={draft[field]}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                />
              </div>
            ))}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => { setError(""); save.mutate(); }}>
              {save.isPending ? "Saving..." : "Save Reference"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function CustomFieldsEditor({
  debtorId,
  raw,
}: {
  debtorId: string;
  raw: string | null | undefined;
}) {
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [error, setError] = useState("");
  const fields = parseCustomFields(raw);

  const save = useMutation({
    mutationFn: (updated: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/debtors/${debtorId}`, {
        customFields: Object.keys(updated).length ? JSON.stringify(updated) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
      setNewName("");
      setNewValue("");
    },
    onError: (saveError: Error) => setError(saveError.message || "Unable to save custom fields."),
  });

  if (fields === null) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg font-medium">Custom Fields</CardTitle></CardHeader>
        <CardContent>
          <p role="alert" className="text-sm text-destructive">
            Custom fields contain invalid data and cannot be edited until corrected.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-medium">Custom Fields</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(fields).map(([name, value]) => (
          <div key={name} className="flex flex-wrap items-center gap-2 border-b pb-2">
            <span className="flex-1 break-all font-medium">{name}</span>
            {editing === name ? (
              <>
                <Input
                  className="flex-1"
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
                  aria-label={`${name} value`}
                />
                <Button
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => {
                    setError("");
                    save.mutate({ ...fields, [name]: editingValue }, { onSuccess: () => setEditing(null) });
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="flex-1 break-all text-muted-foreground">{String(value ?? "")}</span>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(name); setEditingValue(String(value ?? "")); }}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!confirm(`Remove custom field ${name}?`)) return;
                    const updated = { ...fields };
                    delete updated[name];
                    save.mutate(updated);
                  }}
                >
                  Remove
                </Button>
              </>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Input className="flex-1" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Field name" />
          <Input className="flex-1" value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder="Value" />
          <Button
            disabled={!newName.trim() || save.isPending}
            onClick={() => {
              const name = newName.trim();
              if (Object.keys(fields).some((key) => key.toLocaleLowerCase() === name.toLocaleLowerCase())) {
                setError("A field with that name already exists.");
                return;
              }
              setError("");
              save.mutate({ ...fields, [name]: newValue });
            }}
          >
            Add
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}