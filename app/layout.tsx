import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import './portal.css';
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });
export const metadata: Metadata = { title: 'APX RIDE | Executive Operations Portal', description: 'Private booking, dispatch, quoting and earnings workspace for APX RIDE.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className="dark"><body className={manrope.variable}>{children}</body></html>; }
