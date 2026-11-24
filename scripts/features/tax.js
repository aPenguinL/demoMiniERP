const taxPeriod = '11/2026';
let vatDate = '2026-11-01';
const vatReturns = new Map();
function vatReturnState(window = vatWindow()) {
  const key = window.from + '/' + window.to;
  if (!vatReturns.has(key)) vatReturns.set(key, { vat: 'Nháp', history: [] });
  return vatReturns.get(key);
}
function vatWindow(period = postingPeriod(vatDate), quarter = stage.settings?.[0]?.taxPeriod === 'Theo quý') {
  const [month, year] = period.split('/').map(Number);
  if (arguments.length < 2 && stage.settings?.[0]?.taxPeriod === 'Theo năm') {
    return { label: 'Năm ' + year, from: year + '-01-01', to: year + '-12-31', due: null };
  }
  const first = quarter ? Math.floor((month - 1) / 3) * 3 : month - 1;
  const end = first + (quarter ? 3 : 1);
  const key = (m, d) => new Date(Date.UTC(year, m, d)).toISOString().slice(0, 10);
  const deadline = new Date(Date.UTC(year, quarter ? end + 1 : end, quarter ? 0 : 20));
  while ([0, 6].includes(deadline.getUTCDay())) deadline.setUTCDate(deadline.getUTCDate() + 1);
  return {
    label: quarter ? 'Quý ' + (Math.floor(first / 3) + 1) + '/' + year : period,
    from: key(first, 1),
    to: key(end, 0),
    due: deadline.toISOString().slice(0, 10),
  };
}
function vatDeadlineStatus() {
  const { due } = vatWindow();
  if (!due) return pill(vatReturnState().vat);
  const delta = (Date.parse(due) - Date.parse(todayKey())) / 86400000;
  if (vatReturnState().vat === 'Đã nộp') return pill('Đã nộp', 'good');
  if (delta < 0) return pill('Quá hạn ' + -delta + ' ngày', 'bad');
  if (delta === 0) return pill('Đến hạn hôm nay', 'attn');
  if (delta <= 7) return pill('Còn ' + delta + ' ngày', 'attn');
  return pill(vatReturnState().vat);
}
const taxHistory = { pit: [] };
const dateRef = (data) =>
  data.get('date').split('-').reverse().join('/') + ' · ' + data.get('ref') + ' · ' + data.get('file').name;
const issued = (x) => x.einv === 'Đã cấp mã';
const taxBills = (kind, window = vatWindow()) =>
  (kind === 'sale' ? [...records.sale, ...scrapSales] : records[kind]).filter(
    (x) =>
      x.state === 'Đã ghi sổ' &&
      x.special !== 'noinvoice' &&
      dayKey(x.day) >= window.from &&
      dayKey(x.day) <= window.to,
  );
