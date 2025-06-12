'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  FileText, 
  Download, 
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CreditCard,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useInvoiceHistory, Invoice } from '@/hooks/useInvoiceHistory';
import { InvoiceCard } from './InvoiceCard';

interface InvoiceHistoryProps {
  organizationId: string;
  className?: string;
  showFilters?: boolean;
}

export function InvoiceHistory({ 
  organizationId, 
  className,
  showFilters = true 
}: InvoiceHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { 
    invoiceData, 
    isLoading, 
    error, 
    refetch,
    fetchWithFilters
  } = useInvoiceHistory();

  const invoices = invoiceData?.invoices || [];
  const totalCount = invoiceData?.totalCount || 0;

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    // Note: Search functionality would need to be implemented in the API
    // For now, we'll just update the state
  };

  const handleStatusFilter = async (value: string) => {
    setStatusFilter(value);
    await fetchWithFilters({
      status: value === 'all' ? undefined : value,
      limit: 10
    });
  };

  const handleDownloadAll = async () => {
    try {
      // This would implement bulk download functionality
      console.log('Downloading all invoices...');
      // Implementation would depend on backend support
    } catch (error) {
      console.error('Failed to download invoices:', error);
    }
  };

  // Filter invoices locally based on search query
  const filteredInvoices = invoices.filter(invoice => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      invoice.number?.toLowerCase().includes(searchLower) ||
      invoice.description?.toLowerCase().includes(searchLower) ||
      invoice.id.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading && !invoiceData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load invoice history: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
            {totalCount !== undefined && (
              <Badge variant="outline" className="ml-2">
                {totalCount} invoice{totalCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={!filteredInvoices.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Download All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!filteredInvoices.length ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' 
                ? 'No invoices found matching your criteria.'
                : 'No invoices available yet.'
              }
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  refetch();
                }}
                className="mt-2"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Invoice List */}
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={{
                    ...invoice,
                    created: invoice.createdAt,
                    dueDate: invoice.dueDate || undefined,
                    paidAt: invoice.paidAt || undefined
                  }}
                  onDownload={(invoiceId: string) => {
                    console.log('Download invoice:', invoiceId);
                    // Implement download functionality
                  }}
                  onViewDetails={(invoiceId: string) => {
                    console.log('View invoice details:', invoiceId);
                    // Implement view details functionality
                  }}
                />
              ))}
            </div>

            {/* Load More */}
            {invoiceData?.hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Load more functionality could be implemented here
                    console.log('Load more invoices');
                  }}
                  disabled={isLoading}
                >
                  Load More Invoices
                </Button>
              </div>
            )}
          </>
        )}

        {/* Summary Stats */}
        {filteredInvoices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-medium">Total Paid</div>
                <div className="text-xs text-muted-foreground">This period</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-sm font-medium">Payment Methods</div>
                <div className="text-xs text-muted-foreground">On file</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
              <Calendar className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-sm font-medium">Next Invoice</div>
                <div className="text-xs text-muted-foreground">Estimated date</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 