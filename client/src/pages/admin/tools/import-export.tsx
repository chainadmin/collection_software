import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileUp, FileDown, Upload, Download, FileText, CheckCircle, Settings, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Portfolio, Client } from "@shared/schema";

export default function ImportExport() {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("accounts");
  const [importClientId, setImportClientId] = useState("");
  const [importPortfolioId, setImportPortfolioId] = useState("");
  const [exportType, setExportType] = useState("accounts");
  const [exportPortfolio, setExportPortfolio] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  const [schemaName, setSchemaName] = useState("");
  const [savedSchemas, setSavedSchemas] = useState<{name: string; mappings: Record<string, string>}[]>([
    { name: "Standard Account Import", mappings: { "Account Number": "accountNumber", "First Name": "firstName", "Last Name": "lastName", "Balance": "currentBalance" } },
    { name: "Chase Format", mappings: { "ACCT_NUM": "accountNumber", "FNAME": "firstName", "LNAME": "lastName", "ORIG_BAL": "originalBalance", "CURR_BAL": "currentBalance" } },
  ]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});

  const systemFields = [
    { value: "", label: "-- Skip --" },
    { value: "accountNumber", label: "Account Number" },
    { value: "fileNumber", label: "File Number" },
    { value: "firstName", label: "First Name" },
    { value: "lastName", label: "Last Name" },
    { value: "email", label: "Email" },
    { value: "address", label: "Address" },
    { value: "city", label: "City" },
    { value: "state", label: "State" },
    { value: "zipCode", label: "ZIP Code" },
    { value: "dateOfBirth", label: "Date of Birth" },
    { value: "ssn", label: "SSN (Full)" },
    { value: "ssnLast4", label: "SSN Last 4" },
    { value: "originalBalance", label: "Original Balance" },
    { value: "currentBalance", label: "Current Balance" },
    { value: "originalCreditor", label: "Original Creditor" },
    { value: "clientName", label: "Client Name" },
    { value: "status", label: "Status" },
    { value: "lastContactDate", label: "Last Contact Date" },
  ];

  const sampleCsvColumns = ["ACCT_NUM", "FIRST_NAME", "LAST_NAME", "STREET", "CITY", "STATE", "ZIP", "BALANCE", "ORIG_BAL", "CREDITOR"];

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredPortfolios = importClientId 
    ? portfolios.filter(p => p.clientId === importClientId)
    : portfolios;

  const handleImport = () => {
    if (!importFile) {
      toast({ title: "Error", description: "Please select a file to import.", variant: "destructive" });
      return;
    }
    if (importType === "accounts" && !importPortfolioId) {
      toast({ title: "Error", description: "Please select a portfolio for account import.", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Import Started", 
      description: `Importing ${importType} from ${importFile.name}...` 
    });
  };

  const handleExport = () => {
    toast({ 
      title: "Export Started", 
      description: `Exporting ${exportType} in ${exportFormat.toUpperCase()} format...` 
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="text-muted-foreground">Bulk import and export account data</p>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import" data-testid="tab-import">
            <FileUp className="h-4 w-4 mr-2" />
            Import
          </TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-mapping">
            <Settings className="h-4 w-4 mr-2" />
            Schema Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload File
                </CardTitle>
                <CardDescription>Select a file to import data from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Import Type</Label>
                  <Select value={importType} onValueChange={setImportType}>
                    <SelectTrigger data-testid="select-import-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accounts">Debtor Accounts</SelectItem>
                      <SelectItem value="payments">Payment History</SelectItem>
                      <SelectItem value="contacts">Contact Information</SelectItem>
                      <SelectItem value="employment">Employment Records</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {importType === "accounts" && (
                  <>
                    <div className="space-y-2">
                      <Label>Client (Optional)</Label>
                      <Select value={importClientId} onValueChange={(val) => {
                        setImportClientId(val === "all" ? "" : val);
                        setImportPortfolioId("");
                      }}>
                        <SelectTrigger data-testid="select-import-client">
                          <SelectValue placeholder="All clients" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Clients</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Filter portfolios by client</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Target Portfolio *</Label>
                      <Select value={importPortfolioId} onValueChange={setImportPortfolioId}>
                        <SelectTrigger data-testid="select-import-portfolio">
                          <SelectValue placeholder="Select portfolio" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredPortfolios.length === 0 ? (
                            <SelectItem value="none" disabled>No portfolios available</SelectItem>
                          ) : (
                            filteredPortfolios.map((portfolio) => (
                              <SelectItem key={portfolio.id} value={portfolio.id}>{portfolio.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Accounts will be imported into this portfolio</p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>File</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Input 
                      type="file" 
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="import-file"
                      data-testid="input-import-file"
                    />
                    <label htmlFor="import-file" className="cursor-pointer">
                      <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-1">
                        {importFile ? importFile.name : "Click to select file"}
                      </p>
                      <p className="text-xs text-muted-foreground">CSV, XLSX supported</p>
                    </label>
                  </div>
                </div>

                <Button onClick={handleImport} disabled={!importFile} className="w-full" data-testid="button-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Start Import
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Import Templates</CardTitle>
                <CardDescription>Download sample templates for importing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {["Debtor Accounts", "Payment History", "Contact Info", "Employment"].map((template) => (
                  <div key={template} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{template} Template</span>
                    </div>
                    <Button variant="ghost" size="sm" data-testid={`button-download-${template.toLowerCase().replace(/\s+/g, "-")}`}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>Export account data for reporting or backup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Export Type</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger data-testid="select-export-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accounts">All Accounts</SelectItem>
                      <SelectItem value="payments">Payment History</SelectItem>
                      <SelectItem value="performance">Performance Report</SelectItem>
                      <SelectItem value="collector-summary">Collector Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Portfolio Filter</Label>
                  <Select value={exportPortfolio} onValueChange={setExportPortfolio}>
                    <SelectTrigger data-testid="select-export-portfolio">
                      <SelectValue placeholder="All Portfolios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Portfolios</SelectItem>
                      {portfolios.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger data-testid="select-export-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleExport} className="mt-4" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Exports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: "accounts_export_2024-12-15.csv", date: "Dec 15, 2024", size: "2.4 MB" },
                  { name: "payments_export_2024-12-10.xlsx", date: "Dec 10, 2024", size: "1.8 MB" },
                  { name: "performance_q4_2024.csv", date: "Dec 1, 2024", size: "456 KB" },
                ].map((file) => (
                  <div key={file.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{file.date} - {file.size}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Column Mapping
                </CardTitle>
                <CardDescription>
                  Map CSV columns to system fields for importing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  When you upload a CSV file, the system will detect the column headers.
                  Map each CSV column to the corresponding system field below.
                </p>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-2 gap-4 p-3 bg-muted font-medium text-sm">
                    <span>CSV Column</span>
                    <span>System Field</span>
                  </div>
                  <div className="divide-y max-h-80 overflow-y-auto">
                    {sampleCsvColumns.map((col) => (
                      <div key={col} className="grid grid-cols-2 gap-4 p-3 items-center">
                        <span className="text-sm font-mono">{col}</span>
                        <Select 
                          value={columnMappings[col] || ""} 
                          onValueChange={(val) => setColumnMappings({...columnMappings, [col]: val})}
                        >
                          <SelectTrigger data-testid={`select-mapping-${col}`}>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {systemFields.map((field) => (
                              <SelectItem key={field.value || "skip"} value={field.value || "skip"}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input 
                    placeholder="Schema name" 
                    value={schemaName}
                    onChange={(e) => setSchemaName(e.target.value)}
                    className="flex-1"
                    data-testid="input-schema-name"
                  />
                  <Button 
                    onClick={() => {
                      if (!schemaName) {
                        toast({ title: "Error", description: "Please enter a schema name.", variant: "destructive" });
                        return;
                      }
                      setSavedSchemas([...savedSchemas, { name: schemaName, mappings: columnMappings }]);
                      setSchemaName("");
                      toast({ title: "Schema Saved", description: `"${schemaName}" has been saved.` });
                    }}
                    data-testid="button-save-schema"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Schema
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Saved Schemas</CardTitle>
                <CardDescription>
                  Reuse saved column mappings for future imports
                </CardDescription>
              </CardHeader>
              <CardContent>
                {savedSchemas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No saved schemas yet.</p>
                    <p className="text-sm">Create a column mapping and save it.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedSchemas.map((schema, index) => (
                      <div key={schema.name} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{schema.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Object.keys(schema.mappings).length} field mappings
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setColumnMappings(schema.mappings);
                              toast({ title: "Schema Loaded", description: `"${schema.name}" mappings applied.` });
                            }}
                            data-testid={`button-load-schema-${index}`}
                          >
                            Load
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setSavedSchemas(savedSchemas.filter((_, i) => i !== index));
                              toast({ title: "Schema Deleted" });
                            }}
                            data-testid={`button-delete-schema-${index}`}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
