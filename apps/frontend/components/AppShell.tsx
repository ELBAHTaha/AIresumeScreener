'use client';

import { AuthProvider } from './AuthContext';
import Navbar from './Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      <main className="flex-1">{children}</main>
    </AuthProvider>
  );
}
