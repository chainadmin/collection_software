import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileUp, FileDown, Upload, Download, FileText, CheckCircle, Plus, ArrowRight, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Portfolio, Client } from "@shared/schema";

export default function ImportExport() {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("accounts");
  const [importClientId, setImportClientId] = useState("");
  const [importPortfolioId, setImportPortfolioId] = useState("");
  const [createNewPortfolio, setCreateNewPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [fileNumberStart, setFileNumberStart] = useState("1");
  const [exportType, setExportType] = useState("accounts");
  const [exportPortfolio, setExportPortfolio] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  
  const [importStep, setImportStep] = useState<"select" | "mapping" | "preview">("select");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [selectedSchemaId, setSelectedSchemaId] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [showSaveSchemaDialog, setShowSaveSchemaDialog] = useState(false);
  
  const [savedSchemas, setSavedSchemas] = useState<{name: string; mappings: Record<string, string>}[]>(() => {
    try {
      const stored = localStorage.getItem("debtflow_schema_mappings");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [
      { name: "Standard Account Import", mappings: { "Account Number": "accountNumber", "First Name": "firstName", "Last Name": "lastName", "Balance": "currentBalance" } },
      { name: "Chase Format", mappings: { "ACCT_NUM": "accountNumber", "FNAME": "firstName", "LNAME": "lastName", "ORIG_BAL": "originalBalance", "CURR_BAL": "currentBalance" } },
    ];
  });

  const systemFields = [
    { value: "skip", label: "-- Skip --" },
    // Core Account Fields
    { value: "accountNumber", label: "Account Number" },
    { value: "fileNumber", label: "File Number" },
    { value: "firstName", label: "First Name" },
    { value: "lastName", label: "Last Name" },
    { value: "dateOfBirth", label: "Date of Birth" },
    { value: "ssn", label: "SSN (Full)" },
    { value: "ssnLast4", label: "SSN Last 4" },
    // Primary Address
    { value: "address", label: "Address" },
    { value: "city", label: "City" },
    { value: "state", label: "State" },
    { value: "zipCode", label: "ZIP Code" },
    // Balance & Status
    { value: "originalBalance", label: "Original Balance" },
    { value: "currentBalance", label: "Current Balance" },
    { value: "originalCreditor", label: "Original Creditor" },
    { value: "clientName", label: "Client Name" },
    { value: "status", label: "Status" },
    { value: "lastContactDate", label: "Last Contact Date" },
    { value: "nextFollowUpDate", label: "Next Follow Up Date" },
    { value: "chargeOffDate", label: "Charge Off Date" },
    { value: "clientId", label: "Client ID" },
    { value: "portfolioId", label: "Portfolio ID" },
    // Phone Numbers (up to 5)
    { value: "phone1", label: "Phone 1" },
    { value: "phone1Label", label: "Phone 1 Label" },
    { value: "phone2", label: "Phone 2" },
    { value: "phone2Label", label: "Phone 2 Label" },
    { value: "phone3", label: "Phone 3" },
    { value: "phone3Label", label: "Phone 3 Label" },
    { value: "phone4", label: "Phone 4" },
    { value: "phone4Label", label: "Phone 4 Label" },
    { value: "phone5", label: "Phone 5" },
    { value: "phone5Label", label: "Phone 5 Label" },
    // Email Addresses (up to 3)
    { value: "email1", label: "Email 1" },
    { value: "email1Label", label: "Email 1 Label" },
    { value: "email2", label: "Email 2" },
    { value: "email2Label", label: "Email 2 Label" },
    { value: "email3", label: "Email 3" },
    { value: "email3Label", label: "Email 3 Label" },
    // Employment Information
    { value: "employerName", label: "Employer Name" },
    { value: "employerPhone", label: "Employer Phone" },
    { value: "employerAddress", label: "Employer Address" },
    { value: "position", label: "Job Position/Title" },
    { value: "salary", label: "Salary (Annual)" },
    // Reference 1
    { value: "ref1Name", label: "Reference 1 Name" },
    { value: "ref1Relationship", label: "Reference 1 Relationship" },
    { value: "ref1Phone", label: "Reference 1 Phone" },
    { value: "ref1Address", label: "Reference 1 Address" },
    { value: "ref1City", label: "Reference 1 City" },
    { value: "ref1State", label: "Reference 1 State" },
    { value: "ref1ZipCode", label: "Reference 1 ZIP Code" },
    // Reference 2
    { value: "ref2Name", label: "Reference 2 Name" },
    { value: "ref2Relationship", label: "Reference 2 Relationship" },
    { value: "ref2Phone", label: "Reference 2 Phone" },
    { value: "ref2Address", label: "Reference 2 Address" },
    { value: "ref2City", label: "Reference 2 City" },
    { value: "ref2State", label: "Reference 2 State" },
    { value: "ref2ZipCode", label: "Reference 2 ZIP Code" },
    // Reference 3
    { value: "ref3Name", label: "Reference 3 Name" },
    { value: "ref3Relationship", label: "Reference 3 Relationship" },
    { value: "ref3Phone", label: "Reference 3 Phone" },
    { value: "ref3Address", label: "Reference 3 Address" },
    { value: "ref3City", label: "Reference 3 City" },
    { value: "ref3State", label: "Reference 3 State" },
    { value: "ref3ZipCode", label: "Reference 3 ZIP Code" },
    { value: "ref1Notes", label: "Reference 1 Notes" },
    { value: "ref2Notes", label: "Reference 2 Notes" },
    { value: "ref3Notes", label: "Reference 3 Notes" },
    // Legacy fields for backward compatibility
    { value: "phone", label: "Phone (Legacy)" },
    { value: "email", label: "Email (Legacy)" },
    // Custom Fields - store in customFields JSON using original column name
    { value: "custom1", label: "→ Custom Field (uses column name)" },
    { value: "custom2", label: "→ Custom Field 2" },
    { value: "custom3", label: "→ Custom Field 3" },
    { value: "custom4", label: "→ Custom Field 4" },
    { value: "custom5", label: "→ Custom Field 5" },
    { value: "custom6", label: "→ Custom Field 6" },
    { value: "custom7", label: "→ Custom Field 7" },
    { value: "custom8", label: "→ Custom Field 8" },
    { value: "custom9", label: "→ Custom Field 9" },
    { value: "custom10", label: "→ Custom Field 10" },
  ];

  const contactFields = [
    { value: "skip", label: "-- Skip --" },
    { value: "accountNumber", label: "Account Number (to match)" },
    { value: "ssn", label: "SSN (to match)" },
    { value: "phone", label: "Phone Number" },
    { value: "phoneLabel", label: "Phone Label" },
    { value: "email", label: "Email" },
    { value: "emailLabel", label: "Email Label" },
  ];

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: nextFileNumberData } = useQuery<{ nextFileNumber: number }>({
    queryKey: ["/api/import/next-file-number"],
  });

  useEffect(() => {
    if (nextFileNumberData?.nextFileNumber) {
      setFileNumberStart(nextFileNumberData.nextFileNumber.toString());
    }
  }, [nextFileNumberData]);

  const filteredPortfolios = importClientId 
    ? portfolios.filter(p => p.clientId === importClientId)
    : [];

  const createPortfolioMutation = useMutation({
    mutationFn: async (data: { name: string; clientId: string }) => {
      const res = await apiRequest("POST", "/api/portfolios", {
        name: data.name,
        clientId: data.clientId,
        purchaseDate: new Date().toISOString().split('T')[0],
        purchasePrice: 0,
        totalFaceValue: 0,
        totalAccounts: 0,
        status: "active",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setImportPortfolioId(data.id);
      setCreateNewPortfolio(false);
      setNewPortfolioName("");
      toast({ title: "Portfolio Created", description: `Portfolio "${data.name}" has been created.` });
    },
  });

  const parseCSV = (text: string): { columns: string[]; data: string[][] } => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return { columns: [], data: [] };
    
    const columns = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const data = lines.slice(1).map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
    
    return { columns, data };
  };

  const handleFileSelect = async (file: File | null) => {
    setImportFile(file);
    if (!file) {
      setCsvColumns([]);
      setCsvData([]);
      return;
    }

    const text = await file.text();
    const { columns, data } = parseCSV(text);
    setCsvColumns(columns);
    setCsvData(data);
    
    const initialMappings: Record<string, string> = {};
    columns.forEach(col => {
      initialMappings[col] = "skip";
    });
    setColumnMappings(initialMappings);
  };

  const handleContinueToMapping = () => {
    if (!importFile) {
      toast({ title: "Error", description: "Please select a file to import.", variant: "destructive" });
      return;
    }
    
    const requiresClientPortfolio = importType === "accounts" || importType === "contacts";
    
    if (requiresClientPortfolio && !importClientId) {
      toast({ title: "Error", description: "Please select a client.", variant: "destructive" });
      return;
    }
    if (requiresClientPortfolio && !importPortfolioId && !createNewPortfolio) {
      toast({ title: "Error", description: "Please select a portfolio or create a new one.", variant: "destructive" });
      return;
    }
    if (createNewPortfolio && !newPortfolioName.trim()) {
      toast({ title: "Error", description: "Please enter a name for the new portfolio.", variant: "destructive" });
      return;
    }

    if (createNewPortfolio) {
      createPortfolioMutation.mutate({ name: newPortfolioName, clientId: importClientId });
      return;
    }

    setImportStep("mapping");
  };

  const handleApplySchema = (schemaName: string) => {
    const schema = savedSchemas.find(s => s.name === schemaName);
    if (schema) {
      const newMappings = { ...columnMappings };
      csvColumns.forEach(col => {
        if (schema.mappings[col]) {
          newMappings[col] = schema.mappings[col];
        }
      });
      setColumnMappings(newMappings);
      setSelectedSchemaId(schemaName);
      toast({ title: "Schema Applied", description: `"${schemaName}" mappings have been applied.` });
    }
  };

  const handleSaveSchema = () => {
    if (!schemaName.trim()) {
      toast({ title: "Error", description: "Please enter a schema name.", variant: "destructive" });
      return;
    }
    const mappingsToSave = Object.fromEntries(
      Object.entries(columnMappings).filter(([_, val]) => val !== "skip")
    );
    const newSchemas = [...savedSchemas, { name: schemaName, mappings: mappingsToSave }];
    setSavedSchemas(newSchemas);
    localStorage.setItem("debtflow_schema_mappings", JSON.stringify(newSchemas));
    setSchemaName("");
    setShowSaveSchemaDialog(false);
    toast({ title: "Schema Saved", description: `"${schemaName}" has been saved for future use.` });
  };

  const importMutation = useMutation({
    mutationFn: async (data: { records: any[]; mappings: Record<string, string>; portfolioId: string; clientId: string; importType: string; fileNumberStart?: number }) => {
      const endpoint = data.importType === "contacts" ? "/api/import/contacts" : "/api/import/debtors";
      const res = await apiRequest("POST", endpoint, {
        portfolioId: data.portfolioId,
        clientId: data.clientId,
        records: data.records,
        mappings: data.mappings,
        fileNumberStart: data.fileNumberStart,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      toast({ 
        title: "Import Complete", 
        description: data.message || `Successfully imported records.` 
      });
      setImportStep("select");
      setImportFile(null);
      setCsvColumns([]);
      setCsvData([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "Import Failed", 
        description: error.message || "An error occurred during import.", 
        variant: "destructive" 
      });
    },
  });

  const handleImport = async () => {
    const records = csvData.map(row => {
      const record: Record<string, string> = {};
      csvColumns.forEach((col, idx) => {
        record[col] = row[idx] || "";
      });
      return record;
    });

    importMutation.mutate({
      records,
      mappings: columnMappings,
      portfolioId: importPortfolioId,
      clientId: importClientId,
      importType,
      fileNumberStart: parseInt(fileNumberStart) || 1,
    });
  };

  const handleExport = () => {
    toast({ 
      title: "Export Started", 
      description: `Exporting ${exportType} in ${exportFormat.toUpperCase()} format...` 
    });
  };

  const getFieldsForType = () => {
    if (importType === "contacts") return contactFields;
    return systemFields;
  };

  const handleDeleteSchema = (index: number) => {
    const newSchemas = savedSchemas.filter((_, i) => i !== index);
    setSavedSchemas(newSchemas);
    localStorage.setItem("debtflow_schema_mappings", JSON.stringify(newSchemas));
    toast({ title: "Schema Deleted" });
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
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          {importStep === "select" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload File
                  </CardTitle>
                  <CardDescription>Select a file and configure import settings</CardDescription>
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

                  {(importType === "accounts" || importType === "contacts") && (
                    <>
                      <div className="space-y-2">
                        <Label>Client *</Label>
                        <Select value={importClientId} onValueChange={(val) => {
                          setImportClientId(val);
                          setImportPortfolioId("");
                          setCreateNewPortfolio(false);
                        }}>
                          <SelectTrigger data-testid="select-import-client">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.length === 0 ? (
                              <SelectItem value="none" disabled>No clients available</SelectItem>
                            ) : (
                              clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Select the client these accounts belong to</p>
                      </div>

                      {importClientId && (
                        <div className="space-y-2">
                          <Label>Portfolio *</Label>
                          <Select 
                            value={createNewPortfolio ? "new" : importPortfolioId} 
                            onValueChange={(val) => {
                              if (val === "new") {
                                setCreateNewPortfolio(true);
                                setImportPortfolioId("");
                              } else {
                                setCreateNewPortfolio(false);
                                setImportPortfolioId(val);
                              }
                            }}
                          >
                            <SelectTrigger data-testid="select-import-portfolio">
                              <SelectValue placeholder="Select portfolio" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  Create New Portfolio
                                </div>
                              </SelectItem>
                              {filteredPortfolios.map((portfolio) => (
                                <SelectItem key={portfolio.id} value={portfolio.id}>{portfolio.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Accounts will be imported into this portfolio</p>
                        </div>
                      )}

                      {createNewPortfolio && (
                        <div className="space-y-2">
                          <Label>New Portfolio Name *</Label>
                          <Input 
                            value={newPortfolioName}
                            onChange={(e) => setNewPortfolioName(e.target.value)}
                            placeholder="Enter portfolio name"
                            data-testid="input-new-portfolio-name"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {importType === "accounts" && (
                    <div className="space-y-2">
                      <Label>File Number Starting At</Label>
                      <Input 
                        type="number"
                        min="1"
                        value={fileNumberStart}
                        onChange={(e) => setFileNumberStart(e.target.value)}
                        placeholder="1"
                        data-testid="input-file-number-start"
                      />
                      <p className="text-xs text-muted-foreground">
                        File numbers will be generated as FN-{new Date().getFullYear()}-{fileNumberStart.padStart(6, '0')}, FN-{new Date().getFullYear()}-{(parseInt(fileNumberStart) + 1 || 2).toString().padStart(6, '0')}, etc.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>File</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Input 
                        type="file" 
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
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

                  {importFile && csvColumns.length > 0 && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">File Preview</p>
                      <p className="text-xs text-muted-foreground">{csvColumns.length} columns, {csvData.length} rows detected</p>
                    </div>
                  )}

                  <Button 
                    onClick={handleContinueToMapping} 
                    disabled={!importFile || ((importType === "accounts" || importType === "contacts") && !importClientId)}
                    className="w-full" 
                    data-testid="button-continue-mapping"
                  >
                    Continue to Mapping
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

            </div>
          )}

          {importStep === "mapping" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Map Columns</CardTitle>
                <CardDescription>
                  Match your CSV columns to system fields. You can use a saved schema or create a new mapping.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Use Saved Schema (Optional)</Label>
                    <Select value={selectedSchemaId} onValueChange={handleApplySchema}>
                      <SelectTrigger data-testid="select-saved-schema">
                        <SelectValue placeholder="Select a schema to apply" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedSchemas.map((schema, idx) => (
                          <SelectItem key={idx} value={schema.name}>{schema.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSaveSchemaDialog(true)}
                    data-testid="button-save-new-schema"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Current Mapping
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-3 gap-4 p-3 bg-muted font-medium text-sm">
                    <span>CSV Column</span>
                    <span>Sample Data</span>
                    <span>Map To</span>
                  </div>
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {csvColumns.map((col, idx) => (
                      <div key={col} className="grid grid-cols-3 gap-4 p-3 items-center">
                        <span className="text-sm font-mono">{col}</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {csvData[0]?.[idx] || "-"}
                        </span>
                        <Select 
                          value={columnMappings[col] || "skip"} 
                          onValueChange={(val) => setColumnMappings({...columnMappings, [col]: val})}
                        >
                          <SelectTrigger data-testid={`select-mapping-${col}`}>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {getFieldsForType().map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setImportStep("select")} data-testid="button-back">
                    Back
                  </Button>
                  <Button onClick={handleImport} data-testid="button-import">
                    <Upload className="h-4 w-4 mr-2" />
                    Import {csvData.length} Records
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
      </Tabs>

      <Dialog open={showSaveSchemaDialog} onOpenChange={setShowSaveSchemaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Schema Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Schema Name</Label>
              <Input 
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                placeholder="e.g., Chase Format, Standard Import"
                data-testid="input-save-schema-name"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will save your current column mappings for reuse on future imports.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveSchemaDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSchema} data-testid="button-confirm-save-schema">Save Schema</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
