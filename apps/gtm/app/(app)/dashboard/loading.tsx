import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl space-y-10 p-6 md:p-8">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm">
            <CardContent className="p-8 md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.35fr,0.85fr]">
                <div className="space-y-6">
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-5 w-2/3 mt-4" />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Skeleton className="h-12 w-36 rounded-xl" />
                    <Skeleton className="h-12 w-40 rounded-xl" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 pt-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-32 rounded-2xl" />
                    ))}
                  </div>
                </div>
                <div>
                  <Card className="h-full border-border/50 bg-background/60">
                    <CardContent className="flex h-full flex-col gap-6 p-6">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      <div className="grid gap-3">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-16 rounded-2xl" />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
