'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';

const REC_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  strong_yes: { label: 'Strong Yes', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  yes:        { label: 'Yes',         color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200' },
  maybe:      { label: 'Maybe',       color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  no:         { label: 'No',          color: 'text-red-700',   bg: 'bg-red-50 border-red-200' },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#16a34a' : score >= 50 ? '#ca8a04' : '#dc2626';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

export default function ScreeningResultPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { applicationId } = useParams<{ applicationId: string }>();
  const [result, setResult] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.screening.get(applicationId)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setFetching(false));
  }, [user, applicationId]);

  if (fetching) return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="h-24 w-24 bg-gray-200 rounded-full" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-full" />
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>
    </div>
  );

  if (!result) return null;

  const rec = REC_CONFIG[result.recommendation] || { label: result.recommendation, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Screening Report</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-6 flex-wrap mb-6">
          <ScoreRing score={result.matchScore} />
          <div>
            <div className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-semibold ${rec.bg} ${rec.color}`}>
              {rec.label}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Screened {new Date(result.screenedAt).toLocaleString()}
              {result.cached && ' · cached'}
            </p>
          </div>
        </div>

        {result.summary && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Summary</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {result.skillsMatch?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Matched Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {result.skillsMatch.map((s: string) => (
                  <span key={s} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          {result.missingSkills?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Missing Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.map((s: string) => (
                  <span key={s} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          {result.strengths?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Strengths</h2>
              <ul className="text-sm text-gray-700 space-y-1">
                {result.strengths.map((s: string) => (
                  <li key={s} className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {result.concerns?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Concerns</h2>
              <ul className="text-sm text-gray-700 space-y-1">
                {result.concerns.map((s: string) => (
                  <li key={s} className="flex items-start gap-2"><span className="text-red-400 mt-0.5">!</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
