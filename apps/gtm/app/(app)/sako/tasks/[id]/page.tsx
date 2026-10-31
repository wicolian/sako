import { TaskDetailView } from '@/components/sako/task-detail-view'

export default async function SakoTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TaskDetailView taskId={id} operatorMode={false} />
}
