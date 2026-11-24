const periodFields = () =>
  '<div class="filters">' + select('Kỳ báo cáo', 'period', ['11/2026', '10/2026', 'Năm 2026']) + '</div>';
const journalOpening = {
  1111: 49100000,
  152: 77900000,
  155: 14400000,
  2111: 240000000,
  2141: -12000000,
  242: 12000000,
  3411: -120000000,
  411: -245800000,
  4211: -15600000,
};
const configuredOpeningDay = () => (stage.settings?.[0]?.openingMonth || '2026-11') + '-01';
const openingPeriod = () => postingPeriod(savedOpening?.day || configuredOpeningDay());
const openingCodes = () => [
  ...new Set([...Object.keys(journalOpening), ...Object.keys(savedOpening?.balances || {})]),
];
function beginningAmount(code, period, lines = journalLines()) {
  const custom = savedOpening && monthKey(period) >= monthKey(openingPeriod());
  const base = custom ? savedOpening.balances[code] || 0 : journalOpening[code] || 0;
  return lines
    .filter(
      (line) =>
        line.code === code &&
        monthKey(monthOf(line)) < monthKey(period) &&
        (!custom || monthKey(monthOf(line)) >= monthKey(openingPeriod())),
    )
    .reduce((total, line) => total + line.debit - line.credit, base);
}
const accountCode = (value) => String(value).split(' · ')[0];
const accountName = (code) => accounts.find((value) => accountCode(value) === code)?.split(' · ')[1] || code;
function journalLines() {
  return records.journal
    .filter((entry) => entry.state !== 'Nháp')
    .flatMap((entry) => {
      const rows = entry.lines || rowDefinitions.journal.values;
      return rows.flatMap(([account, party, debit, credit]) => {
        const line = {
          entry,
          code: accountCode(account),
          party,
          debit: Number(debit) || 0,
          credit: Number(credit) || 0,
          reversal: false,
        };
        return entry.state === 'Đã hủy'
          ? [line, { ...line, debit: line.credit, credit: line.debit, reversal: true }]
          : [line];
      });
    });
}
const monthOf = (line) => line.entry.day.slice(3);
const monthKey = (month) => month.split('/').reverse().join('');
function ledgerFilters(id) {
  const selectOptions = (values, chosen) =>
    [...new Set(values)]
      .map(
        ([value, label]) =>
          '<option value="' +
          esc(value) +
          '" ' +
          (value === chosen ? 'selected' : '') +
          '>' +
          esc(label) +
          '</option>',
      )
      .join('');
  return (
    '<div class="filters">' +
    (id === 11
      ? '<label>Tài khoản<select id="ledger-account">' +
        selectOptions(
          accounts.map((value) => [accountCode(value), value]),
          ledgerCode,
        ) +
        '</select></label>'
      : '') +
    '<div class="report-month-control">' +
    monthPickerButton('ledger', 'Kỳ báo cáo', ledgerMonth) +
    '</div></div>'
  );
}
let cashRange = { month: '11/2026' };
const cashHeaders = ['Ngày', 'Chứng từ', 'Diễn giải', 'Thu', 'Chi', 'Tồn quỹ'];
function cashReport(range = cashRange, all = journalLines()) {
  const from = range.from || dayKey('01/' + range.month),
    to = range.to || periodEnd(range.month);
  const cashCodes = [
    ...new Set(['1111', ...all.map((line) => line.code), ...Object.keys(savedOpening?.balances || {})]),
  ].filter((code) => code.startsWith('1111'));
  const opening =
    cashCodes.reduce((total, code) => total + beginningAmount(code, postingPeriod(from), all), 0) +
    all
      .filter(
        (line) =>
          line.code.startsWith('1111') &&
          monthOf(line) === postingPeriod(from) &&
          dayKey(line.entry.day) < from,
      )
      .reduce((sum, line) => sum + line.debit - line.credit, 0);
  const reset = savedOpening?.day;
  const rows = [];
  let balance = opening,
    receiptsTotal = 0,
    paymentsTotal = 0;
  const movements = all
    .filter(
      (line) =>
        line.code.startsWith('1111') && dayKey(line.entry.day) >= from && dayKey(line.entry.day) <= to,
    )
    .sort((a, b) => dayKey(a.entry.day).localeCompare(dayKey(b.entry.day)));
  let resetPending = reset && from < reset && reset <= to;
  const addOpening = () => {
    balance = cashCodes.reduce((total, code) => total + (savedOpening.balances[code] || 0), 0);
    rows.push({
      day: isoDate(reset),
      code: '',
      party: 'Số dư đầu kỳ đã thiết lập',
      debit: 0,
      credit: 0,
      balance,
    });
    resetPending = false;
  };
  for (const line of movements) {
    if (resetPending && dayKey(line.entry.day) >= reset) addOpening();
    receiptsTotal += line.debit;
    paymentsTotal += line.credit;
    balance += line.debit - line.credit;
    rows.push({
      day: line.entry.day,
      code: line.entry.code,
      party: line.entry.party,
      debit: line.debit,
      credit: line.credit,
      balance,
      reversal: line.reversal,
    });
  }
  if (resetPending) addOpening();
  return { from, to, opening, balance, receiptsTotal, paymentsTotal, rows };
}
function cashReportView() {
  const report = cashReport(),
    month = cashRange.month;
  const filter =
    '<form id="cash-report-filter"><div class="filters">' +
    '<label>Kỳ báo cáo<select name="mode"><option value="month"' +
    (month ? ' selected' : '') +
    '>Theo tháng</option><option value="range"' +
    (!month ? ' selected' : '') +
    '>Khoảng ngày</option></select></label>' +
    '<div data-cash-month class="report-month-control"><input type="hidden" name="month" value="' +
    esc(report.from.slice(0, 7)) +
    '">' +
    monthPickerButton('cash', 'Tháng báo cáo', postingPeriod(report.from)) +
    '</div>' +
    '<div class="cash-date-range" data-cash-range>' +
    field('Từ ngày', 'from', report.from, 'date') +
    field('Đến ngày', 'to', report.to, 'date') +
    '</div>' +
    '<button type="submit" class="primary">Áp dụng</button></div><p class="err cash-filter-error" role="alert"></p></form>';
  const rows = report.rows.map((row) => [
    esc(row.day),
    row.code ? recordLink('journal', row.code) + (row.reversal ? ' ' + pill('Đảo', 'attn') : '') : '—',
    esc(row.party),
    row.debit ? money(row.debit) : '—',
    row.credit ? money(row.credit) : '—',
    money(row.balance),
  ]);
  return (
    card(filter) +
    cards([
      ['Tồn đầu kỳ', money(report.opening)],
      ['Tổng thu', money(report.receiptsTotal)],
      ['Tổng chi', money(report.paymentsTotal)],
      ['Tồn cuối kỳ', money(report.balance)],
    ]) +
    card(
      '<div class="pad"><h2>Phát sinh từ ' +
        isoDate(report.from) +
        ' đến ' +
        isoDate(report.to) +
        '</h2></div>' +
        table(cashHeaders, rows, [3, 4, 5]),
    )
  );
}
function monthPickerButton(scope, label, value) {
  return (
    '<span id="' +
    scope +
    '-month-label">' +
    esc(label) +
    '</span>' +
    '<button type="button" data-do="' +
    scope +
    '-pick-month" aria-labelledby="' +
    scope +
    '-month-label ' +
    scope +
    '-month-value" aria-haspopup="dialog"><span id="' +
    scope +
    '-month-value">' +
    esc(value) +
    '</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg></button>'
  );
}
function pickReportMonth(value, onSelect, title = 'Chọn tháng báo cáo') {
  const [year, month] = value.split('-');
  const months = Array.from({ length: 12 }, (_, index) => {
    const value = String(index + 1).padStart(2, '0');
    return (
      '<label><input type="radio" name="cashMonthChoice" value="' +
      value +
      '"' +
      (value === month ? ' checked' : '') +
      '><span>Tháng ' +
      (index + 1) +
      '</span></label>'
    );
  }).join('');
  openModal(
    title,
    '<label>Năm<input type="number" name="cashYear" min="1000" max="9999" step="1" required value="' +
      esc(year) +
      '"></label>' +
      '<fieldset class="cash-month-grid"><legend>Tháng</legend>' +
      months +
      '</fieldset>',
    (data) => {
      const nextYear = data.get('cashYear'),
        nextMonth = data.get('cashMonthChoice');
      if (!/^\d{4}$/.test(nextYear) || !/^(0[1-9]|1[0-2])$/.test(nextMonth))
        return 'Chọn tháng và năm hợp lệ.';
      onSelect(nextYear + '-' + nextMonth);
      return '';
    },
    'Chọn tháng',
  );
}
function syncCashFilter(form) {
  const month = form.elements.mode.value === 'month';
  for (const [selector, visible] of [
    ['[data-cash-month]', month],
    ['[data-cash-range]', !month],
  ]) {
    const group = form.querySelector(selector);
    group.hidden = !visible;
    group.querySelectorAll('input').forEach((input) => {
      input.disabled = !visible;
      input.required = visible;
    });
  }
  form.querySelector('.cash-filter-error').textContent = '';
}
function applyCashFilter(form) {
  const data = form.elements;
  const month = data.month.value;
  const from = data.from.value,
    to = data.to.value;
  const useMonth = data.mode.value === 'month';
  if (useMonth ? !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) : !validDate(from) || !validDate(to) || from > to) {
    form.querySelector('.cash-filter-error').textContent = useMonth
      ? 'Chọn tháng báo cáo hợp lệ.'
      : 'Chọn Từ ngày và Đến ngày hợp lệ. Đến ngày phải từ ngày bắt đầu trở đi.';
    return;
  }
  cashRange = useMonth ? { month: postingPeriod(month + '-01') } : { from, to };
  render();
}
function exportCashReport() {
  const report = cashReport();
  const rows = [
    ['Sổ quỹ tiền mặt', isoDate(report.from), isoDate(report.to)],
    ['Tồn đầu kỳ', report.opening],
    cashHeaders,
    ...report.rows.map((row) => [
      row.day,
      row.code + (row.reversal ? ' (Đảo)' : ''),
      row.party,
      row.debit,
      row.credit,
      row.balance,
    ]),
    ['Tổng thu', report.receiptsTotal],
    ['Tổng chi', report.paymentsTotal],
    ['Tồn cuối kỳ', report.balance],
  ];
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? "'" + value : String(value);
          return '"' + safe.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'So-quy-' + report.from + '_' + report.to + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ledgers(id) {
  if (id === 9) return cashReportView();
  const all = journalLines();
  const lines = all
    .filter((line) => monthOf(line) === ledgerMonth)
    .sort((a, b) => a.entry.day.localeCompare(b.entry.day));
  const opening = (code) => beginningAmount(code, ledgerMonth, all);
  const display = (n) => (n ? money(n) : '—');
  const source = (line) =>
    recordLink('journal', line.entry.code) + (line.reversal ? ' ' + pill('Đảo', 'attn') : '');
  if (id === 11) {
    const entries = lines.filter((line) => line.code === ledgerCode);
    let balance = opening(ledgerCode);
    const rows = entries.map((line) => [
      esc(line.entry.day),
      source(line),
      esc(line.entry.party),
      display(line.debit),
      display(line.credit),
      money((balance += line.debit - line.credit)),
      line.entry.code,
    ]);
    return (
      cards([
        ['Dư đầu kỳ', money(opening(ledgerCode))],
        ['Dư cuối kỳ', money(balance)],
      ]) +
      card(
        ledgerFilters(id) +
          (ledgerDocument
            ? pad('', esc(ledgerDocument) + ' · ' + b('clear-ledger-doc', 'Bỏ lọc bút toán', 'link'))
            : '') +
          table(
            ['Ngày', 'Bút toán', 'Diễn giải', 'Nợ', 'Có', 'Số dư Nợ − Có'],
            rows.filter((row) => !ledgerDocument || row[6] === ledgerDocument).map((row) => row.slice(0, 6)),
            [3, 4, 5],
          ),
      )
    );
  }
  if (id === 12) {
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(lines.length / pageSize));
    const requestedPage = Number(routeParams().get('page'));
    const currentPage = Number.isInteger(requestedPage) ? Math.min(pageCount, Math.max(1, requestedPage)) : 1;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, lines.length);
    const pageLink = (number, label) =>
      a('12?' + new URLSearchParams({ period: ledgerMonth, page: number }), label);
    const pagination = lines.length
      ? '<div class="subfoot journal-pagination"><span>Dòng ' +
        (start + 1) +
        '–' +
        end +
        ' / ' +
        lines.length +
        '</span>' +
        (pageCount > 1
          ? '<nav aria-label="Phân trang nhật ký chung">' +
            (currentPage > 1 ? pageLink(currentPage - 1, 'Trang trước') : '') +
            '<span>Trang ' +
            currentPage +
            ' / ' +
            pageCount +
            '</span>' +
            (currentPage < pageCount ? pageLink(currentPage + 1, 'Trang sau') : '') +
            '</nav>'
          : '') +
        '</div>'
      : '';
    return card(
      ledgerFilters(id) +
        table(
          ['Ngày ghi sổ', 'Chứng từ', 'Diễn giải', 'TK', 'Nợ', 'Có'],
          lines
            .slice(start, end)
            .map((line) => [
              esc(line.entry.day),
              source(line),
              esc(line.entry.party),
              line.code,
              display(line.debit),
              display(line.credit),
            ]),
          [4, 5],
        ) +
        pagination,
    );
  }
  const codes = [...new Set([...openingCodes(), ...all.map((line) => line.code)])].sort();
  const amounts = codes.map((code) => {
    const entries = lines.filter((line) => line.code === code),
      start = opening(code);
    const debit = entries.reduce((n, x) => n + x.debit, 0),
      credit = entries.reduce((n, x) => n + x.credit, 0),
      end = start + debit - credit;
    return [Math.max(0, start), Math.max(0, -start), debit, credit, Math.max(0, end), Math.max(0, -end)];
  });
  const totals = Array.from({ length: 6 }, (_, i) => amounts.reduce((n, row) => n + row[i], 0));
  const rows = codes.map((code, i) => [
    b('ledger-' + code, code, 'link'),
    esc(accountName(code)),
    ...amounts[i].map(display),
  ]);
  return (
    card(
      ledgerFilters(id) +
        table(
          ['TK', 'Tên tài khoản', 'Dư đầu Nợ', 'Dư đầu Có', 'PS Nợ', 'PS Có', 'Dư cuối Nợ', 'Dư cuối Có'],
          [...rows, ['', '<b>Tổng cộng</b>', ...totals.map((n) => '<b>' + display(n) + '</b>')]],
          [2, 3, 4, 5, 6, 7],
        ),
    ) +
    pad(
      '',
      note(
        'Bảng này dùng để đối chiếu theo tháng. F01-DNN chính thức dùng dữ liệu và mẫu xuất năm tài chính.',
      ),
    )
  );
}
function reconciliation() {
  const { rows, toolbar } = searchList(
    'bank',
    bank,
    'Tìm mã giao dịch hoặc nội dung sao kê',
    (x) => [x[1], x[2]],
    [
      [
        'status',
        'Tất cả trạng thái đối chiếu',
        columnChoices(['Chờ khớp', 'Đã khớp', ...bank.map((x) => x[4])]),
        (x) => x[4],
      ],
      [
        'period',
        'Tất cả kỳ sao kê',
        columnChoices(bank.map((x) => postingPeriod(x[0]))),
        (x) => postingPeriod(x[0]),
      ],
    ],
  );
  return (
    cards([
      [
        'Số dư sổ cái TK 1121',
        money(postedAmount('1121', closingPeriod)),
        '11?account=1121&period=' + encodeURIComponent(closingPeriod),
      ],
      ['Dòng sao kê', bank.length],
      ['Đã khớp', bank.filter((x) => x[4] === 'Đã khớp').length],
      ['Chờ xử lý', bank.filter((x) => x[4] === 'Chờ khớp').length],
    ]) +
    card(
      toolbar +
        table(
          ['Ngày', 'Mã giao dịch', 'Nội dung', 'Số tiền', 'Đối chiếu', 'Thao tác'],
          rows.map((x) => [
            esc(x[0]),
            esc(x[1]),
            esc(x[2]),
            money(x[3]),
            pill(x[4], x[4] === 'Đã khớp' ? 'good' : 'attn') +
              (x[5] ? ' <small class="muted">' + esc(x[5]) + '</small>' : ''),
            b('match-' + bank.indexOf(x), x[4] === 'Đã khớp' ? 'Bỏ khớp' : 'Đối chiếu', 'link') +
              (x[4] === 'Đã khớp' ? '' : b('bank-create-' + bank.indexOf(x), 'Tạo chứng từ', 'link')),
          ]),
          [3],
        ),
    )
  );
}
const financialLabels = ['B01a-DNN', 'B02-DNN', 'B09-DNN', 'F01-DNN', 'Biến động tiền'];
function financialData(index, period) {
  const all = journalLines();
  const lines = all.filter((line) => monthOf(line) === period);
  const codes = [...new Set([...openingCodes(), ...all.map((line) => line.code)])];
  const net = (rows, prefix) =>
    rows
      .filter((row) => row.code.startsWith(prefix))
      .reduce((total, row) => total + row.debit - row.credit, 0);
  if (index === 0) return balanceReport(period, all, codes);
  if (index === 1) {
    const activity = lines.filter((line) => !line.entry.closeEntry);
    const revenue = -net(activity, '511'),
      cost = net(activity, '632');
    const financialIncome = -net(activity, '515'),
      expenses = net(activity, '6') - cost;
    const other = -net(activity, '711') - net(activity, '811'),
      tax = net(activity, '821');
    return {
      cols: ['Chỉ tiêu', 'Phát sinh trong kỳ'],
      rows: [
        ['Doanh thu bán hàng và cung cấp dịch vụ', revenue],
        ['Giá vốn hàng bán', cost],
        ['Lợi nhuận gộp', revenue - cost],
        ['Doanh thu tài chính', financialIncome],
        ['Chi phí tài chính và quản lý kinh doanh', expenses],
        ['Thu nhập khác trừ chi phí khác', other],
        ['Chi phí thuế TNDN', tax],
        ['Lợi nhuận sau thuế', revenue - cost + financialIncome - expenses + other - tax],
      ],
    };
  }
  const cash = codes.filter((code) => /^11[12]/.test(code));
  const start = cash.reduce((total, code) => total + beginningAmount(code, period, all), 0);
  const change = net(lines, '111') + net(lines, '112');
  return {
    cols: ['Chỉ tiêu', 'Số tiền'],
    rows: [
      ['Tiền đầu kỳ', start],
      ['Biến động thuần TK 111, 112', change],
      ['Tiền cuối kỳ', start + change],
    ],
  };
}
function partnerBalances(code, period, asOfEnd = true, all = journalLines()) {
  const key = code.startsWith('3319') ? 'suppliers' : partyType(code);
  const hasOpening = savedOpening && monthKey(period) >= monthKey(openingPeriod());
  const buckets = new Map();
  const add = (party, amount) => {
    const supplier = code.startsWith('3319') ? receipts.find((row) => row.code === party)?.party : party;
    const id = catalogMatch(key, supplier)?.code || supplier || party || '';
    buckets.set(id, (buckets.get(id) || 0) + amount);
  };
  if (hasOpening)
    for (const [account, party, d, c] of savedOpening.rows)
      if (accountCode(account) === code) add(party, Number(d || 0) - Number(c || 0));
  for (const line of all)
    if (
      line.code === code &&
      monthKey(monthOf(line)) <= monthKey(period) &&
      (asOfEnd || monthOf(line) !== period) &&
      (!hasOpening || monthKey(monthOf(line)) >= monthKey(openingPeriod()))
    )
      add(line.party, line.debit - line.credit);
  return buckets;
}
const balanceModel = [
  ['110', 'Tiền và tương đương tiền', '11'],
  ['120', 'Đầu tư tài chính', ['121', '122', '123', '124']],
  ['121', 'Chứng khoán kinh doanh', '121'],
  ['122', 'Đầu tư giữ đến đáo hạn', '128'],
  ['123', 'Đầu tư góp vốn', '228'],
  ['124', 'Dự phòng tổn thất đầu tư', '2291'],
  ['130', 'Các khoản phải thu', ['131', '132', '133', '134', '135', '136']],
  ['131', 'Phải thu khách hàng', 'arDebit'],
  ['132', 'Trả trước cho người bán', 'apDebit'],
  ['133', 'Vốn ở đơn vị trực thuộc', '1361'],
  ['134', 'Phải thu khác', '1319|1368|1388'],
  ['135', 'Tài sản thiếu chờ xử lý', '1381'],
  ['136', 'Dự phòng phải thu khó đòi', '2293'],
  ['140', 'Hàng tồn kho', ['141', '142']],
  ['141', 'Giá trị tồn kho', '15'],
  ['142', 'Dự phòng giảm giá hàng tồn', '2294'],
  ['150', 'Tài sản cố định', ['151', '152']],
  ['151', 'Nguyên giá TSCĐ', '211'],
  ['152', 'Hao mòn lũy kế TSCĐ', '2141|2142'],
  ['160', 'Bất động sản đầu tư', ['161', '162']],
  ['161', 'Nguyên giá BĐS đầu tư', '217'],
  ['162', 'Hao mòn lũy kế BĐS đầu tư', '2147'],
  ['170', 'Xây dựng cơ bản dở dang', '241'],
  ['180', 'Tài sản khác', ['181', '182']],
  ['181', 'Thuế GTGT được khấu trừ', '133'],
  ['182', 'Tài sản khác và chi phí trả trước', 'otherAssets'],
  ['200', 'Tổng tài sản', ['110', '120', '130', '140', '150', '160', '170', '180']],
  ['300', 'Nợ phải trả', ['311', '312', '313', '314', '315', '316', '317', '318', '319', '320']],
  ['311', 'Phải trả người bán', 'apCredit'],
  ['312', 'Người mua trả tiền trước', 'arCredit'],
  ['313', 'Thuế và khoản phải nộp Nhà nước', '333'],
  ['314', 'Phải trả người lao động', '334'],
  ['315', 'Phải trả khác', 'otherLiabilities'],
  ['316', 'Vay và nợ thuê tài chính', '341'],
  ['317', 'Phải trả nội bộ về vốn', '3361'],
  ['318', 'Dự phòng phải trả', '352'],
  ['319', 'Quỹ khen thưởng và phúc lợi', '353'],
  ['320', 'Quỹ phát triển khoa học và công nghệ', '356'],
  ['400', 'Vốn chủ sở hữu', ['411', '412', '413', '414', '415', '416', '417']],
  ['411', 'Vốn góp chủ sở hữu', '4111'],
  ['412', 'Thặng dư vốn cổ phần', '4112'],
  ['413', 'Vốn khác của chủ sở hữu', '4118'],
  ['414', 'Cổ phiếu quỹ', '419'],
  ['415', 'Chênh lệch tỷ giá', '413'],
  ['416', 'Các quỹ thuộc vốn chủ sở hữu', '418'],
  ['417', 'Kết quả sau thuế chưa phân phối', '421|5|6|7|8|911'],
  ['500', 'Tổng nguồn vốn', ['300', '400']],
];
function balanceReport(period, all, codes) {
  const report = (asOfEnd) => {
    const values = {};
    const amounts = new Map(
      codes.map((code) => [
        code,
        asOfEnd ? postedAmount(code, period, all) : beginningAmount(code, period, all),
      ]),
    );
    const take = (prefix) =>
      [...amounts]
        .filter(([code]) => code === prefix || code.startsWith(prefix))
        .reduce((sum, [code, value]) => {
          amounts.delete(code);
          return sum + value;
        }, 0);
    // TK 131/331 must be split by partner, including mixed debit and credit balances.
    for (const [prefix, label] of [
      ['131', 'ar'],
      ['331', 'ap'],
    ]) {
      const balances = new Map();
      for (const code of codes.filter(
        (code) => code.startsWith(prefix) && (label === 'ap' || !code.startsWith(prefix + '9')),
      )) {
        amounts.delete(code);
        for (const [party, value] of partnerBalances(code, period, asOfEnd, all))
          balances.set(party, (balances.get(party) || 0) + value);
      }
      values[label + 'Debit'] = [...balances.values()].reduce((n, v) => n + Math.max(0, v), 0);
      values[label + 'Credit'] = [...balances.values()].reduce((n, v) => n + Math.max(0, -v), 0);
    }
    if (amounts.has('411')) {
      values['411'] = -(amounts.get('411') || 0);
      amounts.delete('411');
    }
    for (const [id, , map] of balanceModel) {
      if (Array.isArray(map) || /^(ar|ap)/.test(map)) continue;
      if (map === 'otherAssets' || map === 'otherLiabilities') continue;
      values[id] =
        (values[id] || 0) +
        (Number(id) >= 300 ? -1 : 1) * map.split('|').reduce((sum, prefix) => sum + take(prefix), 0);
    }
    for (const [id, , map] of balanceModel) {
      if (!Array.isArray(map) && /^(ar|ap)/.test(map)) values[id] = values[map];
      else if (map === 'otherAssets')
        values[id] = [...amounts]
          .filter(([code]) => /^[12]/.test(code))
          .reduce((sum, [, value]) => sum + value, 0);
      else if (map === 'otherLiabilities')
        values[id] = -[...amounts]
          .filter(([code]) => /^3/.test(code))
          .reduce((sum, [, value]) => sum + value, 0);
    }
    for (const [id, , map] of [...balanceModel].reverse())
      if (
        Array.isArray(map) &&
        !map.some((code) => Array.isArray(balanceModel.find(([ref]) => ref === code)?.[2]))
      )
        values[id] = map.reduce((n, code) => n + (values[code] || 0), 0);
    for (const id of ['200', '500']) {
      const [, , children] = balanceModel.find(([key]) => key === id);
      values[id] = children.reduce((n, code) => n + (values[code] || 0), 0);
    }
    return values;
  };
  const start = report(false),
    end = report(true);
  return {
    cols: ['Mã số', 'Chỉ tiêu', 'Đầu kỳ', 'Cuối kỳ'],
    rows: balanceModel.map(([id, label]) => [id, label, start[id] || 0, end[id] || 0]),
  };
}
function financial() {
  const period =
    '<div class="filters">' +
    field('Kỳ báo cáo', 'financialReportDate', financialDate, 'date') +
    '<span class="muted">Tháng ' +
    esc(financialMonth) +
    '</span></div>';
  let body = tab === 2 ? '' : period;
  if (tab === 2)
    body +=
      '<div class="pad">' +
      textArea('Chính sách và phương pháp kế toán', 'explain', stage.explain || '') +
      textArea('Thuyết minh các khoản mục trọng yếu', 'items', stage.items || '') +
      '<div class="actions right" style="margin-top:12px">' +
      b('save-b09', 'Lưu thuyết minh', 'primary') +
      '</div></div>';
  else if (tab === 3)
    body +=
      '<div class="pad">' +
      a(
        '13?period=' + encodeURIComponent(financialMonth),
        'Mở bảng cân đối tài khoản kỳ ' + esc(financialMonth),
      ) +
      '</div>';
  else {
    const { cols, rows } = financialData(tab, financialMonth);
    const numericStart = tab === 0 ? 2 : 1;
    body += table(
      cols,
      rows.map((row) => row.map((value, i) => (i >= numericStart ? money(value) : esc(value)))),
      cols.slice(numericStart).map((_, i) => i + numericStart),
    );
    if (tab === 0) {
      const [, , assetsStart, assetsEnd] = rows.find(([code]) => code === '200');
      const [, , fundsStart, fundsEnd] = rows.find(([code]) => code === '500');
      body += pad(
        'Đối chiếu tổng tài sản và nguồn vốn',
        table(
          ['Chỉ tiêu', 'Đầu kỳ', 'Cuối kỳ'],
          [
            ['Tổng tài sản', money(assetsStart), money(assetsEnd)],
            ['Tổng nguồn vốn', money(fundsStart), money(fundsEnd)],
            ['Chênh lệch', money(assetsStart - fundsStart), money(assetsEnd - fundsEnd)],
          ],
          [1, 2],
        ),
      );
    }
    if (tab === 4)
      body += pad(
        '',
        note('Bản thử tổng hợp biến động tiền theo sổ. Phân loại luồng tiền B03-DNN chưa được mô phỏng.'),
      );
  }
  return (
    pad('', note('Chỉ tiêu xem thử trong phiên, tính theo bút toán đã ghi sổ và số dư đầu kỳ.')) +
    card(tabs(financialLabels, tab) + body)
  );
}
