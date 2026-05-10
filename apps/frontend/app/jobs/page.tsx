'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';

const STATUS_TABS = ['active', 'draft', 'closed'] as const;

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  remote: 'Remote',
};

function JobsList() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const status = searchParams.get('status') || 'active';

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    api.jobs.list(status)
      .then(setJobs)
      .catch(e => setError(e.message))
      .finally(() => setFetching(false));
  }, [user, status]);

  const isRecruiterOrAdmin = user?.role === 'recruiter' || user?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        {isRecruiterOrAdmin && (
          <Link
            href="/jobs/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Post Job
          </Link>
        )}
      </div>

      {isRecruiterOrAdmin && (
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => router.push(`/jobs?status=${tab}`)}
              className={`pb-3 px-1 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                status === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6">{error}</div>
      )}

      {fetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📭</div>
          <p>No {status} jobs found.</p>
          {isRecruiterOrAdmin && (
            <Link href="/jobs/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
              Post your first job
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-base font-semibold text-gray-900 line-clamp-2">{job.title}</h2>
                <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full ${
                  job.status === 'active' ? 'bg-green-100 text-green-700' :
                  job.status === 'draft'  ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {job.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 font-medium">{job.company}</p>
              {job.location && <p className="text-xs text-gray-400 mt-0.5">{job.location}</p>}
              <p className="text-xs text-gray-500 mt-3 line-clamp-3 flex-1">{job.description}</p>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {job.jobType && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                  </span>
                )}
                {job.salaryMin && job.salaryMax && (
                  <span className="text-xs text-gray-500">
                    ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/4" /></div>}>
      <JobsList />
    </Suspense>
  );
}
