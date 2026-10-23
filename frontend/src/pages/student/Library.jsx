import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, AlertCircle } from 'lucide-react';

export default function StudentLibrary() {
  const { selectedSession, selectedTerm } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/student/library').then(r => {
      if (!active) return;
      setIssues(r.data.data.issues || []);
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedSession, selectedTerm]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Library</h1>
        <p className="text-slate-500 text-sm mt-1">Your issued books and dues</p>
      </div>

      {issues.length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No books issued to you currently</p>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map(issue => {
            const overdue = !issue.returnedOn && new Date(issue.dueOn) < new Date();
            return (
              <div key={issue._id} className={`card ${issue.returnedOn ? 'border-l-4 border-l-green-400' : overdue ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-blue-400'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{issue.bookId?.title || 'Unknown Book'}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      by {issue.bookId?.author || '—'} · ISBN: {issue.bookId?.isbn || '—'}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>Issued: {new Date(issue.issuedOn).toLocaleDateString()}</span>
                      <span>Due: {new Date(issue.dueOn).toLocaleDateString()}</span>
                      {issue.returnedOn && <span>Returned: {new Date(issue.returnedOn).toLocaleDateString()}</span>}
                    </div>
                    {issue.fine > 0 && (
                      <p className="text-sm text-red-600 font-medium mt-2">Fine: ₹{issue.fine}</p>
                    )}
                  </div>
                  <div>
                    {issue.returnedOn ? (
                      <span className="badge-green">Returned</span>
                    ) : overdue ? (
                      <span className="badge-red flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Overdue</span>
                    ) : (
                      <span className="badge-blue">Issued</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
