'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Eye, 
  DollarSign,
  Calendar,
  FileText,
  CreditCard
} from 'lucide-react';
import { PaymentStatus } from './PaymentStatus';

interface Invoice {
  id: string;
  number: string | null;
  status: string;
  amount: number;
  currency: string;
  created: number;
  dueDate?: number;
  paidAt?: number;
  description?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
  paymentIntent?: {
    status: string;
  };
}

interface InvoiceCardProps {
  invoice: Invoice;
  onDownload?: (invoiceId: string) => void;
  onViewDetails?: (invoiceId: string) => void;
  className?: string;
}

export function InvoiceCard({ 
  invoice, 
  onDownload, 
  onViewDetails,
  className 
}: InvoiceCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100); // Stripe amounts are in cents
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'void':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'draft':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isOverdue = () => {
    if (!invoice.dueDate || invoice.status === 'paid') return false;
    return Date.now() > (invoice.dueDate * 1000);
  };

  return (
    <Card className={`${className} ${isOverdue() ? 'border-red-200 bg-red-50/30' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            {/* Header */}
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    Invoice #{invoice.number || invoice.id}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getStatusColor(invoice.status)}`}
                  >
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                  {isOverdue() && (
                    <Badge variant="destructive" className="text-xs">
                      Overdue
                    </Badge>
                  )}
                </div>
                {invoice.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {invoice.description}
                  </p>
                )}
              </div>
            </div>

            {/* Amount and Payment Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-semibold">
                    {formatAmount(invoice.amount, invoice.currency)}
                  </span>
                </div>
                
                {invoice.paymentIntent && (
                  <PaymentStatus 
                    status={invoice.paymentIntent.status}
                    className="text-xs"
                  />
                )}
              </div>

              <div className="text-right text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Created: {formatDate(invoice.created)}</span>
                </div>
                {invoice.dueDate && (
                  <div className="flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    <span className={isOverdue() ? 'text-red-600' : ''}>
                      Due: {formatDate(invoice.dueDate)}
                    </span>
                  </div>
                )}
                {invoice.paidAt && (
                  <div className="flex items-center gap-1 mt-1">
                    <CreditCard className="h-3 w-3" />
                    <span className="text-green-600">
                      Paid: {formatDate(invoice.paidAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(invoice.id)}
                className="h-8 w-8 p-0"
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            
            {(invoice.invoicePdf || invoice.hostedInvoiceUrl) && onDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(invoice.id)}
                className="h-8 w-8 p-0"
                title="Download PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 