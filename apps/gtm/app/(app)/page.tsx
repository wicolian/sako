import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const cookieStore = await cookies()
  const viewPreference = cookieStore.get('sako-view-preference')?.value

  if (viewPreference === 'advanced') {
    redirect('/dashboard')
  }

  redirect('/import')
}
