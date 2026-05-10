'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', remote: 'Remote',
};

export default function JobDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [applyFile, setApplyFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.jobs.get(id)
      .then(setJob)
      .catch(e => setError(e.message))
      .finally(() => setFetching(false));
  }, [user, id]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!applyFile) return;
    setApplyError('');
    setApplying(true);
    try {
      const fd = new FormData();
      fd.append('resume', applyFile);
      if (coverLetter) fd.append('coverLetter', coverLetter);
      await api.applications.apply(id, fd);
      setApplySuccess(true);
    } catch (err: any) {
      setApplyError(err.message || 'Application failed');
    } finally {
      setApplying(false);
    }
  }

  const isRecruiterOrAdmin = user?.role === 'recruiter' || user?.role === 'admin';

  if (fetching) return <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/2 mb-4" /><div className="h-4 bg-gray-200 rounded w-1/3" /></div>;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-8 text-red-600">{error}</div>;
  if (!job) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-4">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">&larr; Back to jobs</Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            <p className="text-gray-600 font-medium mt-1">{job.company}</p>
            {job.location && <p className="text-sm text-gray-400">{job.location}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full ${
              job.status === 'active' ? 'bg-green-100 text-green-700' :
              job.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {job.status}
            </span>
            {job.jobType && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                {JOB_TYPE_LABELS[job.jobType] || job.jobType}
              </span>
            )}
          </div>
        </div>

        {job.salaryMin && job.salaryMax && (
          <p className="mt-3 text-sm font-medium text-gray-700">
            ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()} / year
          </p>
        )}

        <div className="mt-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{job.description}</p>
        </div>

        <div className="mt-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Requirements</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{job.requirements}</p>
        </div>

        {isRecruiterOrAdmin && (
          <div className="mt-6 flex gap-3 pt-4 border-t border-gray-100">
            <Link
              href={`/jobs/${id}/edit`}
              className="text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit Job
            </Link>
            <Link
              href={`/jobs/${id}/applications`}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Applications
            </Link>
            <Link
              href={`/jobs/${id}/ranked`}
              className="text-sm px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              AI Rankings
            </Link>
          </div>
        )}
      </div>

      {user?.role === 'candidate' && job.status === 'active' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Apply for this position</h2>

          {applySuccess ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              Application submitted successfully! The recruiter will be in touch.
            </div>
          ) : (
            <form onSubmit={handleApply} className="space-y-4">
              {applyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{applyError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resume (PDF) *</label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={e => setApplyFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter (optional)</label>
                <textarea
                  rows={4}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell us why you're a great fit..."
                />
              </div>
              <button
                type="submit"
                disabled={applying || !applyFile}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {applying ? 'Submitting…' : 'Submit Application'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
