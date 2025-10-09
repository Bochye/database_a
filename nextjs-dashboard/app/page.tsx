import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard'); // デフォルトでこのページに飛ばされるので、app/loginにリダイレクト
  return;
}