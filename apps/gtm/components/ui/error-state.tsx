/**
 * Error State Components
 * 
 * Reusable error states for various failure scenarios.
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, WifiOff, Lock, ServerCrash, Clock } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

/**
 * Generic error state
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className || ''}`}>
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  )
}

/**
 * Network error state
 */
export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Connection issue"
      description="Unable to connect. Please check your internet connection and try again."
      onRetry={onRetry}
    />
  )
}

/**
 * Not found error state
 */
export function NotFoundState({
  resource = 'item',
  backHref,
}: {
  resource?: string
  backHref?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Not found</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        The {resource} you're looking for doesn't exist or has been removed.
      </p>
      {backHref && (
        <Button asChild variant="outline">
          <a href={backHref}>Go back</a>
        </Button>
      )}
    </div>
  )
}

/**
 * Authorization error state
 */
export function UnauthorizedState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-amber-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Access denied</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        You don't have permission to access this resource.
      </p>
      <Button asChild variant="outline">
        <a href="/">Go to dashboard</a>
      </Button>
    </div>
  )
}

/**
 * Server error state
 */
export function ServerErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ServerCrash className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Server error</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        We're experiencing technical difficulties. Please try again later.
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  )
}

/**
 * Rate limit error state
 */
export function RateLimitState({
  resetTime,
  onSignup,
}: {
  resetTime?: Date
  onSignup?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
        <Clock className="w-8 h-8 text-amber-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Limit reached</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        You've reached your daily limit.
        {resetTime && ` Resets ${resetTime.toLocaleTimeString()}.`}
      </p>
      {onSignup && (
        <Button onClick={onSignup}>
          Sign up for unlimited access
        </Button>
      )}
    </div>
  )
}

/**
 * Generation failed error state
 */
export function GenerationFailedState({
  error,
  onRetry,
}: {
  error?: string
  onRetry?: () => void
}) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Generation Failed
        </CardTitle>
        <CardDescription>
          {error || 'Unable to generate content. Please try again.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Validation failed error state
 */
export function ValidationFailedState({
  errors,
  onRetry,
}: {
  errors?: string[]
  onRetry?: () => void
}) {
  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle className="text-amber-500 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Validation Issue
        </CardTitle>
        <CardDescription>
          Please fix the following issues:
        </CardDescription>
      </CardHeader>
      <CardContent>
        {errors && errors.length > 0 && (
          <ul className="list-disc list-inside text-sm text-muted-foreground mb-4 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        )}
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
