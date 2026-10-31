'use client'

/**
 * Purchase Dialog Component
 * 
 * Template purchase flow with Stripe checkout.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard,
  Lock,
  Check,
  Loader2,
  Sparkles,
  ShoppingCart,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/templates/paid-templates'

interface PurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: {
    id: string
    name: string
    description: string | null
    thumbnail_url: string | null
    price_cents: number
    creator_name?: string
  }
  onPurchaseComplete?: () => void
}

export function PurchaseDialog({
  open,
  onOpenChange,
  template,
  onPurchaseComplete,
}: PurchaseDialogProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [stage, setStage] = useState<'confirm' | 'processing' | 'success'>('confirm')

  const handlePurchase = async () => {
    setIsProcessing(true)
    setStage('processing')

    try {
      const response = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { checkoutUrl } = await response.json()

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl
    } catch (error) {
      console.error('Purchase error:', error)
      setStage('confirm')
      toast({
        title: 'Purchase failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const priceFormatted = formatPrice(template.price_cents)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {stage === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Purchase Template
              </DialogTitle>
              <DialogDescription>
                Get instant access to this premium template
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {/* Template Preview */}
              <div className="rounded-lg border overflow-hidden mb-4">
                {template.thumbnail_url ? (
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary/40" />
                  </div>
                )}
                <div className="p-3">
                  <h4 className="font-medium">{template.name}</h4>
                  {template.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {template.description}
                    </p>
                  )}
                  {template.creator_name && (
                    <p className="text-xs text-muted-foreground mt-2">
                      by {template.creator_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Template Price</span>
                  <span className="font-medium">{priceFormatted}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold text-primary">{priceFormatted}</span>
                </div>
              </div>

              {/* Benefits */}
              <div className="mt-4 space-y-2">
                {[
                  'Instant access to template',
                  'Lifetime license',
                  'Unlimited projects',
                  'Full customization rights',
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handlePurchase}
                disabled={isProcessing}
              >
                <CreditCard className="h-4 w-4" />
                Pay {priceFormatted}
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Secure payment via Stripe
              </div>
            </DialogFooter>
          </>
        )}

        {stage === 'processing' && (
          <div className="py-12 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="mx-auto w-12 h-12 mb-4"
            >
              <Loader2 className="h-12 w-12 text-primary" />
            </motion.div>
            <h3 className="font-medium mb-2">Preparing Checkout</h3>
            <p className="text-sm text-muted-foreground">
              Redirecting you to secure payment...
            </p>
          </div>
        )}

        {stage === 'success' && (
          <div className="py-12 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center"
            >
              <Check className="h-8 w-8 text-green-500" />
            </motion.div>
            <h3 className="font-medium mb-2">Purchase Complete!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You now have access to "{template.name}"
            </p>
            <Button onClick={() => onPurchaseComplete?.()}>
              <Sparkles className="h-4 w-4 mr-2" />
              Start Using Template
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Price badge for template cards
 */
interface PriceBadgeProps {
  priceCents: number | null
  className?: string
}

export function PriceBadge({ priceCents, className }: PriceBadgeProps) {
  const isFree = priceCents === null || priceCents === 0
  const price = formatPrice(priceCents)

  return (
    <Badge
      variant={isFree ? 'secondary' : 'default'}
      className={cn(
        isFree
          ? 'bg-green-500/10 text-emerald-500 hover:bg-green-500/20'
          : 'bg-primary',
        className
      )}
    >
      {price}
    </Badge>
  )
}

/**
 * Purchase button for template details
 */
interface PurchaseButtonProps {
  template: {
    id: string
    name: string
    description: string | null
    thumbnail_url: string | null
    price_cents: number | null
    creator_name?: string
  }
  isPurchased?: boolean
  onPurchaseComplete?: () => void
  className?: string
}

export function PurchaseButton({
  template,
  isPurchased,
  onPurchaseComplete,
  className,
}: PurchaseButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const isFree = template.price_cents === null || template.price_cents === 0

  if (isPurchased) {
    return (
      <Button disabled className={cn('gap-2', className)}>
        <Check className="h-4 w-4" />
        Purchased
      </Button>
    )
  }

  if (isFree) {
    return (
      <Button className={cn('gap-2', className)}>
        <Sparkles className="h-4 w-4" />
        Use Template
      </Button>
    )
  }

  return (
    <>
      <Button onClick={() => setDialogOpen(true)} className={cn('gap-2', className)}>
        <ShoppingCart className="h-4 w-4" />
        Buy for {formatPrice(template.price_cents)}
      </Button>

      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={{ ...template, price_cents: template.price_cents! }}
        onPurchaseComplete={() => {
          setDialogOpen(false)
          onPurchaseComplete?.()
        }}
      />
    </>
  )
}
