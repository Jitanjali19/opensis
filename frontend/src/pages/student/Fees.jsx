import React, { useEffect, useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../../api/axios';
import { CreditCard, CheckCircle, Clock, IndianRupee, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDepartmentLabel } from '../../constants/departments';

export default function StudentFees() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const receiptRef = useRef(null);
  const handlePrintReceipt = useReactToPrint({ content: () => receiptRef.current });

  useEffect(() => {
    loadFees();
  }, []);

  const loadFees = () => {
    api.get('/student/fees').then(r => {
      setFees(r.data.data.fees);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handlePay = async (feeId) => {
    setPaying(feeId);
    try {
      await api.post(`/student/fees/${feeId}/pay`);
      toast.success('Payment successful!');
      loadFees();
    } catch {
      toast.error('Payment failed');
    }
    setPaying(null);
  };

  const viewReceipt = async (feeId) => {
    try {
      const { data } = await api.get(`/student/fees/${feeId}/receipt`);
      setReceipt(data.data.receipt);
    } catch {
      toast.error('Failed to load receipt');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const totalPending = fees.filter(f => f.status === 'pending').reduce((a, f) => a + f.amount, 0);
  const totalPaid = fees.filter(f => f.status === 'paid').reduce((a, f) => a + f.amount, 0);

  return (
    <>
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Fees</h1>
        <p className="text-slate-500 text-sm mt-1">View and pay your fees</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><IndianRupee className="w-5 h-5 text-slate-600" /></div>
            <div><p className="text-xl font-bold text-slate-800">₹{(totalPaid + totalPending).toLocaleString()}</p><p className="text-xs text-slate-500">Total Fees</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p><p className="text-xs text-slate-500">Paid</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-xl font-bold text-red-600">₹{totalPending.toLocaleString()}</p><p className="text-xs text-slate-500">Pending</p></div>
          </div>
        </div>
      </div>

      {/* Fee List */}
      {fees.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No fee records found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fees.map(f => (
            <div key={f._id} className={`card ${f.status === 'paid' ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-red-400'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Semester {f.semester} Fee</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Session: {f.session} · Due: {new Date(f.dueDate).toLocaleDateString()}</p>
                  <p className="text-lg font-bold text-slate-800 mt-2">₹{f.amount?.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  {f.status === 'paid' ? (
                    <div>
                      <span className="badge-green mb-2 inline-block"><CheckCircle className="w-3 h-3 inline mr-1" />Paid</span>
                      <p className="text-xs text-slate-400">TXN: {f.transactionId}</p>
                      <p className="text-xs text-slate-400">Receipt: {f.receiptNo}</p>
                      <p className="text-xs text-slate-400">{new Date(f.paidOn).toLocaleDateString()}</p>
                      <button onClick={() => viewReceipt(f._id)} className="btn-secondary text-xs mt-2"><Printer className="w-3 h-3" /> Receipt</button>
                    </div>
                  ) : (
                    <button onClick={() => handlePay(f._id)} disabled={paying === f._id} className="btn-primary">
                      <CreditCard className="w-4 h-4" /> {paying === f._id ? 'Processing...' : 'Pay Now'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Receipt Modal */}
    {receipt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReceipt(null)}>
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Fee Receipt</h3>
            <div className="flex gap-2">
              <button onClick={handlePrintReceipt} className="btn-primary text-xs"><Printer className="w-3 h-3" /> Print</button>
              <button onClick={() => setReceipt(null)} className="btn-secondary text-xs">Close</button>
            </div>
          </div>
          <div ref={receiptRef} className="p-6" style={{ fontFamily: 'Inter, sans-serif' }}>
            <div className="text-center border-b pb-4 mb-4">
              <h2 className="text-lg font-bold">{receipt.collegeName}</h2>
              <p className="text-sm text-slate-500">FEE RECEIPT</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-slate-500">Receipt No:</span> <span className="font-medium">{receipt.receiptNo}</span></div>
              <div><span className="text-slate-500">Transaction ID:</span> <span className="font-medium">{receipt.transactionId}</span></div>
              <div><span className="text-slate-500">Name:</span> <span className="font-medium">{receipt.student?.name}</span></div>
              <div><span className="text-slate-500">Enrollment:</span> <span className="font-medium">{receipt.student?.enrollmentNo}</span></div>
              <div><span className="text-slate-500">Department:</span> <span className="font-medium">{getDepartmentLabel(receipt.student?.branch)}</span></div>
              <div><span className="text-slate-500">Semester:</span> <span className="font-medium">{receipt.student?.semester}</span></div>
              <div><span className="text-slate-500">Session:</span> <span className="font-medium">{receipt.student?.session}</span></div>
              <div><span className="text-slate-500">Paid On:</span> <span className="font-medium">{new Date(receipt.paidOn).toLocaleDateString()}</span></div>
            </div>
            <div className="border-t pt-4 text-center">
              <p className="text-2xl font-bold text-slate-800">₹{receipt.amount?.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Amount Paid</p>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-6 pt-4 border-t">
              <span>This is a computer-generated receipt</span>
              <span>Authorized Signature</span>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
