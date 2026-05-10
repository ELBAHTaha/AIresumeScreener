'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  const isRecruiterOrAdmin = user.role === 'recruiter' || user.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user.firstName}
        </h1>
        <p className="text-gray-500 mt-1 capitalize">Signed in as {user.role}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/jobs"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">💼</div>
          <h2 className="text-lg font-semibold text-gray-900">Browse Jobs</h2>
          <p className="text-sm text-gray-500 mt-1">View all active job postings</p>
        </Link>

        {isRecruiterOrAdmin && (
          <>
            <Link
              href="/jobs/new"
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-3">➕</div>
              <h2 className="text-lg font-semibold text-gray-900">Post a Job</h2>
              <p className="text-sm text-gray-500 mt-1">Create a new job listing</p>
            </Link>
            <Link
              href="/jobs?status=draft"
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-3">📝</div>
              <h2 className="text-lg font-semibold text-gray-900">My Drafts</h2>
              <p className="text-sm text-gray-500 mt-1">Manage unpublished job posts</p>
            </Link>
          </>
        )}

        {user.role === 'candidate' && (
          <Link
            href="/jobs"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">📄</div>
            <h2 className="text-lg font-semibold text-gray-900">Apply Now</h2>
            <p className="text-sm text-gray-500 mt-1">Find and apply to open positions</p>
          </Link>
        )}
      </div>
    </div>
  );
}
