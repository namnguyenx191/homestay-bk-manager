import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';

const formatYmd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const HostRevenuePanel = ({ tv, lang }) => {
  const [stats, setStats] = useState(null);
  const [revFrom, setRevFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatYmd(d);
  });
  const [revTo, setRevTo] = useState(() => formatYmd(new Date()));
  const [revGran, setRevGran] = useState('day');
  const [revExporting, setRevExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/admin/stats')
      .then(({ data }) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyRevPreset = (preset) => {
    const to = new Date();
    if (preset === 'lastMonth') {
      const lastDayPrev = new Date(to.getFullYear(), to.getMonth(), 0);
      const firstPrev = new Date(lastDayPrev.getFullYear(), lastDayPrev.getMonth(), 1);
      setRevFrom(formatYmd(firstPrev));
      setRevTo(formatYmd(lastDayPrev));
      return;
    }
    const from = new Date();
    if (preset === '7d') {
      from.setDate(to.getDate() - 7);
    } else if (preset === 'week') {
      const offset = (to.getDay() + 6) % 7;
      from.setTime(to.getTime());
      from.setDate(to.getDate() - offset);
    } else if (preset === 'month') {
      from.setTime(to.getTime());
      from.setDate(1);
    }
    setRevFrom(formatYmd(from));
    setRevTo(formatYmd(to));
  };

  const handleExportRevenueExcel = async () => {
    setRevExporting(true);
    try {
      const { data } = await client.get('/admin/revenue-report', {
        params: { from: revFrom, to: revTo, granularity: revGran },
      });
      const { exportRevenueWorkbook } = await import('../../utils/revenueExcelExport');
      exportRevenueWorkbook({
        lang,
        summary: data.summary || [],
        rows: data.rows || [],
        filename: `revenue-${revGran}-${revFrom}-${revTo}`,
        reportMeta: {
          from: data.from,
          to: data.to,
          granularity: data.granularity,
        },
      });
      toast.success(tv('Excel file downloaded', 'Đã tải file Excel'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Export failed', 'Xuất file thất bại'));
    } finally {
      setRevExporting(false);
    }
  };

  const pendingHint =
    stats && stats.pendingRevenue
      ? tv(`About ${Number(stats.pendingRevenue).toLocaleString()} outstanding`, `Khoảng ${Number(stats.pendingRevenue).toLocaleString()} đang chờ`)
      : tv('No pending payment total', 'Không có khoản chờ thanh toán');

  return (
    <div className="space-y-6 text-white/90">
      <h1 className="text-lg font-bold text-white">{tv('Revenue', 'Doanh thu')}</h1>
      {!stats ? (
        <p className="text-sm text-white/60">{tv('Loading…', 'Đang tải…')}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs font-medium text-white/55">{tv('Paid revenue', 'Doanh thu đã thanh toán')}</p>
              <p className="mt-2 text-2xl font-bold text-white">${Number(stats.revenue).toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-white/50">{tv('Bookings with payment status: paid', 'Đơn có trạng thái thanh toán: paid')}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs font-medium text-white/55">{tv('Awaiting payment', 'Đang chờ thanh toán')}</p>
              <p className="mt-2 text-2xl font-bold text-white">{String(stats.pendingBookings ?? 0)}</p>
              <p className="mt-1 text-[11px] text-white/50">{pendingHint}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs font-medium text-white/55">{tv('Live listings', 'Tin đang hiển thị')}</p>
              <p className="mt-2 text-2xl font-bold text-white">{String(stats.homestays)}</p>
              <p className="mt-1 text-[11px] text-white/50">{tv(`${stats.bookings} bookings total`, `${stats.bookings} đơn tổng cộng`)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
            <h2 className="text-base font-semibold text-white">
              {tv('Revenue report & Excel export', 'Báo cáo doanh thu — xuất Excel')}
            </h2>
            <p className="mt-1 text-xs text-white/55">
              {tv(
                'Includes bookings whose stay overlaps the selected dates. Summary buckets use check-in date (day, week starting Monday, or month).',
                'Gồm các đơn có kỳ lưu trú giao với khoảng ngày đã chọn. Bảng tổng hợp theo ngày nhận phòng: theo ngày, tuần (bắt đầu thứ Hai), hoặc tháng.'
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['7d', tv('Last 7 days', '7 ngày qua')],
                ['week', tv('This week', 'Tuần này')],
                ['month', tv('This month', 'Tháng này')],
                ['lastMonth', tv('Last month', 'Tháng trước')],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyRevPreset(id)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-white/70">
                {tv('From', 'Từ ngày')}
                <input
                  type="date"
                  value={revFrom}
                  onChange={(e) => setRevFrom(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-white/70">
                {tv('To', 'Đến ngày')}
                <input
                  type="date"
                  value={revTo}
                  onChange={(e) => setRevTo(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-white/70">
                {tv('Group by', 'Gom theo')}
                <select
                  value={revGran}
                  onChange={(e) => setRevGran(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white"
                >
                  <option value="day" className="bg-slate-900">
                    {tv('By day', 'Theo ngày')}
                  </option>
                  <option value="week" className="bg-slate-900">
                    {tv('By week', 'Theo tuần')}
                  </option>
                  <option value="month" className="bg-slate-900">
                    {tv('By month', 'Theo tháng')}
                  </option>
                </select>
              </label>
              <button
                type="button"
                disabled={revExporting}
                onClick={handleExportRevenueExcel}
                className="rounded-lg border border-[#c73737] bg-[#c73737] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a82c2c] disabled:opacity-60"
              >
                {revExporting ? tv('Preparing…', 'Đang xử lý…') : tv('Download Excel', 'Tải file Excel')}
              </button>
            </div>
            {revGran === 'week' ? (
              <p className="mt-2 text-xs text-white/50">{tv('Week bucket = Monday date of that week.', 'Mỗi tuần = ngày thứ Hai đầu tuần (YYYY-MM-DD).')}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default HostRevenuePanel;
