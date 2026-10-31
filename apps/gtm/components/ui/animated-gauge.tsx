'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedGaugeProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
}

const sizeConfig = {
  sm: { width: 80, strokeWidth: 6, fontSize: 'text-xl' },
  md: { width: 120, strokeWidth: 8, fontSize: 'text-3xl' },
  lg: { width: 160, strokeWidth: 10, fontSize: 'text-4xl' },
}

export function AnimatedGauge({
  value,
  max = 100,
  size = 'md',
  showLabel = true,
  label,
  className,
}: AnimatedGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100)
  const { width, strokeWidth, fontSize } = sizeConfig[size]
  const radius = (width - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const getColor = () => {
    if (percentage >= 80) return '#22c55e' // green-500
    if (percentage >= 60) return '#eab308' // yellow-500
    if (percentage >= 40) return '#f97316' // orange-500
    return '#ef4444' // red-500
  }

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        className="-rotate-90"
        width={width}
        height={width}
        viewBox={`0 0 ${width} ${width}`}
      >
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress arc */}
        <motion.circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference * (1 - percentage / 100),
          }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn('font-bold', fontSize)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {Math.round(value)}
        </motion.span>
        {showLabel && label && (
          <motion.span
            className="text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {label}
          </motion.span>
        )}
      </div>
    </div>
  )
}

interface LinearGaugeProps {
  value: number
  max?: number
  height?: number
  showValue?: boolean
  className?: string
}

export function AnimatedLinearGauge({
  value,
  max = 100,
  height = 8,
  showValue = true,
  className,
}: LinearGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const getColor = () => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-yellow-500'
    if (percentage >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className={className}>
      {showValue && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Trust Score</span>
          <motion.span
            className="font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {Math.round(value)}
          </motion.span>
        </div>
      )}
      <div
        className="bg-muted rounded-full overflow-hidden"
        style={{ height }}
      >
        <motion.div
          className={cn('h-full rounded-full', getColor())}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
