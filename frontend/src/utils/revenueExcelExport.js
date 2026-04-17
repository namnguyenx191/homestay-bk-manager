import * as XLSX from 'xlsx-js-style';

/** Excel 1900 date serial for UTC calendar date (ISO instant → date only). */
function excelDateSerialFromISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

function nightsBetween(checkInIso, checkOutIso) {
  const a = new Date(checkInIso);
  const b = new Date(checkOutIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ad = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bd = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.max(0, Math.round((bd - ad) / 86400000));
}

const FMT_VND = '#,##0';
const FMT_DATE = 'yyyy-mm-dd';

const borderGrid = {
  top: { style: 'thin', color: { rgb: 'FFBDC3C7' } },
  bottom: { style: 'thin', color: { rgb: 'FFBDC3C7' } },
  left: { style: 'thin', color: { rgb: 'FFBDC3C7' } },
  right: { style: 'thin', color: { rgb: 'FFBDC3C7' } },
};

/** Cell styles (ARGB with alpha FF) — xlsx-js-style */
const STYLE = {
  metaTitle: {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1E293B' } },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
  },
  metaLine: {
    font: { name: 'Calibri', sz: 11, color: { rgb: 'FFE2E8F0' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FF334155' } },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
  },
  header: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FF003580' } },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: borderGrid,
  },
  row: {
    font: { name: 'Calibri', sz: 11, color: { rgb: 'FF0F172A' } },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
    border: borderGrid,
  },
  rowAlt: {
    font: { name: 'Calibri', sz: 11, color: { rgb: 'FF0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF8FAFC' } },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
    border: borderGrid,
  },
};

function n(v, z = FMT_VND) {
  const x = Number(v);
  return { v: Number.isFinite(x) ? x : 0, t: 'n', z };
}

function dCell(iso) {
  const serial = excelDateSerialFromISO(iso);
  if (serial == null) return { v: '', t: 's' };
  return { v: serial, t: 'n', z: FMT_DATE };
}

function s(v) {
  return { v: v == null ? '' : String(v), t: 's' };
}

function intCell(v) {
  const x = Math.round(Number(v));
  return { v: Number.isFinite(x) ? x : 0, t: 'n', z: '0' };
}

function labels(lang) {
  const vi = lang === 'vi';
  return {
    wbTitle: vi ? 'Báo cáo doanh thu TRAVEL' : 'TRAVEL revenue report',
    metaPeriod: vi ? 'Khoảng thời gian' : 'Reporting period',
    metaGroup: vi ? 'Gom theo' : 'Grouped by',
    metaGenerated: vi ? 'Xuất lúc' : 'Generated',
    day: vi ? 'ngày' : 'day',
    week: vi ? 'tuần' : 'week',
    month: vi ? 'tháng' : 'month',
    sumPeriod: vi ? 'Kỳ' : 'Period',
    sumPaid: vi ? 'Doanh thu đã thanh toán (VND)' : 'Paid revenue (VND)',
    sumPending: vi ? 'Chưa thanh toán (VND)' : 'Unpaid total (VND)',
    sumBk: vi ? 'Số đơn' : 'Booking count',
    sumPaidBk: vi ? 'Số đơn đã thanh toán' : 'Paid booking count',
    detProperty: vi ? 'Chỗ ở' : 'Property',
    detLocation: vi ? 'Địa điểm' : 'Location',
    detGuest: vi ? 'Tên khách' : 'Guest name',
    detEmail: vi ? 'Email khách' : 'Guest email',
    detIn: vi ? 'Nhận phòng' : 'Check-in',
    detOut: vi ? 'Trả phòng' : 'Check-out',
    detNights: vi ? 'Số đêm' : 'Nights',
    detTotal: vi ? 'Tổng (VND)' : 'Total (VND)',
    detFee: vi ? 'Phí dịch vụ (VND)' : 'Service fee (VND)',
    detPaySt: vi ? 'Thanh toán' : 'Payment status',
    detBkSt: vi ? 'Đặt chỗ' : 'Booking status',
    detMethod: vi ? 'Phương thức' : 'Payment method',
    noData: vi ? 'Không có dữ liệu' : 'No data',
    sheetSum: vi ? 'Tong_hop' : 'Summary',
    sheetDet: vi ? 'Chi_tiet_don' : 'Bookings',
  };
}

function mapGranularity(g, L) {
  if (g === 'week') return L.week;
  if (g === 'month') return L.month;
  return L.day;
}

function mapPayStatus(st, lang) {
  const vi = lang === 'vi';
  if (st === 'paid') return vi ? 'Đã thanh toán' : 'Paid';
  if (st === 'pending') return vi ? 'Chờ thanh toán' : 'Pending';
  if (st === 'failed') return vi ? 'Thất bại' : 'Failed';
  return String(st ?? '');
}

function mapBookingStatus(st, lang) {
  const vi = lang === 'vi';
  if (st === 'confirmed') return vi ? 'Đã xác nhận' : 'Confirmed';
  if (st === 'pending') return vi ? 'Chờ xác nhận' : 'Pending';
  if (st === 'cancelled') return vi ? 'Đã hủy' : 'Cancelled';
  return String(st ?? '');
}

function mapMethod(m, lang) {
  const vi = lang === 'vi';
  if (m === 'bank_transfer') return vi ? 'Chuyển khoản' : 'Bank transfer';
  if (m === 'card') return vi ? 'Thẻ' : 'Card';
  return String(m ?? '');
}

function decorateSheet(ws, { headerRow0, colWidths }) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const lastCol = range.e.c;
  const lastRow = range.e.r;
  const headerRow = headerRow0 ?? 0;

  ws['!cols'] = colWidths.map((wch) => ({ wch: Math.min(Math.max(wch, 6), 60) }));

  if (lastRow >= headerRow && lastCol >= 0) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRow, c: 0 },
        e: { r: lastRow, c: lastCol },
      }),
    };
  }

  const freezeBelow = headerRow + 1;
  ws['!views'] = [{ state: 'frozen', ySplit: freezeBelow, topLeftCell: XLSX.utils.encode_cell({ r: freezeBelow, c: 0 }) }];
}

