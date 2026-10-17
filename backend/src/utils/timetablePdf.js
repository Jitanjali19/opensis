const PDFDocument = require('pdfkit');
const slotConfig = require('../../../shared/timetableSlots.json');

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];
const ROWS = [1, 2, 3, 'lunch', 4, 5, 6, 7];
const YEAR_LABELS = ['', 'I', 'II', 'III', 'IV'];

const sectionLabel = section => {
  if (!section) return 'Section unavailable';
  return `${section.department || ''} ${YEAR_LABELS[section.year] || section.year || ''}-${section.sectionName || ''}`.trim();
};

const cleanFilenamePart = value => String(value || 'timetable').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'timetable';
const entryStart = entry => Number(entry.startSlot || entry.slots?.[0]);
const entryEnd = entry => entryStart(entry) + Number(entry.slotCount || entry.slots?.length || 1) - 1;

function entryLines(entry, role) {
  const subject = entry.subject?.code || entry.subject?.name || 'Subject';
  const section = sectionLabel(entry.section);
  const room = entry.room?.name || 'Room unavailable';
  const batch = entry.batch ? `Batch: ${entry.batch}` : '';
  const secondLine = role === 'faculty' ? section : (entry.facultyName || entry.faculty?.email || 'Faculty unavailable');
  return [subject, secondLine, batch, room].filter(Boolean);
}

function drawCell(doc, x, y, width, height, fill = '#ffffff') {
  doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
  doc.strokeColor('#cbd5e1').lineWidth(0.6).rect(x, y, width, height).stroke();
}

function drawEntry(doc, entry, x, y, width, height, role) {
  drawCell(doc, x, y, width, height, '#eff6ff');
  const lines = entryLines(entry, role);
  const columnWidth = width / Math.max(1, lines.length);
  lines.forEach((line, index) => {
    doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(index === 0 ? 8 : 7)
      .fillColor(index === 0 ? '#1e3a8a' : '#334155')
      .text(line, x + 4 + index * columnWidth, y + 6, { width: columnWidth - 8, height: height - 10, ellipsis: true });
  });
}

function createTimetablePdf(response, { entries, role, headerName, section, academicYear, filename }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(response);

  const pageWidth = doc.page.width - 60;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16)
    .text(process.env.COLLEGE_NAME || 'Shri G. S. Institute of Technology & Science, Indore', { align: 'center' });
  doc.moveDown(0.35).font('Helvetica-Bold').fontSize(12).fillColor('#1e293b')
    .text(role === 'student' ? `Student: ${headerName}` : `Faculty: ${headerName}`, { align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#475569')
    .text(`${role === 'student' ? `Section: ${sectionLabel(section)}` : `Faculty: ${headerName}`}  |  Academic Year: ${academicYear}`, { align: 'center' });

  const tableTop = doc.y + 18;
  const timeWidth = 92;
  const dayWidth = (pageWidth - timeWidth) / DAYS.length;
  const headerHeight = 27;
  const rowHeight = 37;
  const tableLeft = 30;

  drawCell(doc, tableLeft, tableTop, timeWidth, headerHeight, '#1e293b');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('Time', tableLeft + 5, tableTop + 9, { width: timeWidth - 10, align: 'center' });
  DAYS.forEach((day, index) => {
    const x = tableLeft + timeWidth + index * dayWidth;
    drawCell(doc, x, tableTop, dayWidth, headerHeight, '#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(day.label, x + 4, tableTop + 9, { width: dayWidth - 8, align: 'center' });
  });

  const covered = new Set();
  let rowIndex = 0;
  ROWS.forEach(row => {
    const y = tableTop + headerHeight + rowIndex * rowHeight;
    if (row === 'lunch') {
      drawCell(doc, tableLeft, y, timeWidth, rowHeight, '#e2e8f0');
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text('12:00 - 1:00', tableLeft + 4, y + 14, { width: timeWidth - 8, align: 'center' });
      drawCell(doc, tableLeft + timeWidth, y, pageWidth - timeWidth, rowHeight, '#e2e8f0');
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('LUNCH', tableLeft + timeWidth, y + 14, { width: pageWidth - timeWidth, align: 'center' });
      rowIndex += 1;
      return;
    }

    const slot = slotConfig.slots[String(row)];
    drawCell(doc, tableLeft, y, timeWidth, rowHeight);
    doc.fillColor('#475569').font('Helvetica').fontSize(7).text(slot.label, tableLeft + 4, y + 14, { width: timeWidth - 8, align: 'center' });

    DAYS.forEach((day, dayIndex) => {
      const x = tableLeft + timeWidth + dayIndex * dayWidth;
      const key = `${day.value}-${row}`;
      if (covered.has(key)) return;
      const dayEntries = entries.filter(entry => Number(entry.day) === day.value && entryStart(entry) === row);
      const span = Math.max(1, ...dayEntries.map(entry => Number(entry.slotCount || entry.slots?.length || 1)));
      for (let next = row + 1; next < row + span; next += 1) covered.add(`${day.value}-${next}`);
      if (!dayEntries.length) {
        drawCell(doc, x, y, dayWidth, rowHeight);
      } else {
        const entryWidth = dayWidth / dayEntries.length;
        dayEntries.forEach((entry, entryIndex) => drawEntry(doc, entry, x + entryIndex * entryWidth, y, entryWidth, rowHeight * span, role));
      }
    });
    rowIndex += 1;
  });

  doc.end();
}

module.exports = { createTimetablePdf, cleanFilenamePart };
