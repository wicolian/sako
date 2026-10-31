import { DynamicSidebar } from '@/components/dynamic-sidebar'
import { SidebarInset } from '@/components/ui/sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DynamicSidebar>
      <SidebarInset className="flex flex-1 flex-col overflow-hidden">
        {children}
      </SidebarInset>
    </DynamicSidebar>
  )
}