function mergeMetaTitleRows(ws, lastCol0, metaRowCount = 3) {
  if (lastCol0 < 1) return;
  ws['!merges'] = [];
  for (let r = 0; r < metaRowCount; r += 1) {
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: lastCol0 } });
  }
}

/** Apply fills/fonts/borders via xlsx-js-style (cell.s). */
function applySheetStyles(ws, headerRow0, lastCol0) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const lastR = range.e.r;
  const lastC = Math.min(range.e.c, lastCol0);

  for (let r = 0; r <= 2; r += 1) {
    for (let c = 0; c <= lastC; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      ws[addr].s = r === 0 ? { ...STYLE.metaTitle } : { ...STYLE.metaLine };
    }
  }

  for (let c = 0; c <= lastC; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: headerRow0, c });
    if (ws[addr]) ws[addr].s = { ...STYLE.header };
  }

  for (let r = headerRow0 + 1; r <= lastR; r += 1) {
    const stripe = (r - headerRow0) % 2 === 0;
    const base = stripe ? { ...STYLE.rowAlt } : { ...STYLE.row };
    for (let c = 0; c <= lastC; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const fmt = cell.z;
      if (cell.t === 'n' && fmt) {
        ws[addr].s = {
          ...base,
          numFmt: fmt,
          alignment: { ...base.alignment, horizontal: 'right' },
        };
      } else {
        ws[addr].s = { ...base };
      }
    }
  }
}

/**
 * Styled .xlsx (xlsx-js-style): meta, header, zebra rows, borders, number formats.
 */
