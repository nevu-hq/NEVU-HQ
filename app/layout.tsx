import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title:'NEVU HQ', description:'NEVU HQ Unified Master System & Operating Framework' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
