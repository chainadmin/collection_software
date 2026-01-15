import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileUp, FileDown, Upload, Download, FileText, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Portfolio } from "@shared/schema";

export default function ImportExport() {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("accounts");
  const [exportType, setExportType] = useState("accounts");
  const [exportPortfolio, setExportPortfolio] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const handleImport = () => {
    if (!importFile) {
      toast({ title: "Error", description: "Please select a file to import.", variant: "destructive" });
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
      </Tabs>
    </div>
  );
}
