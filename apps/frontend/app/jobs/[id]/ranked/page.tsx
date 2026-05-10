'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';

const REC_COLORS: Record<string, string> = {
  strong_yes: 'bg-green-100 text-green-800 border-green-200',
  yes: 'bg-blue-100 text-blue-800 border-blue-200',
  maybe: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  no: 'bg-red-100 text-red-800 border-red-200',
};

const REC_FILTERS = ['all', 'strong_yes', 'yes', 'maybe', 'no'];

export default function RankedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [recFilter, setRecFilter] = useState('all');
  const [minScore, setMinScore] = useState('');

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  function fetchRanked() {
    if (!user) return;
    setFetching(true);
    const params: Record<string, any> = {};
    if (recFilter !== 'all') params.recommendation = recFilter;
    if (minScore) params.minScore = minScore;

    Promise.all([api.jobs.get(id), api.screening.ranked(id, params)])
      .then(([j, d]) => { setJob(j); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setFetching(false));
  }

  useEffect(() => { fetchRanked(); }, [user, id, recFilter, minScore]);

  const scoreColor = (s: number) =>
    s >= 70 ? 'text-green-600' : s >= 50 ? 'text-yellow-600' : 'text-red-600';

  if (error) return <div className="max-w-5xl mx-auto px-4 py-8 text-red-600">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-4">
        <Link href={`/jobs/${id}/applications`} className="text-sm text-blue-600 hover:underline">&larr; Back to applications</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI-Ranked Candidates</h1>
        {job && <p className="text-sm text-gray-500 mt-0.5">{job.title} · {job.company}</p>}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {REC_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setRecFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors capitalize ${
                recFilter === f ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Min score:</label>
          <input
            type="number"
            min="0" max="100"
            value={minScore}
            onChange={e => setMinScore(e.target.value)}
            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
      </div>

      {fetching ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !data?.data?.length ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🤖</div>
          <p>No screened candidates yet.</p>
          <p className="text-sm mt-1">Run AI screening from the Applications page first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((result: any, idx: number) => (
            <div key={result.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className={`text-3xl font-bold ${scoreColor(result.matchScore)}`}>
                      {result.matchScore}
                    </span>
                    <span className="text-sm text-gray-400">/ 100</span>
                    {result.recommendation && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${REC_COLORS[result.recommendation] || 'bg-gray-100 text-gray-700'}`}>
                        {result.recommendation.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {result.summary && (
                    <p className="text-sm text-gray-700 mb-3">{result.summary}</p>
                  )}

                  <div className="flex gap-6 flex-wrap">
                    {result.skillsMatch?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Matched Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {result.skillsMatch.map((s: string) => (
                            <span key={s} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.missingSkills?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Missing Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {result.missingSkills.map((s: string) => (
                            <span key={s} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <Link
                  href={`/screen/${result.applicationId}`}
                  className="text-sm text-blue-600 hover:underline shrink-0"
                >
                  Full report
                </Link>
              </div>
            </div>
          ))}

          {data.totalPages > 1 && (
            <p className="text-sm text-center text-gray-500 pt-2">
              Showing page 1 of {data.totalPages} · {data.total} total
            </p>
          )}
        </div>
      )}
    </div>
  );
}
