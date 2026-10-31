'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TaskListViewProps {
  basePath: string
  title: string
}

type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'cancelled'

interface TaskItem {
  id: string
  status: TaskStatus
  priority: string
  title: string
  createdAt: string
}

export function TaskListView({ basePath, title }: TaskListViewProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/sako/tasks')
        const data = await response.json()
        if (response.ok) {
          setTasks(data.tasks || [])
        }
      } catch (error) {
        console.error('Failed to load Sako tasks:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}

          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`${basePath}/${task.id}`}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40 transition-colors"
            >
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(task.createdAt).toLocaleString()}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {task.status.replace('_', ' ')}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
