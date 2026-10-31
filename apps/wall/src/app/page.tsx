import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('sako_wall_session');

  if (session) {
    redirect('/wall');
  } else {
    redirect('/login');
  }
}
