'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/*const handleLogout = () => {
  localStorage.removeItem('loggedInUser');
  router.push('/');
};
*/

export default function DashboardPage() {
  const [user, setUser] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
      // ログインしていなければログインページに戻す
      router.push('/login');
    } else {
      setUser(loggedInUser);
    }
  }, [router]);

  if (!user) return <p>Checking...</p>;

  return <h2>Hello, {user}!</h2>;
}