function invoiceTax(x, kind) {
  const lines = x.lines || rowDefinitions[kind].values;
  const total = calculate(kind, lines);
  return { base: total.base, tax: total.tax };
}
function vatTotals(window = vatWindow()) {
  const sales = taxBills('sale', window),
    purchases = taxBills('buy', window);
  const credits = saleAdjustments.filter(
    (x) => x.state === 'Đã ghi sổ' && x.day >= window.from && x.day <= window.to,
  );
  const sumTax = (list, kind) => list.reduce((n, x) => n + invoiceTax(x, kind).tax, 0);
  const saleGroups = Object.fromEntries(vatRates.map(([key]) => [key, { base: 0, tax: 0 }]));
  for (const x of sales)
    for (const [, , qty, price, rate] of x.lines || rowDefinitions.sale.values) {
      const bucket = saleGroups[String(rate)];
      if (bucket) {
        bucket.base += qty * price;
        bucket.tax += Math.round((qty * price * (Number(rate) || 0)) / 100);
      }
    }
  for (const x of credits)
    if (saleGroups[x.rate]) {
      saleGroups[x.rate].base -= x.base;
      saleGroups[x.rate].tax -= x.tax;
    }
  return {
    output: sumTax(sales, 'sale') - credits.reduce((n, x) => n + x.tax, 0),
    input: sumTax(
      purchases.filter((x) => x.taxReview === 'Đủ hồ sơ (mẫu)'),
      'buy',
    ),
    pending: sumTax(
      purchases.filter((x) => x.taxReview !== 'Đủ hồ sơ (mẫu)'),
      'buy',
    ),
    purchaseBase: purchases.reduce((sum, x) => sum + invoiceTax(x, 'buy').base, 0),
    purchaseTax: sumTax(purchases, 'buy'),
    saleGroups,
    hasActivity: Boolean(sales.length || purchases.length || credits.length),
  };
}
function vatInvoices() {
  const kind = tab === 1 ? 'buy' : 'sale',
    buy = kind === 'buy';
  const totals = vatTotals();
  const rows = taxBills(kind).map((x) => {
    const { base, tax } = invoiceTax(x, kind);
    return [
      x.code.startsWith('PL-') ? a('27?type=scrap', x.code) : recordLink(kind, x.code),
      esc(x.party),
      x.day,
      money(base),
      money(tax),
      pill(
        buy ? x.taxReview || 'Chờ kiểm tra hồ sơ' : x.einv || 'Chờ phát hành',
        buy && x.taxReview === 'Đủ hồ sơ (mẫu)' ? 'good' : 'attn',
      ),
      buy ? b('tax-review-' + x.code, 'Rà soát hồ sơ', 'link') : a('27?einv=Chờ%20phát%20hành', 'Mở HĐĐT'),
    ];
  });
  if (!buy)
    rows.push(
      ...saleAdjustments
        .filter((x) => x.state === 'Đã ghi sổ' && x.day >= vatWindow().from && x.day <= vatWindow().to)
        .map((x) => [
          a('27?type=adjustment', x.code),
          esc(x.party),
          isoDate(x.day),
          money(-x.base),
          money(-x.tax),
          pill('Điều chỉnh'),
          a('27?type=adjustment', 'Xem'),
        ]),
    );
  return (
    cards([
      ['Thuế đầu ra', money(totals.output)],
      ['Đầu vào đủ hồ sơ · Mẫu', money(totals.input)],
      ['Đầu vào chờ kiểm tra', money(totals.pending)],
    ]) +
    card(
      tabs(['Bán ra', 'Mua vào'], tab) +
        table(
          ['Hóa đơn', 'Đối tác', 'Ngày', 'Tiền chưa thuế', 'Thuế GTGT', 'Tình trạng', 'Thao tác'],
          rows,
          [3, 4],
        ),
    ) +
    '<div class="actions">' +
    jump(17, 'Mở tờ khai GTGT') +
    '</div>'
  );
}
function vatReturnRows(model) {
  const { output, input, purchaseBase, purchaseTax, saleGroups: g, hasActivity } = model;
  const turnover = g['0'].base + g['5'].base + g['8'].base + g['10'].base;
  const noTax = g.kct.base,
    nonDeclaration = g.kkk.base;
  const net = output - input;
  const rows = [
    ['21', 'Không phát sinh mua, bán trong kỳ', hasActivity ? '—' : 'Có'],
    ['22', 'Thuế còn được khấu trừ chuyển từ kỳ trước', 0],
    ['23', 'Giá trị mua vào', purchaseBase],
    ['24', 'Thuế GTGT mua vào', purchaseTax],
    ['23a', 'Giá trị nhập khẩu', null],
    ['24a', 'Thuế GTGT hàng nhập khẩu', null],
    ['25', 'Thuế đầu vào được khấu trừ kỳ này', input],
    ['26', 'Bán ra không chịu thuế', noTax],
    ['27', 'Giá trị bán ra chịu thuế', turnover + nonDeclaration],
    ['28', 'Thuế GTGT bán ra', output],
    ['29', 'Giá trị bán ra thuế suất 0%', g['0'].base],
    ['30', 'Giá trị bán ra thuế suất 5%', g['5'].base],
    ['31', 'Thuế bán ra nhóm 5%', g['5'].tax],
    ['32', 'Giá trị nhóm 10%, gồm phần được giảm còn 8%', g['10'].base + g['8'].base],
    ['33', 'Thuế thực tế của nhóm 10% và 8%', g['10'].tax + g['8'].tax],
    ['32a', 'Giá trị bán ra không kê khai, tính nộp', nonDeclaration],
    ['32b', 'Khoản bán ra không tính vào giá tính thuế', null],
    ['34', 'Tổng giá trị bán ra', turnover + nonDeclaration + noTax],
    ['34a', 'Bán ra ngoài phạm vi pháp luật thuế GTGT', null],
    ['35', 'Tổng thuế đầu ra', output],
    ['36', 'Thuế phát sinh trong kỳ', net],
    ['37', 'Điều chỉnh giảm khấu trừ kỳ trước', null],
    ['38', 'Điều chỉnh tăng khấu trừ kỳ trước', null],
    ['39a', 'Thuế được khấu trừ nhận bàn giao', null],
    ['40a', 'Thuế phải nộp của hoạt động kinh doanh', Math.max(0, net)],
    ['40b', 'Thuế được bù trừ từ dự án đầu tư', null],
    ['40', 'Thuế còn phải nộp', Math.max(0, net)],
    ['41', 'Thuế đầu vào chưa khấu trừ hết', Math.max(0, -net)],
    ['42', 'Thuế đề nghị hoàn', null],
    ['43', 'Thuế còn khấu trừ chuyển kỳ sau', Math.max(0, -net)],
  ];
  return rows.map(([id, label, value]) => [
    '[' + id + ']',
    label,
    value === null ? '—' : typeof value === 'number' ? money(value) : value,
  ]);
}
function taxReturn(pit) {
  const k = pit ? 'pit' : 'vat',
    state = pit ? stage : vatReturnState(),
    value = state[k];
  const history = pit ? taxHistory.pit : state.history;
  const model = state[k + 'Snapshot'] || vatTotals();
  const { pending } = model;
  const rows = pit
    ? [
        ['21', 'Tổng số người lao động', String(new Set(pitRows().map((x) => x.employee)).size)],
        ['27', 'Thu nhập chịu thuế', 'Chưa xác định trên bản thử'],
        ['32', 'Thuế TNCN đã khấu trừ', money(pitRows().reduce((n, x) => n + x.pit, 0))],
      ]
    : vatReturnRows(model);
  const taxTable = table(['Mã chỉ tiêu', 'Nội dung', 'Giá trị'], rows, [2]);
  const payable = pit ? '' : rows.find(([id]) => id === '[40]')[2];
  const footer =
    '<tfoot><tr><td colspan="2"><strong>Tổng tiền thuế GTGT còn phải nộp</strong></td><td class="num"><strong>' +
    esc(payable) +
    '</strong></td></tr></tfoot>';
  const version = state[k + 'Version'] || 0;
  return (
    pad(
      'Kỳ kê khai ' + (pit ? taxPeriod : vatWindow().label),
      (!pit
        ? '<div class="filters">' + field('Chọn kỳ kê khai', 'vatReportDate', vatDate, 'date') + '</div>'
        : '') +
        meta([
          ['Trạng thái', pill(value, value === 'Đã nộp' ? 'good' : '')],
          ['Phiên bản', version ? 'Bổ sung lần ' + version : 'Lần đầu'],
        ]) +
        (!pit
          ? '<p style="margin-top:10px">' +
            a(16, 'Đối chiếu bảng kê hóa đơn') +
            (vatWindow().due ? ' · Hạn nộp ' + isoDate(vatWindow().due) : '') +
            ' ' +
            vatDeadlineStatus() +
            '</p>'
          : '<p style="margin-top:10px">' + a(20, 'Xem dữ liệu khấu trừ') + '</p>'),
    ) +
    (!pit && pending
      ? pad(
          '',
          note(
            money(pending) + ' thuế đầu vào đang chờ rà soát hồ sơ. Kiểm tra bảng kê mua vào trước khi chốt.',
          ),
        )
      : '') +
    card(pit ? taxTable : taxTable.replace('</table>', footer + '</table>')) +
    (!pit
      ? pad(
          '',
          note(
            'Bản đối chiếu từ hóa đơn trong kỳ. Số chuyển kỳ trước giả định bằng 0. Nhập khẩu, điều chỉnh kỳ trước, bù trừ và hoàn thuế chưa có dữ liệu. Khi có mức 8%, cần rà phụ lục giảm thuế trước khi lập hồ sơ chính thức.',
          ),
        )
      : '') +
    pad(
      'Hồ sơ kê khai',
      '<div class="actions">' +
        (value === 'Nháp'
          ? b('tax-close-' + k, 'Chốt số liệu', 'primary')
          : value === 'Đã chốt'
            ? b('xml', 'Xuất XML') +
              b('tax-file-' + k, 'Ghi nhận đã nộp', 'primary') +
              b('tax-reopen-' + k, 'Mở lại số liệu')
            : b('tax-amend-' + k, 'Lập tờ khai bổ sung', 'primary')) +
        '</div>' +
        (state[k + 'Receipt'] ? note(esc(state[k + 'Receipt'])) : '') +
        table(
          ['Phiên bản', 'Thao tác', 'Ghi chú'],
          history.map((row) => row.map(esc)),
        ),
    )
  );
}
function einvoices() {
  const invoices = records.sale.filter((x) => x.state === 'Đã ghi sổ');
  const visible = invoices.filter(
    (x) => !tab || (x.einv || 'Chờ phát hành') === ['', 'Chờ phát hành', 'Đã cấp mã', 'Lỗi'][tab],
  );
  return (
    cards([
      ['Chờ phát hành', invoices.filter((x) => !x.einv || x.einv === 'Chờ phát hành').length],
      ['Đã cấp mã', invoices.filter(issued).length],
      ['Có lỗi', invoices.filter((x) => x.einv === 'Lỗi').length],
    ]) +
    card(
      tabs(['Tất cả', 'Chờ phát hành', 'Đã cấp mã', 'Lỗi'], tab) +
        table(
          ['Chứng từ bán', 'Khách hàng', 'Ngày', 'Số HĐĐT', 'Tình trạng', 'Thao tác'],
          visible.map((x) => [
            recordLink('sale', x.code),
            esc(x.party),
            x.day,
            esc(x.vnpt?.number || '—'),
            pill(x.einv || 'Chờ phát hành', issued(x) ? 'good' : x.einv === 'Lỗi' ? 'bad' : 'attn'),
            b(
              'einv-' + x.code,
              issued(x) ? 'Xem thông tin VNPT' : x.einv === 'Lỗi' ? 'Xem lỗi / Thử lại' : 'Phát hành',
              'link',
            ),
          ]),
        ),
    )
  );
}
const pitRows = () => postedWages().filter((x) => postingPeriod(x.day) === taxPeriod);
function pitRegister() {
  return (
    card(
      table(
        ['Nhân viên', 'Lương gộp', 'Thuế đã khấu trừ', 'Bút toán'],
        pitRows().map((x) => [esc(x.name), money(x.gross), money(x.pit), journalAnchor('JV-' + x.code)]),
        [1, 2],
      ),
    ) +
    '<div class="actions">' +
    jump(21, 'Mở tờ khai 05/KK-TNCN') +
    '</div>'
  );
}
const citSampleYear = taxPeriod.split('/')[1];
const citYears = { 18: citSampleYear, 19: citSampleYear };
const citQuarters = ['Quý I', 'Quý II', 'Quý III', 'Quý IV'];
let citQuarter = 'Quý IV';
const citInputs = new Map();

