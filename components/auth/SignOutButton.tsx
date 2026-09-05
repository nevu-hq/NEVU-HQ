'use client'; import {LogOut} from 'lucide-react'; import {useRouter} from 'next/navigation'; import {createClient} from '@/lib/supabase/client';
export function SignOutButton(){const r=useRouter();return <button className="btn p-2" title="Sign out" onClick={async()=>{await createClient().auth.signOut();r.push('/login')}}><LogOut size={16}/></button>}
