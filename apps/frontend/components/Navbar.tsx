'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const isActive = (href: string) =>
    pathname.startsWith(href) ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              ARS
            </Link>
            {user && (
              <div className="hidden md:flex items-center gap-6 text-sm">
                <Link href="/jobs" className={isActive('/jobs')}>Jobs</Link>
                {(user.role === 'recruiter' || user.role === 'admin') && (
                  <Link href="/jobs/new" className={isActive('/jobs/new')}>Post Job</Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <span className="hidden sm:block text-gray-500">
                  {user.firstName} {user.lastName}
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                    {user.role}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-red-600 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
                <Link
                  href="/register"
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