function citPeriod(annual) {
  const year = citYears[annual ? 19 : 18];
  return {
    year,
    key: annual ? year : year + '/' + citQuarter,
    label: annual ? 'năm ' + year : 'quý ' + citQuarter.slice(4) + '/' + year,
  };
}

function citYearOptions() {
  const currentYear = Number(todayKey().slice(0, 4));
  const recentYears = Array.from({ length: 5 }, (_, index) => String(currentYear - index));
  const journalYears = records.journal
    .filter((entry) => validDate(entry.day))
    .map((entry) => dayKey(entry.day).slice(0, 4));
  return [...new Set([...recentYears, citSampleYear, ...journalYears])].sort((a, b) => Number(b) - Number(a));
}

$('app').addEventListener('change', ({ target }) => {
  if (page !== '18' && page !== '19') return;
  if (target.name === 'citYear' && citYearOptions().includes(target.value)) citYears[page] = target.value;
  else if (page === '18' && target.name === 'citQuarter' && citQuarters.includes(target.value))
    citQuarter = target.value;
  else return;
  render();
  $('app')
    .querySelector('select[name="' + target.name + '"]')
    .focus();
});

function citEstimate({ profit, plus, minus, rate }) {
  const taxable = Math.max(0, profit + plus - minus);
  return { taxable, tax: Math.round((taxable * rate) / 100) };
}

