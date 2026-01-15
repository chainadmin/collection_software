import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ImportBatch() {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [paymentType, setPaymentType] = useState("ach");
  const [isProcessing, setIsProcessing] = useState(false);

  const recentImports = [
    { id: "1", filename: "ach_batch_dec_15.csv", date: "2024-12-15", records: 145, successful: 142, failed: 3, total: 8750000, status: "completed" },
    { id: "2", filename: "card_payments_dec_10.csv", date: "2024-12-10", records: 89, successful: 87, failed: 2, total: 4250000, status: "completed" },
    { id: "3", filename: "check_batch_dec_05.csv", date: "2024-12-05", records: 56, successful: 56, failed: 0, total: 2125000, status: "completed" },
  ];

  const handleImport = () => {
    if (!importFile) {
      toast({ title: "Error", description: "Please select a file to import.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      toast({ title: "Import Complete", description: `Successfully imported payments from ${importFile.name}` });
      setImportFile(null);
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import Payment Batch</h1>
        <p className="text-muted-foreground">Bulk import payment records from external sources</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Payment File
            </CardTitle>
            <CardDescription>Import payment records from CSV or Excel files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger data-testid="select-payment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ach">ACH Payments</SelectItem>
                    <SelectItem value="card">Card Payments</SelectItem>
                    <SelectItem value="check">Check Payments</SelectItem>
                    <SelectItem value="mixed">Mixed Batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" data-testid="input-effective-date" />
              </div>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Input 
                type="file" 
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
                id="payment-file"
                data-testid="input-payment-file"
              />
              <label htmlFor="payment-file" className="cursor-pointer">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  {importFile ? importFile.name : "Drop your file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">CSV or Excel files up to 10MB</p>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" data-testid="button-download-template">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!importFile || isProcessing}
                data-testid="button-import"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Payments
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Account number or file number</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Payment amount in cents</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Payment date (YYYY-MM-DD)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Reference number (optional)</span>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <span>Duplicate references will be skipped</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Imports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentImports.map((batch) => (
              <div key={batch.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`row-import-${batch.id}`}>
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{batch.filename}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(batch.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="font-medium">{batch.records}</p>
                    <p className="text-xs text-muted-foreground">Records</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-green-600">{batch.successful}</p>
                    <p className="text-xs text-muted-foreground">Success</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-red-600">{batch.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">{formatCurrency(batch.total)}</p>
                    <Badge variant="secondary" className="mt-1">Completed</Badge>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
