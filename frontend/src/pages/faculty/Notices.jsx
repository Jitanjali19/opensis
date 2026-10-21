import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Bell, Pin } from 'lucide-react';

export default function FacultyNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/faculty/notices').then(r => {
      setNotices(r.data.data.notices);
      setLoading(false);
      api.post('/faculty/notices/mark-read', {}).catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Notices</h1>
        <p className="text-slate-500 text-sm mt-1">Announcements and updates from the administration</p>
      </div>

      {notices.length === 0 ? (
        <div className="card text-center py-12">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notices available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map(n => (
            <div key={n._id} className={`card ${n.isPinned ? 'border-l-4 border-l-primary-500' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800">{n.title}</h3>
                    {n.isPinned && <span className="badge-indigo flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{n.body}</p>
                  {Array.isArray(n.attachments) && n.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {n.attachments.map((attachment, index) => {
                        const href = attachment.startsWith('/') ? attachment : `/${attachment}`;
                        return (
                          <a key={index} href={href} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary-600 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-full hover:bg-primary-100 transition-colors">
                            View Attachment {index + 1}
                          </a>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span>{new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="capitalize badge-blue">{n.audience}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
