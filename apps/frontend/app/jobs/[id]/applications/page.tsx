'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';

export default function ApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [applications, setApplications] = useState<any[]>([]);
  const [job, setJob] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [screening, setScreening] = useState<Record<string, any>>({});
  const [screeningId, setScreeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.jobs.get(id), api.applications.list(id)])
      .then(([j, apps]) => { setJob(j); setApplications(apps); })
      .catch(e => setError(e.message))
      .finally(() => setFetching(false));
  }, [user, id]);

  async function triggerScreening(app: any) {
    setScreeningId(app.id);
    try {
      const result = await api.screening.screen({
        applicationId: app.id,
        jobTitle: job.title,
        jobDescription: job.description,
        jobRequirements: job.requirements,
        resumeText: app.resumeText || '(resume text not extracted)',
      });
      setScreening(s => ({ ...s, [app.id]: result }));
    } catch (err: any) {
      setScreening(s => ({ ...s, [app.id]: { error: err.message } }));
    } finally {
      setScreeningId(null);
    }
  }

  if (fetching) return <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3 mb-4" /></div>;
  if (error) return <div className="max-w-5xl mx-auto px-4 py-8 text-red-600">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-4">
        <Link href={`/jobs/${id}`} className="text-sm text-blue-600 hover:underline">&larr; Back to job</Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          {job && <p className="text-sm text-gray-500 mt-0.5">{job.title} · {job.company}</p>}
        </div>
        <Link
          href={`/jobs/${id}/ranked`}
          className="text-sm px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          AI Rankings
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📭</div>
          <p>No applications yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map(app => (
            <div key={app.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-gray-900">{app.candidateName || `Candidate #${app.id.slice(0, 8)}`}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{app.candidateEmail || 'No email'}</p>
                  {app.resumeUrl && (
                    <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                      View Resume
                    </a>
                  )}
                  {app.coverLetter && (
                    <p className="text-xs text-gray-500 mt-2 max-w-lg line-clamp-2">
                      <span className="font-medium">Cover letter:</span> {app.coverLetter}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => triggerScreening(app)}
                    disabled={screeningId === app.id}
                    className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {screeningId === app.id ? 'Screening…' : 'AI Screen'}
                  </button>
                  <Link
                    href={`/screen/${app.id}`}
                    className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    View Result
                  </Link>
                </div>
              </div>

              {screening[app.id] && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {screening[app.id].error ? (
                    <p className="text-sm text-red-600">{screening[app.id].error}</p>
                  ) : (
                    <ScreeningSummary result={screening[app.id]} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreeningSummary({ result }: { result: any }) {
  const score = result.matchScore ?? result.match_score;
  const rec = result.recommendation;
  const recColors: Record<string, string> = {
    strong_yes: 'bg-green-100 text-green-800',
    yes: 'bg-blue-100 text-blue-800',
    maybe: 'bg-yellow-100 text-yellow-800',
    no: 'bg-red-100 text-red-800',
  };

  return (
    <div className="flex items-start gap-6 flex-wrap">
      <div className="text-center">
        <div className={`text-2xl font-bold ${score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
          {score}
        </div>
        <div className="text-xs text-gray-500">/ 100</div>
      </div>
      {rec && (
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${recColors[rec] || 'bg-gray-100 text-gray-700'}`}>
          {rec.replace('_', ' ')}
        </span>
      )}
      {result.summary && (
        <p className="text-sm text-gray-700 flex-1">{result.summary}</p>
      )}
    </div>
  );
}
