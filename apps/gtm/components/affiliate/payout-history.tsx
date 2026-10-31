'use client'

import { Badge } from '@/components/ui/badge'
import { DollarSign, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface Payout {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'paid' | 'failed'
  method: string
  created_at: string
  paid_at?: string
}

interface PayoutHistoryProps {
  payouts: Payout[]
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-amber-500',
    badge: 'secondary',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    color: 'text-blue-500',
    badge: 'secondary',
  },
  paid: {
    label: 'Paid',
    icon: CheckCircle2,
    color: 'text-green-500',
    badge: 'default',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-500',
    badge: 'destructive',
  },
}

export function PayoutHistory({ payouts }: PayoutHistoryProps) {
  if (payouts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No payout history yet</p>
        <p className="text-sm">Request your first payout when you reach $50</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Recent Payouts</h4>
      <div className="space-y-2">
        {payouts.map(payout => {
          const config = STATUS_CONFIG[payout.status]
          const StatusIcon = config.icon
          
          return (
            <div 
              key={payout.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-background ${config.color}`}>
                  <StatusIcon className={`h-4 w-4 ${payout.status === 'processing' ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="font-medium">${payout.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {payout.method} • {new Date(payout.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={config.badge as 'default' | 'secondary' | 'destructive'}>
                  {config.label}
                </Badge>
                {payout.paid_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Paid {new Date(payout.paid_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
