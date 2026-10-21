import api from '../api/axios';

export async function downloadTimetablePdf(params = {}) {
  const response = await api.get('/timetable/me/pdf', { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  const contentDisposition = response.headers['content-disposition'] || '';
  const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] || `Timetable_${new Date().toISOString().slice(0, 10)}.pdf`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