function calculateCit() {
  const period = citPeriod(page === '19');
  const fields = $('cit-inputs');
  const inputs = Object.fromEntries(
    ['profit', 'plus', 'minus', 'rate', 'paid'].map((name) => {
      const field = fields.querySelector('[name="' + name + '"]');
      return [name, Number(name === 'rate' ? field.value : moneyRaw(field.value)) || 0];
    }),
  );
  const { taxable, tax } = citEstimate(inputs);
  citInputs.set(period.key, inputs);
  render();
  return openModal(
    'Kết quả tính minh họa · ' + period.label,
    meta([
      ['Thu nhập tính thuế', money(taxable)],
      ['Thuế sau khi trừ tạm nộp', money(tax - inputs.paid)],
    ]),
    () => '',
    'Đóng',
  );
}

function cit(annual) {
  const period = citPeriod(annual);
  const sample = period.year === citSampleYear && (annual || citQuarter === 'Quý IV');
  const current = citInputs.get(period.key) || {
    profit: sample ? 42000000 : 0,
    plus: sample ? 2000000 : 0,
    minus: 0,
    rate: 20,
    paid: sample && annual ? 7200000 : 0,
  };
  const { tax } = citEstimate(current);
  return (
    pad(
      '',
      '<div class="filters">' +
        select('Năm', 'citYear', citYearOptions(), period.year) +
        (annual ? '' : select('Quý', 'citQuarter', citQuarters, citQuarter)) +
        '</div>',
    ) +
    cards([
      ['Lợi nhuận kế toán trước thuế', money(current.profit)],
      ['Điều chỉnh tăng thu nhập chịu thuế', money(current.plus)],
      ['Thuế TNDN ước tính', money(tax)],
    ]) +
    pad(
      (annual ? 'Quyết toán ' : 'Tạm tính ') + period.label,
      '<div id="cit-inputs">' +
        grid(
          field('Lợi nhuận trước thuế', 'profit', current.profit, 'number'),
          field('Điều chỉnh tăng', 'plus', current.plus, 'number'),
          field('Điều chỉnh giảm', 'minus', current.minus, 'number'),
          field('Thuế suất minh họa (%)', 'rate', current.rate, 'number'),
          field('Thuế đã tạm nộp', 'paid', current.paid, 'number'),
        ) +
        '</div><div class="actions right" style="margin-top:12px">' +
        b('cit-calc', 'Tính lại', 'primary') +
        (annual ? b('export', 'Xuất bảng rà soát') : '') +
        '</div>',
    )
  );
}
