'use client';
import Link from 'next/link'; 
import { usePathname } from 'next/navigation'; 
import { LayoutDashboard, MessageSquare, Network, Archive, WalletCards, Settings, Radio } from 'lucide-react'; 
import { Brand } from '../Brand'; 
import { SignOutButton } from '../auth/SignOutButton';
import { PersonalAssistantDrawer } from '@/components/chat/PersonalAssistantDrawer';
import { useEffect, useState } from 'react';

const nav=[['/holding','Holding HQ',LayoutDashboard],['/holding/discussion','Discussion Room',MessageSquare],['/holding/personal-ai','Personal AI',Radio],['/hq/boardroom','NEVU Boardroom',Network],['/holding/portfolio','Portfolio',WalletCards],['/holding/archive','Archive',Archive],['/network','NEVU Network',Radio],['/holding/settings','Settings',Settings]] as const;

export function AppShell({children,username='Administrator',holdingName='Your Holding'}:{children:React.ReactNode;username?:string;holdingName?:string}){
  const p = usePathname(); 
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070a0de8] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 md:px-6">
          <Brand/>
          <div className="hidden md:block text-center">
            <div className="text-xs muted">WELCOME CEO OF</div>
            <div className="font-medium">{holdingName}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge">● {username}</span>
            <SignOutButton/>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px] gap-4 px-3 py-4 md:px-6">
        <aside className="glass hidden w-60 shrink-0 rounded-2xl p-2 md:block">
          <div className="px-3 pb-3 pt-2 text-[10px] uppercase tracking-[.25em] muted">NEVU HQ</div>
          {nav.map(([href,label,Icon]) => {
            const isActive = mounted && p === href;
            return (
              <Link 
                key={href} 
                href={href} 
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive?'bg-white/10 text-white':'muted hover:bg-white/5 hover:text-white'}`}
              >
                <Icon size={17}/>{label}
              </Link>
            );
          })}
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <nav className="fixed bottom-3 left-3 right-3 z-40 flex justify-around rounded-2xl border border-white/10 bg-[#0b1015ee] p-2 backdrop-blur-xl md:hidden">
        {nav.slice(0,5).map(([href,label,Icon]) => {
          const isActive = mounted && p === href;
          return (
            <Link 
              key={href} 
              href={href} 
              className={`flex flex-col items-center gap-1 px-2 py-1 text-[9px] ${isActive?'text-white':'muted'}`}
            >
              <Icon size={17}/>{label.split(' ')[0]}
            </Link>
          );
        })}
      </nav>
      <PersonalAssistantDrawer />
    </div>
  );
}