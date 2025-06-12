'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle,
  CreditCard,
  Loader2
} from 'lucide-react';

interface PaymentStatusProps {
  status: string;
  className?: string;
  showIcon?: boolean;
}

export function PaymentStatus({ 
  status, 
  className,
  showIcon = true 
}: PaymentStatusProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'succeeded':
      case 'paid':
        return {
          label: 'Paid',
          variant: 'default' as const,
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      
      case 'pending':
      case 'processing':
        return {
          label: 'Processing',
          variant: 'secondary' as const,
          icon: Loader2,
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return {
          label: 'Action Required',
          variant: 'secondary' as const,
          icon: AlertTriangle,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
      
      case 'failed':
      case 'canceled':
        return {
          label: 'Failed',
          variant: 'destructive' as const,
          icon: XCircle,
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      
      case 'open':
      case 'unpaid':
        return {
          label: 'Unpaid',
          variant: 'outline' as const,
          icon: Clock,
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
      
      case 'draft':
        return {
          label: 'Draft',
          variant: 'outline' as const,
          icon: CreditCard,
          className: 'bg-gray-100 text-gray-600 border-gray-200'
        };
      
      case 'void':
        return {
          label: 'Void',
          variant: 'outline' as const,
          icon: XCircle,
          className: 'bg-gray-100 text-gray-500 border-gray-200'
        };
      
      default:
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1),
          variant: 'outline' as const,
          icon: CreditCard,
          className: 'bg-gray-100 text-gray-600 border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      className={`${config.className} ${className || ''} flex items-center gap-1`}
    >
      {showIcon && (
        <Icon 
          className={`h-3 w-3 ${
            status.toLowerCase() === 'processing' || status.toLowerCase() === 'pending' 
              ? 'animate-spin' 
              : ''
          }`} 
        />
      )}
      {config.label}
    </Badge>
  );
} 