export function exportRevenueWorkbook({ lang = 'en', summary, rows, filename, reportMeta }) {
  const L = labels(lang);
  const granLabel = mapGranularity(reportMeta?.granularity || 'day', L);

  const fromStr = reportMeta?.from ? new Date(reportMeta.from).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB') : '';
  const toStr = reportMeta?.to ? new Date(reportMeta.to).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB') : '';
  const generatedStr = new Date().toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const metaRows = [
    [s(L.wbTitle)],
    [s(`${L.metaPeriod}: ${fromStr} — ${toStr}  ·  ${L.metaGroup}: ${granLabel}`)],
    [s(`${L.metaGenerated}: ${generatedStr}`)],
    [],
  ];

  const sumHeaderRow = [
    s(L.sumPeriod),
    s(L.sumPaid),
    s(L.sumPending),
    s(L.sumBk),
    s(L.sumPaidBk),
  ];

  const sumDataRows =
    summary.length > 0
      ? summary.map((x) => [
          s(x.periodKey),
          n(x.paidRevenue),
          n(x.pendingAmount),
          intCell(x.bookingCount),
          intCell(x.paidCount),
        ])
      : [[s(L.noData), s(''), s(''), s(''), s('')]];

  const sumAoa = [...metaRows, sumHeaderRow, ...sumDataRows];
  const wsSum = XLSX.utils.aoa_to_sheet(sumAoa);
  const sumLastCol = sumHeaderRow.length - 1;
  const sumHeaderRow0 = metaRows.length;
  mergeMetaTitleRows(wsSum, sumLastCol, 3);
  decorateSheet(wsSum, {
    headerRow0: sumHeaderRow0,
    colWidths: [18, 26, 24, 12, 20],
  });
  applySheetStyles(wsSum, sumHeaderRow0, sumLastCol);

  const detMetaRows = [
    [s(L.wbTitle)],
    [s(`${L.metaPeriod}: ${fromStr} — ${toStr}  ·  ${L.metaGroup}: ${granLabel}`)],
    [s(`${L.metaGenerated}: ${generatedStr}`)],
    [],
  ];

  const detHeaderRow = [
    s(L.detProperty),
    s(L.detLocation),
    s(L.detGuest),
    s(L.detEmail),
    s(L.detIn),
    s(L.detOut),
    s(L.detNights),
    s(L.detTotal),
    s(L.detFee),
    s(L.detPaySt),
    s(L.detBkSt),
    s(L.detMethod),
  ];

  const detDataRows =
    rows.length > 0
      ? rows.map((r) => [
          s(r.homestayTitle),
          s(r.location),
          s(r.guestName),
          s(r.guestEmail),
          dCell(r.checkIn),
          dCell(r.checkOut),
          intCell(nightsBetween(r.checkIn, r.checkOut)),
          n(r.totalPrice),
          n(r.serviceFee ?? 0),
          s(mapPayStatus(r.paymentStatus, lang)),
          s(mapBookingStatus(r.bookingStatus, lang)),
          s(mapMethod(r.paymentMethod, lang)),
        ])
      : [[s(L.noData), s(''), s(''), s(''), s(''), s(''), s(''), s(''), s(''), s(''), s(''), s('')]];

  const detAoa = [...detMetaRows, detHeaderRow, ...detDataRows];
  const wsDet = XLSX.utils.aoa_to_sheet(detAoa);
  const detLastCol = detHeaderRow.length - 1;
  const detHeaderRow0 = detMetaRows.length;
  mergeMetaTitleRows(wsDet, detLastCol, 3);
  decorateSheet(wsDet, {
    headerRow0: detHeaderRow0,
    colWidths: [28, 22, 20, 28, 12, 12, 8, 14, 12, 16, 16, 14],
  });
  applySheetStyles(wsDet, detHeaderRow0, detLastCol);

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: L.wbTitle,
    Subject: L.wbTitle,
    Author: 'TRAVEL',
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(wb, wsSum, L.sheetSum.slice(0, 31));
  XLSX.utils.book_append_sheet(wb, wsDet, L.sheetDet.slice(0, 31));

  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}
