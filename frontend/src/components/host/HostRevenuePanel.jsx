import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useCurrency } from '../../context/CurrencyContext';

const formatYmd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const HostRevenuePanel = ({ tv, lang }) => {
  const { formatMoney } = useCurrency();
  const [stats, setStats] = useState(null);
  const [revFrom, setRevFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatYmd(d);
  });
  const [revTo, setRevTo] = useState(() => formatYmd(new Date()));
  const [revGran, setRevGran] = useState('day');
  const [revExporting, setRevExporting] = useState(false);
  const [liveSummary, setLiveSummary] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const loadLive = async () => {
      setLiveLoading(true);
      try {
        const { data } = await client.get('/admin/revenue-report', {
          params: { from: revFrom, to: revTo, granularity: revGran },
        });
        if (!cancelled) setLiveSummary(Array.isArray(data.summary) ? data.summary : []);
      } catch {
        if (!cancelled) setLiveSummary([]);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    };
    loadLive();
    const timer = window.setInterval(loadLive, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [revFrom, revTo, revGran]);

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
      ? tv(`About ${formatMoney(Number(stats.pendingRevenue))} outstanding`, `Khoảng ${formatMoney(Number(stats.pendingRevenue))} đang chờ`)
      : tv('No pending payment total', 'Không có khoản chờ thanh toán');
  const maxLiveRevenue = Math.max(
    1,
    ...liveSummary.map((item) =>
      Math.max(Number(item.roomPaidRevenue || 0), Number(item.servicePaidRevenue || 0))
    )
  );

  return (
    <div className="space-y-6 text-white">
      <h1 className="text-lg font-bold text-white">{tv('Revenue', 'Doanh thu')}</h1>
      {!stats ? (
        <p className="text-sm text-slate-200">{tv('Loading…', 'Đang tải…')}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs font-medium text-slate-200">{tv('Paid revenue', 'Doanh thu đã thanh toán')}</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatMoney(Number(stats.revenue))}</p>
              <p className="mt-1 text-[11px] text-slate-200">{tv('Bookings with payment status: paid', 'Đơn có trạng thái thanh toán: paid')}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs font-medium text-slate-200">{tv('Awaiting payment', 'Đang chờ thanh toán')}</p>
              <p className="mt-2 text-2xl font-bold text-white">{String(stats.pendingBookings ?? 0)}</p>
              <p className="mt-1 text-[11px] text-slate-200">{pendingHint}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs font-medium text-slate-200">{tv('Live listings', 'Tin đang hiển thị')}</p>
              <p className="mt-2 text-2xl font-bold text-white">{String(stats.homestays)}</p>
              <p className="mt-1 text-[11px] text-slate-200">{tv(`${stats.bookings} bookings total`, `${stats.bookings} đơn tổng cộng`)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
            <h2 className="text-base font-semibold text-white">
              {tv('Revenue report & Excel export', 'Báo cáo doanh thu — xuất Excel')}
            </h2>
            <p className="mt-1 text-xs text-slate-200">
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
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-100">
                {tv('From', 'Từ ngày')}
                <input
                  type="date"
                  value={revFrom}
                  onChange={(e) => setRevFrom(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-100">
                {tv('To', 'Đến ngày')}
                <input
                  type="date"
                  value={revTo}
                  onChange={(e) => setRevTo(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-100">
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
              <p className="mt-2 text-xs text-slate-200">{tv('Week bucket = Monday date of that week.', 'Mỗi tuần = ngày thứ Hai đầu tuần (YYYY-MM-DD).')}</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{tv('Live revenue chart', 'Biểu đồ doanh thu live')}</h2>
              <span className="text-xs text-slate-200">{tv('Auto refresh every 15s', 'Tự làm mới mỗi 15 giây')}</span>
            </div>
            {liveLoading ? (
              <p className="text-sm text-slate-200">{tv('Loading chart…', 'Đang tải biểu đồ…')}</p>
            ) : liveSummary.length === 0 ? (
              <p className="text-sm text-slate-200">{tv('No data in selected range.', 'Không có dữ liệu trong khoảng đã chọn.')}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-[11px] text-slate-100">
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-sky-400" />{tv('Room revenue', 'Doanh thu phòng')}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-400" />{tv('Service revenue', 'Doanh thu dịch vụ')}</span>
                </div>
                <div className="overflow-x-auto rounded border border-white/10 bg-white/[0.03] p-2">
                  <svg viewBox="0 0 980 300" className="h-[300px] min-w-[860px] w-full">
                    <line x1="60" y1="20" x2="60" y2="250" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
                    <line x1="60" y1="250" x2="940" y2="250" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
                    <text x="16" y="28" fill="rgba(255,255,255,0.7)" fontSize="11">Y</text>
                    <text x="944" y="266" fill="rgba(255,255,255,0.7)" fontSize="11">X</text>
                    {[0, 1, 2, 3, 4].map((tick) => {
                      const value = Math.round((maxLiveRevenue * (4 - tick)) / 4);
                      const y = 30 + tick * 55;
                      return (
                        <g key={`tick-${tick}`}>
                          <line x1="60" y1={y} x2="940" y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                          <text x="8" y={y + 4} fill="rgba(255,255,255,0.55)" fontSize="10">{formatMoney(value)}</text>
                        </g>
                      );
                    })}
                    {liveSummary.map((item, idx) => {
                      const count = Math.max(1, liveSummary.length);
                      const groupW = 860 / count;
                      const groupX = 70 + idx * groupW;
                      const roomRevenue = Number(item.roomPaidRevenue || 0);
                      const serviceRevenue = Number(item.servicePaidRevenue || 0);
                      const roomH = Math.max(0, Math.round((roomRevenue / maxLiveRevenue) * 210));
                      const serviceH = Math.max(0, Math.round((serviceRevenue / maxLiveRevenue) * 210));
                      return (
                        <g key={item.periodKey}>
                          <rect x={groupX + 8} y={250 - roomH} width={Math.max(8, groupW * 0.28)} height={roomH} fill="#38bdf8" />
                          <rect x={groupX + 8 + Math.max(8, groupW * 0.32)} y={250 - serviceH} width={Math.max(8, groupW * 0.28)} height={serviceH} fill="#34d399" />
                          <text x={groupX + 8} y="266" fill="rgba(255,255,255,0.72)" fontSize="10">{item.periodKey}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HostRevenuePanel;
