'use client'

import { motion } from 'framer-motion'
import React from 'react'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

interface StaggerListProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}

export function StaggerList({ children, className, staggerDelay = 0.05 }: StaggerListProps) {
  const customContainer = {
    ...containerVariants,
    show: {
      ...containerVariants.show,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  }

  return (
    <motion.div
      variants={customContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={itemVariants}>{child}</motion.div>
      ))}
    </motion.div>
  )
}

interface StaggerGridProps {
  children: React.ReactNode
  className?: string
  columns?: number
}

export function StaggerGrid({ children, className, columns = 3 }: StaggerGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: '1rem',
      }}
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={itemVariants}>{child}</motion.div>
      ))}
    </motion.div>
  )
}
