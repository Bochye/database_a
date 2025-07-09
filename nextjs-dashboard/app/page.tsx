import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/login'); // デフォルトでこのページに飛ばされるので、app/loginにリダイレクト
  return;
}