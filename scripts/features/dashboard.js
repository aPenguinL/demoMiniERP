let dashboardPeriod = 'this',
  dashboardYear = new Date().getFullYear(),
  dashboardCustomMonth = String(new Date().getMonth() + 1).padStart(2, '0'),
  dashboardStockGroup = 'materials',
  dashboardStockPeriod = 'this',
  dashboardStockMonth = new Date().toISOString().slice(0, 7),
  dashboardStockDate = new Date().toISOString().slice(0, 10);
const dashYearOptions = () => Array.from({ length: 5 }, (_, i) => dashboardYear - 2 + i);
const dashboardPeriodLabel = () =>
  dashboardPeriod === 'this'
    ? 'Tháng này'
    : dashboardPeriod === 'previous'
      ? 'Tháng trước'
      : dashboardPeriod === 'quarter'
        ? 'Quý này'
        : dashboardPeriod === 'year'
          ? 'Năm nay'
          : 'Chọn tháng';
function dashboard(tax = false) {
  if (tax)
    return cards([
      ['GTGT đầu ra kỳ này', money(vatTotals().output), 16],
      ['GTGT đầu vào chờ hồ sơ', money(vatTotals().pending), 16],
      [
        'Hóa đơn cần xử lý',
        records.sale.filter((x) => x.state === 'Đã ghi sổ' && !issued(x)).length + ' hóa đơn',
        27,
      ],
    ]);
  const now = new Date(),
    year = dashboardYear || now.getFullYear();
  const mm =
    dashboardPeriod === 'previous'
      ? now.getMonth() || 12
      : dashboardPeriod === 'custom'
        ? Number(dashboardCustomMonth)
        : now.getMonth() + 1;
  const effectiveYear =
    dashboardPeriod === 'previous' && now.getMonth() === 0
      ? now.getFullYear() - 1
      : dashboardPeriod === 'custom'
        ? year
        : now.getFullYear();
  const isInPeriod = (day) => {
    const d = dayKey(day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    if (dashboardPeriod === 'year') return d.slice(0, 4) === String(now.getFullYear());
    if (dashboardPeriod === 'quarter')
      return (
        d.slice(0, 4) === String(now.getFullYear()) &&
        Math.floor((Number(d.slice(5, 7)) - 1) / 3) === Math.floor(now.getMonth() / 3)
      );
    return d.slice(0, 7) === effectiveYear + '-' + String(mm).padStart(2, '0');
  };
  const rev = records.sale
    .filter((x) => x.state === 'Đã ghi sổ' && isInPeriod(x.post || x.day))
    .reduce((n, x) => n + (invoiceTax(x, 'sale')?.base || x.amount), 0);
  const end = dashboardPeriod === 'custom' ? year + '-' + dashboardCustomMonth + '-31' : todayKey();
  const cashPeriod =
    dashboardPeriod === 'custom' ? dashboardCustomMonth + '/' + year : postingPeriod(todayKey());
  const cash = chartAccounts
    .filter((account) => account.code.startsWith('1111'))
    .reduce((total, account) => total + postedAmount(account.code, cashPeriod), 0);
  const bankBalance = postedAmount(
    '1121',
    dashboardPeriod === 'custom' ? dashboardCustomMonth + '/' + year : postingPeriod(todayKey()),
  );
  const salesDebt = openDebt('sale').reduce((n, x) => n + remaining(x), 0),
    buyDebt = openDebt('buy').reduce((n, x) => n + remaining(x), 0);
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = String(i + 1).padStart(2, '0') + '/' + year;
    return {
      month: i + 1,
      total: records.sale
        .filter((x) => x.state === 'Đã ghi sổ' && postingPeriod(x.post || x.day) === key)
        .reduce((n, x) => n + (invoiceTax(x, 'sale')?.base || x.amount), 0),
    };
  });
  const high = Math.max(1, ...months.map((x) => x.total));
  const chart =
    '<div class="dash-chart" role="img" aria-label="Biểu đồ doanh thu 12 tháng năm ' +
    year +
    '">' +
    months
      .map(
        (x) =>
          '<div class="dash-col" title="Tháng ' +
          x.month +
          ': ' +
          money(x.total) +
          '"><div class="dash-value">' +
          (x.total ? money(x.total) : '') +
          '</div><div class="dash-bar-track"><span style="height:' +
          Math.max(x.total ? 6 : 0, (x.total / high) * 100) +
          '%"></span></div><small>T' +
          x.month +
          '</small></div>',
      )
      .join('') +
    '</div>';
  const stockGroup = dashboardStockGroup === 'products' ? finishedGroup : materialGroup;
  const stockToday = todayKey();
  const stockDateObject = now;
  const stockEndOfMonth = (yr, mon) =>
    yr + '-' + String(mon).padStart(2, '0') + '-' + String(new Date(yr, mon, 0).getDate()).padStart(2, '0');
  const prevMonth =
    now.getMonth() === 0
      ? { yr: now.getFullYear() - 1, mon: 12 }
      : { yr: now.getFullYear(), mon: now.getMonth() };
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3 + 1;
  const prevQuarterEnd = new Date(now.getFullYear(), quarterStartMonth - 1, 0);
  const selectedStockDate =
    dashboardStockPeriod === 'previous'
      ? stockEndOfMonth(prevMonth.yr, prevMonth.mon)
      : dashboardStockPeriod === 'previous-quarter'
        ? dayKey(prevQuarterEnd)
        : dashboardStockPeriod === 'previous-year'
          ? now.getFullYear() - 1 + '-12-31'
          : dashboardStockPeriod === 'month'
            ? stockEndOfMonth(
                Number(dashboardStockMonth.slice(0, 4)),
                Number(dashboardStockMonth.slice(5, 7)),
              )
            : dashboardStockPeriod === 'date'
              ? dashboardStockDate
              : stockToday;
  const stockAsOf = selectedStockDate > stockToday ? stockToday : selectedStockDate;
  const beforeOpening = stockAsOf < '2026-11-01';
  const stockItems = beforeOpening
    ? []
    : catalogSpec.items.rows
        .filter((item) => item.group === stockGroup)
        .map((item) => {
          const stock = inventory(item.code, stockAsOf);
          return { ...item, stockQty: stock.qty, stockValue: stock.value };
        });
  const totalStockValue = stockItems.reduce((sum, item) => sum + item.stockValue, 0);
  const visibleStock = [...stockItems]
    .filter((item) => item.stockValue > 0)
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 5);
  const stockPeriodLabels = {
    this: 'Tháng này',
    previous: 'Tháng trước',
    quarter: 'Quý này',
    year: 'Năm nay',
    'previous-quarter': 'Quý trước',
    'previous-year': 'Năm trước',
    month: 'Chọn tháng',
    date: 'Chọn ngày',
  };
  const stockDateLabel =
    (stockPeriodLabels[dashboardStockPeriod] || 'Tháng này') +
    (dashboardStockPeriod === 'month'
      ? ' ' + dashboardStockMonth.slice(5) + '/' + dashboardStockMonth.slice(0, 4)
      : '');
  const stockPeriodOptions = [
    ['this', 'Tháng này'],
    ['previous', 'Tháng trước'],
    ['quarter', 'Quý này'],
    ['previous-quarter', 'Quý trước'],
    ['year', 'Năm nay'],
    ['previous-year', 'Năm trước'],
    ['month', 'Chọn tháng…'],
    ['date', 'Chọn ngày…'],
  ];
  const stockTimeControls =
    '<div class="dash-stock-time"><label>Thời gian<select id="dashboard-stock-period" aria-label="Chọn khoảng thời gian tồn kho">' +
    stockPeriodOptions
      .map(
        ([value, label]) =>
          '<option value="' +
          value +
          '"' +
          (dashboardStockPeriod === value ? ' selected' : '') +
          '>' +
          label +
          '</option>',
      )
      .join('') +
    '</select></label>' +
    (dashboardStockPeriod === 'month'
      ? '<label>Tháng<input id="dashboard-stock-month" type="month" value="' +
        esc(dashboardStockMonth) +
        '" max="' +
        stockToday.slice(0, 7) +
        '"></label>'
      : dashboardStockPeriod === 'date'
        ? '<label>Ngày<input id="dashboard-stock-date" type="date" value="' +
          esc(dashboardStockDate) +
          '" max="' +
          stockToday +
          '"></label>'
        : '') +
    '</div>';
  const stockPanel =
    '<div class="dash-stock-head"><div><h2>Giá trị tồn kho</h2><small>Giá trị tồn tại cuối kỳ đã chọn · VNĐ</small></div><div class="dash-stock-controls"><label>Nhóm hàng<select id="dashboard-stock-group"><option value="materials"' +
    (dashboardStockGroup === 'materials' ? ' selected' : '') +
    '>Nguyên liệu</option><option value="products"' +
    (dashboardStockGroup === 'products' ? ' selected' : '') +
    '>Thành phẩm</option></select></label>' +
    stockTimeControls +
    '</div></div>' +
    '<div class="dash-stock-total"><small>Tổng giá trị ' +
    (dashboardStockGroup === 'materials' ? 'nguyên liệu' : 'thành phẩm') +
    '</small><strong>' +
    (beforeOpening ? '—' : money(totalStockValue)) +
    '</strong><span>' +
    stockDateLabel +
    ' · Số dư tại ngày ' +
    isoDate(stockAsOf) +
    '</span></div>' +
    (beforeOpening
      ? '<div class="note">Chưa có dữ liệu tồn kho trước ngày khởi tạo 01/11/2026 trong bản mẫu. Vui lòng chọn mốc từ ngày này.</div>'
      : '<div class="dash-stock-section-title">Mặt hàng có giá trị tồn cao nhất</div>' +
        '<ul class="dash-stock-list">' +
        (visibleStock.length
          ? visibleStock
              .map(
                (item) =>
                  '<li><span class="dash-stock-item"><strong title="' +
                  esc(item.name) +
                  '">' +
                  esc(item.name) +
                  '</strong><small>' +
                  esc(item.code) +
                  ' · ' +
                  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(item.stockQty) +
                  ' ' +
                  esc(item.extra || '') +
                  '</small></span><span class="dash-stock-qty">' +
                  money(item.stockValue) +
                  '</span></li>',
              )
              .join('')
          : '<li><span class="muted">Chưa có giá trị tồn kho trong nhóm này tại mốc đã chọn.</span></li>') +
        '</ul>') +
    '<div class="dash-stock-footer">' +
    a(dashboardStockGroup === 'products' ? 'stock?group=products' : 'stock', 'Xem chi tiết tồn kho →') +
    '</div>';
  const periodControls =
    '<div class="dash-filter"><label>Khoảng thời gian<select id="dashboard-period">' +
    [
      ['this', 'Tháng này'],
      ['previous', 'Tháng trước'],
      ['quarter', 'Quý này'],
      ['year', 'Năm nay'],
      ['custom', 'Chọn tháng'],
    ]
      .map(
        ([v, t]) =>
          '<option value="' + v + '"' + (dashboardPeriod === v ? ' selected' : '') + '>' + t + '</option>',
      )
      .join('') +
    '</select></label>' +
    (dashboardPeriod === 'custom'
      ? '<label>Tháng<select id="dashboard-custom-month">' +
        Array.from(
          { length: 12 },
          (_, i) =>
            '<option value="' +
            String(i + 1).padStart(2, '0') +
            '"' +
            (dashboardCustomMonth === String(i + 1).padStart(2, '0') ? ' selected' : '') +
            '>Tháng ' +
            (i + 1) +
            '</option>',
        ).join('') +
        '</select></label>'
      : '') +
    '</div>';
  return (
    '<div class="dash-top"><div><h2>Tình hình kinh doanh</h2><p class="muted">Số liệu minh họa · ' +
    dashboardPeriodLabel() +
    '</p></div>' +
    periodControls +
    '</div>' +
    '<div class="dash-metrics">' +
    cards([
      ['Doanh thu trong kỳ', money(rev), 27],
      ['Phải thu hiện tại', money(salesDebt), 8],
      ['Phải trả hiện tại', money(buyDebt), '8?side=buy'],
      ['Tiền mặt · kỳ xem', money(cash), 9],
      ['Tiền gửi NH · kỳ xem', money(bankBalance), 11],
    ]) +
    '</div>' +
    '<div class="dash-visual-grid">' +
    card(
      '<div class="dash-chart-header"><div><h2>Doanh thu 12 tháng</h2><small>Doanh thu chưa gồm thuế · theo năm</small></div><label>Năm<select id="dashboard-year">' +
        dashYearOptions()
          .map((y) => '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>')
          .join('') +
        '</select></label></div>' +
        chart +
        (months.every((x) => x.total === 0)
          ? '<div class="dash-no-revenue">Chưa có doanh thu ghi nhận trong năm ' + year + '.</div>'
          : ''),
      'pad',
    ) +
    card(stockPanel, 'pad') +
    '</div>' +
    pad(
      'Công việc cần xử lý',
      table(
        ['Nội dung', 'Số lượng', 'Thao tác'],
        [
          ['Sao kê chờ đối chiếu', bank.filter((x) => x[4] === 'Chờ khớp').length, a(10, 'Kiểm tra')],
          [
            'Hóa đơn bán chờ phát hành',
            records.sale.filter((x) => x.state === 'Đã ghi sổ' && !issued(x)).length,
            a(27, 'Xem hóa đơn'),
          ],
          ['Công nợ cần theo dõi', openDebt('sale').length, a(8, 'Xem công nợ')],
        ],
      ),
    )
  );
}
