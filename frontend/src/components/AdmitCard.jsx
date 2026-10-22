import React from 'react';
import collegeLogo from '../pages/gslogo.png';

const CollegeLogo = () => (
  <img
    src={collegeLogo}
    alt="Shri G. S. Institute of Technology & Science, Indore logo"
    className="h-20 w-20 shrink-0 object-contain print:h-24 print:w-24"
  />
);

export default function AdmitCard({ card }) {
  if (!card) return null;

  return (
    <div
      className="bg-white mx-auto max-w-3xl border border-slate-300 p-8 print:border-none print:p-0"
      style={{ fontFamily: 'Times New Roman, serif' }}
    >
      <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
        <div className="flex items-center justify-center gap-4">
          <CollegeLogo />
          <div>
            <h2 className="text-xl font-bold text-slate-900 uppercase leading-tight">{card.college?.name}</h2>
            <p className="text-xs font-semibold text-slate-600 mt-1">{card.college?.address}</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-bold uppercase">{card.title}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-6">
        <div className="space-y-1.5 text-sm">
          <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-bold uppercase">Student ID</span><span className="font-mono">{card.student?.enrollmentNo}</span></div>
          <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-bold uppercase">Name</span><span className="font-semibold uppercase">{card.student?.name}</span></div>
          <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-bold uppercase">Class</span><span>{card.student?.classLabel}</span></div>
          <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-bold uppercase">Section</span><span>{card.student?.sectionName || '—'}</span></div>
          <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-bold uppercase">Semester</span><span>Semester {card.student?.semesterLabel}</span></div>
          <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-bold uppercase">Gender</span><span>{card.student?.gender || '—'}</span></div>
          <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-bold uppercase">Program Name</span><span className="uppercase">{card.student?.programName}</span></div>
        </div>
        <div className="flex flex-col items-center gap-1">
          {card.student?.profilePhotoUrl
            ? <img src={card.student.profilePhotoUrl} alt="Student" className="h-32 w-24 object-cover border border-slate-400" />
            : <div className="h-32 w-24 border border-slate-400 flex items-center justify-center text-[10px] text-slate-400">PHOTO</div>}
          {card.student?.signatureUrl && (
            <img src={card.student.signatureUrl} alt="Signature" className="h-8 object-contain" />
          )}
          <span className="text-[10px] text-slate-500">Signature</span>
        </div>
      </div>

      <table className="w-full border-collapse text-sm mt-5">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-800 px-3 py-2 text-left">SR NO</th>
            <th className="border border-slate-800 px-3 py-2 text-left">PAPER CODE</th>
            <th className="border border-slate-800 px-3 py-2 text-left">SUBJECT</th>
            <th className="border border-slate-800 px-3 py-2 text-center">SUBJECT TYPE</th>
          </tr>
        </thead>
        <tbody>
          {(card.exam?.entries || []).map((entry, index) => (
            <tr key={index}>
              <td className="border border-slate-700 px-3 py-1.5">{entry.srNo || index + 1}</td>
              <td className="border border-slate-700 px-3 py-1.5 font-mono">{entry.paperCode || '—'}</td>
              <td className="border border-slate-700 px-3 py-1.5 uppercase">{entry.subjectName || '—'}</td>
              <td className="border border-slate-700 px-3 py-1.5 text-center capitalize">{entry.subjectType || 'theory'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <h3 className="font-bold uppercase text-sm">IMPORTANT INSTRUCTIONS</h3>
        <p className="font-semibold text-sm mt-2">Time : {card.exam?.timeNote || 'As per Time Table'}</p>
        <ol className="list-decimal ml-5 mt-2 space-y-1 text-xs leading-relaxed">
          {(card.instructions || []).map((line, index) => <li key={index}>{line}</li>)}
        </ol>
      </div>

      <div className="mt-10 flex items-end justify-between text-xs">
        <span className="font-semibold uppercase">(Exams)</span>
        <div className="text-center">
          <div className="w-44 border-b border-slate-500 mb-1" />
          <p className="font-bold uppercase">Controller (Exams)</p>
          <p className="uppercase">{card.college?.name}</p>
        </div>
      </div>
    </div>
  );
}
