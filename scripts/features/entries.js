const targets = { journal: 4, pay: 7, sale: 28, buy: 30 };
function recordLink(kind, code) {
  return b('open-' + kind + '-' + code, code, 'link');
}
const listQueries = new Map();
const columnChoices = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')).map((x) => [x, x]);
function searchList(id, rows, placeholder, search, criteria = [], defaults = {}) {
  const query = { ...defaults, ...listQueries.get(id) };
  const terms = normalizedSearch((query.q || '').trim())
    .split(/\s+/)
    .filter(Boolean);
  const filtered = rows.filter((row) => {
    const text = normalizedSearch(
      search(row)
        .filter((x) => x != null)
        .join(' '),
    );
    return (
      terms.every((term) => text.includes(term)) &&
      criteria.every(([key, , choices, get]) => {
        const value = query[key];
        return !value || !choices.some(([choice]) => choice === value) || get(row) === value;
      })
    );
  });
  const selects = criteria
    .map(([key, label, choices]) => {
      const value = choices.some(([choice]) => choice === query[key]) ? query[key] : '';
      return (
        '<select name="' +
        key +
        '" aria-label="' +
        esc(label) +
        '"><option value="">' +
        esc(label) +
        '</option>' +
        choices
          .map(
            ([key, label]) =>
              '<option value="' +
              esc(key) +
              '"' +
              (key === value ? ' selected' : '') +
              '>' +
              esc(label) +
              '</option>',
          )
          .join('') +
        '</select>'
      );
    })
    .join('');
  const clear = Object.values(query).some(Boolean)
    ? '<button type="button" data-clear-list="true" class="link">Xóa lọc</button>'
    : '';
  const toolbar =
    '<form class="document-filters list-tools" data-list-query="' +
    id +
    '" role="search">' +
    '<input type="search" name="q" aria-label="' +
    esc(placeholder) +
    '" placeholder="' +
    esc(placeholder) +
    '" value="' +
    esc(query.q || '') +
    '">' +
    selects +
    '<button type="submit">Tìm</button>' +
    clear +
    '<small class="muted" aria-live="polite">' +
    filtered.length +
    '/' +
    rows.length +
    ' kết quả</small></form>';
  return { rows: filtered, toolbar };
}
const itemStatuses = [
  ['active', 'Đang dùng'],
  ['inactive', 'Ngừng sử dụng'],
];
const itemStatus = (row) => (row.active === false ? 'inactive' : 'active');
const stateTabs = [
  ['', 'Tất cả'],
  ['Nháp', 'Nháp'],
  ['active', 'Đã xác nhận'],
  ['Đã hủy', 'Đã hủy'],
];
const isConfirmed = (state) => ['Đã ghi sổ', 'Đã xác nhận'].includes(state);
const normalizedSearch = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
const dayKey = (value) =>
  String(value || '').includes('/') ? String(value).split('/').reverse().join('-') : String(value || '');
const todayKey = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
function validDate(value) {
  const date = dayKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
function formData(form) {
  const data = new FormData(form);
  for (const input of form.querySelectorAll('[data-money][name]'))
    data.set(input.name, moneyRaw(input.value));
  for (const input of form.querySelectorAll('[data-date]')) {
    const value = input.value.trim();
    if (value && !validDate(value)) return null;
    data.set(input.name, dayKey(value));
  }
  return data;
}
function futureDateError(value) {
  return validDate(value) && dayKey(value) > todayKey()
    ? 'Ngày ' + isoDate(dayKey(value)) + ' ở tương lai. Chọn ngày không sau ' + isoDate(todayKey()) + '.'
    : '';
}
function lockedDateError(value) {
  return validDate(value) && periodLocked(value)
    ? 'Kỳ ' + postingPeriod(value) + ' đã khóa. Chọn ngày trong kỳ đang mở.'
    : '';
}
function validateDateInput(input) {
  const message =
    (input.matches('[data-no-future]') ? futureDateError(input.value) : '') ||
    (input.matches('[data-open-period]') ? lockedDateError(input.value) : '');
  input.setCustomValidity(message);
  input.setAttribute('aria-invalid', String(Boolean(message)));
  input.parentElement.querySelector('.field-error').textContent = message;
  return message;
}
function validateFormDates(form) {
  let first = null;
  for (const input of form.querySelectorAll('[data-no-future],[data-open-period]')) {
    if (validateDateInput(input) && !first) first = input;
  }
  return first;
}
function formatEntryInput(event) {
  const input = event.target;
  if (input.matches('[data-money]')) {
    const raw = input.value;
    const count = raw.slice(0, input.selectionStart ?? raw.length).replace(/\D/g, '').length;
    input.value =
      (input.name === 'profit' && raw.startsWith('-') ? '-' : '') + moneyDisplay(raw.replace(/\D/g, ''));
    let pos = 0,
      left = count;
    for (; pos < input.value.length && left > 0; pos++) if (/\d/.test(input.value[pos])) left--;
    input.setSelectionRange(pos, pos);
  }
  if (input.matches('[data-no-future]') || input.matches('[data-open-period]')) validateDateInput(input);
}
document.addEventListener?.('input', formatEntryInput, true);

function postingDateError(value) {
  if (!validDate(value)) return 'Nhập ngày hạch toán hợp lệ theo dd/mm/yyyy.';
  return futureDateError(value) || lockedDateError(value);
}
function visibleDocuments(items) {
  const terms = normalizedSearch(filter.trim()).split(/\s+/).filter(Boolean);
  return items.filter((x) => {
    const date = dayKey(x.day);
    return (
      (!status || (status === 'active' ? isConfirmed(x.state) : x.state === status)) &&
      terms.every((term) =>
        normalizedSearch(
          [
            x.code,
            x.party,
            x.source,
            x.ref,
            x.item,
            x.description,
            x.product,
            ...(x.lines || []).flatMap((line) => [line.item, line.product]),
            ...(x.items || []).flatMap((row) => [
              row.item,
              itemBy(row.item)?.name,
              row.party,
              row.source,
              row.work,
              warehouseName(row.warehouse),
              warehouseName(row.from),
              warehouseName(row.to),
            ]),
          ].join(' '),
        ).includes(term),
      ) &&
      (!dateFrom || date >= dateFrom) &&
      (!dateTo || date <= dateTo)
    );
  });
}
function documentFilters(placeholder = 'Tìm theo số chứng từ hoặc đối tác') {
  const state = stateTabs
    .map(
      ([value, label], i) =>
        '<button type="button" role="tab" aria-selected="' +
        (value === status) +
        '" class="' +
        (value === status ? 'active' : '') +
        '" data-do="document-state-' +
        i +
        '">' +
        label +
        '</button>',
    )
    .join('');
  return (
    '<form id="document-filters" class="document-filters document-search"><div class="tabs" role="tablist" aria-label="Trạng thái chứng từ">' +
    state +
    '</div>' +
    '<input type="search" name="search" aria-label="' +
    esc(placeholder) +
    '" placeholder="' +
    esc(placeholder) +
    '" value="' +
    esc(filter) +
    '">' +
    field('Từ ngày', 'from', dateFrom, 'date') +
    field('Đến ngày', 'to', dateTo, 'date') +
    '<div class="filter-submit"><button type="submit">Tìm</button>' +
    (filter || dateFrom || dateTo ? b('document-reset', 'Xóa bộ lọc', 'link') : '') +
    '</div></form>'
  );
}
function list(kind) {
  const isInvoice = kind === 'sale' || kind === 'buy';
  const set = visibleDocuments(records[kind]);
  const cols = [
    'Số chứng từ',
    'Ngày',
    kind === 'journal' ? 'Diễn giải' : 'Đối tác',
    ...(isInvoice ? ['Phiếu nguồn'] : []),
    'Tổng tiền',
    ...(isInvoice ? ['Còn thanh toán'] : []),
    'Trạng thái',
  ];
  const rows = set.map((x) => [
    recordLink(kind, x.code),
    x.day,
    esc(x.party),
    ...(isInvoice ? [esc(x.source || '—')] : []),
    money(x.amount),
    ...(isInvoice ? [money(remaining(x))] : []),
    pill(x.state, isConfirmed(x.state) ? 'good' : ''),
  ]);
  return card(
    documentFilters() +
      table(cols, rows, isInvoice ? [4, 5] : [3]) +
      '<div class="subfoot">Hiển thị ' +
      rows.length +
      ' / ' +
      records[kind].length +
      ' chứng từ</div>',
  );
}
function applyDocumentFilters(form) {
  const data = formData(form);
  if (!data) {
    openModal('Kiểm tra ngày', note('Nhập ngày theo dd/mm/yyyy.'), () => '', 'Đóng');
    return false;
  }
  const from = String(data.get('from') || ''),
    to = String(data.get('to') || '');
  if (from && to && from > to) {
    const input = form.elements.to;
    input.setCustomValidity('Đến ngày phải từ ngày bắt đầu trở đi.');
    input.reportValidity();
    input.setCustomValidity('');
    return false;
  }
  filter = String(data.get('search') || '');
  dateFrom = from;
  dateTo = to;
  return true;
}
function formEnd(label = 'Lưu nháp') {
  return '<div class="actions right">' + b('save', label, 'primary') + '</div>';
}
function back(id) {
  return '<p>' + a(id, 'Quay lại ' + registry[id][0].toLowerCase()) + '</p>';
}
const rowDefinitions = {
  journal: {
    cols: ['Tài khoản', 'Đối tượng', 'Nợ', 'Có'],
    values: [
      ['6422 · Chi phí quản lý doanh nghiệp', '', '860000', '0'],
      ['3388 · Phải trả khác', '', '0', '860000'],
    ],
  },
  sale: {
    cols: ['Mặt hàng / dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thuế suất (%)'],
    values: [['Bàn làm việc ván MDF', 'Cái', '12', '1000000', '10']],
  },
  buy: {
    cols: ['Mặt hàng / chi phí', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thuế suất (%)'],
    values: [['Ván MDF chống ẩm', 'Tấm', '20', '400000', '10']],
  },
  pay: { cols: ['Hóa đơn', 'Còn nợ', 'Phân bổ'], values: [['SINV-2026-00065', '7200000', '6000000']] },
  opening: {
    cols: ['Tài khoản', 'Đối tượng', 'Dư Nợ', 'Dư Có'],
    values: [
      ['1111 · Tiền Việt Nam', '', '48000000', '0'],
      ['411 · Vốn đầu tư của chủ sở hữu', '', '0', '48000000'],
    ],
  },
};
const rowOptions = (label, options, current, extra = '') =>
  '<select aria-label="' +
  esc(label) +
  '" ' +
  extra +
  '><option value="">Chọn</option>' +
  options
    .map(
      ([value, name]) =>
        '<option value="' +
        esc(value) +
        '"' +
        (String(current ?? '') === String(value) ? ' selected' : '') +
        '>' +
        esc(name) +
        '</option>',
    )
    .join('') +
  '</select>';
function editRow(kind, values = [], fixed = false, payments) {
  const numericAt = kind === 'pay' ? 1 : 2;
  return (
    '<tr>' +
    rowDefinitions[kind].cols
      .map((c, i) => {
        const value = values[i] ?? '';
        if (i === 0 && kind === 'opening')
          return (
            '<td>' +
            rowOptions(
              c,
              accounts.map((x) => [x, x]),
              value,
              'data-opening-account',
            ) +
            '</td>'
          );
        if (i === 0 && kind === 'journal')
          return (
            '<td><input aria-label="Tìm tài khoản" data-account list="journal-accounts" value="' +
            esc(value) +
            '" placeholder="Mã hoặc tên tài khoản"><small class="muted account-balance"></small></td>'
          );
        if (i === 1 && kind === 'opening') {
          const key = partyType(accountCode(values[0] || ''));
          return '<td data-catalog="' + key + '">' + partyControl(value, key) + '</td>';
        }
        if (i === 1 && kind === 'journal')
          return '<td>' + partyControl(value, partyType(accountCode(values[0] || ''))) + '</td>';
        if (i === 0 && kind === 'pay')
          return '<td>' + rowOptions(c, payments || paymentOptions(), value, 'data-invoice') + '</td>';
        if (i === 4 && ['buy', 'sale'].includes(kind))
          return '<td>' + rowOptions(c, vatRates, value === '' ? '10' : value) + '</td>';
        const readonly = (kind === 'pay' && i === 1) || (fixed && (i < 3 || (kind === 'sale' && i === 3)));
        if (
          ((kind === 'buy' || kind === 'sale') && i === 3) ||
          (['journal', 'opening', 'pay'].includes(kind) && i >= numericAt)
        )
          return (
            '<td>' +
            moneyInput(value, 'aria-label="' + esc(c) + '"' + (readonly ? ' readonly' : '')) +
            '</td>'
          );
        return (
          '<td><input aria-label="' +
          c +
          '" class="' +
          (i === 0 ? 'wide' : '') +
          '" type="' +
          (i >= numericAt ? 'number' : 'text') +
          '" value="' +
          esc(value) +
          '"' +
          (readonly ? ' readonly' : '') +
          '></td>'
        );
      })
      .join('') +
    '<td>' +
    (fixed ? '' : b('delete-row', '×')) +
    '</td></tr>'
  );
}
function partyControl(value, key) {
  if (!key) return '<input aria-label="Đối tượng" value="' + esc(value) + '">';
  return rowOptions(
    'Đối tượng',
    catalogSpec[key].rows.map((row) => [row.code, row.code + ' · ' + row.name]),
    catalogMatch(key, value)?.code,
  );
}
function paymentOptions(type, party) {
  const kind =
    (type || document.querySelector('#entryForm [name=type]')?.value) === 'Chi tiền' ? 'buy' : 'sale';
  const name = party ?? document.querySelector('#entryForm [name=party]')?.value;
  const key = kind === 'buy' ? 'suppliers' : 'customers';
  const target = catalogMatch(key, name);
  return openDebt(kind)
    .filter((x) => target && catalogMatch(key, x.party) === target && !draftForInvoice(x.code, editingEntry))
    .map((x) => [x.code, x.code + ' · ' + money(remaining(x))]);
}
function editor(kind, title, initial, fixed = false, payments) {
  const d = rowDefinitions[kind];
  return card(
    '<div class="pad"><h2>' +
      title +
      '</h2></div><div class="tableScroll"><table><thead><tr>' +
      d.cols.map((x) => '<th>' + x + '</th>').join('') +
      '<th></th></tr></thead><tbody id="editRows" data-kind="' +
      kind +
      '">' +
      (initial ?? d.values).map((v) => editRow(kind, v, fixed, payments)).join('') +
      '</tbody></table></div><div class="subfoot"><span>' +
      (fixed ? '' : b('add-row', '+ Thêm dòng')) +
      '</span><b id="calc"></b></div>',
  );
}
const editWrap = (kind, body) => '<form id="entryForm" data-kind="' + kind + '">' + body + '</form>';
const sampleDate = '2026-11-19';
const vatRates = [
  ['0', '0%'],
  ['5', '5%'],
  ['8', '8%'],
  ['10', '10%'],
  ['kct', 'Không chịu thuế'],
  ['kkk', 'Không kê khai'],
];
const catalogMatch = (key, value) =>
  catalogSpec[key].rows.find(
    (row) => row.code === value || row.name === value || row.aliases?.includes(value),
  );
const partyType = (code) =>
  /^131(?!9)/.test(code) ? 'customers' : /^331(?!9)/.test(code) ? 'suppliers' : '';
const blockedManual = (code) => /^15|^911|^4212|^(1319|3319)|^111|^112|^131|^331/.test(code);
const manualBlockReason = (code) =>
  /^11[12]/.test(code)
    ? 'TK ' +
      code +
      ' ghi qua phiếu thu / chi hoặc “Tạo chứng từ” ở Đối chiếu ngân hàng để giữ sổ quỹ và đối chiếu sao kê.'
    : /^(131|331)(?!9)/.test(code)
      ? 'TK ' +
        code +
        ' ghi qua hóa đơn, phiếu thu / chi hoặc phân bổ ứng trước để công nợ theo hóa đơn khớp sổ cái.'
      : 'TK ' + code + ' ghi qua chứng từ nguồn hoặc luồng kết chuyển.';
const availableManual = (code) => {
  const account = chartAccounts.find((item) => item.code === code);
  return (
    account?.active &&
    !blockedManual(code) &&
    !chartAccounts.some((item) => item.parent === code && item.active)
  );
};
const accountSelectError = (rows, skipControl = false) =>
  rows.reduce((error, [account, party]) => {
    const code = accountCode(account),
      key = partyType(code);
    if (error) return error;
    if (!accounts.some((item) => accountCode(item) === code)) return 'Chọn tài khoản có trong hệ thống.';
    if (!skipControl && blockedManual(code)) return manualBlockReason(code);
    if (!skipControl && !availableManual(code)) return 'Chọn tài khoản chi tiết còn sử dụng.';
    if (key && !catalogMatch(key, party))
      return 'Chọn ' + (key === 'customers' ? 'khách hàng' : 'nhà cung cấp') + ' cho TK ' + code + '.';
    return '';
  }, '');
function cashProjection(rows, date, opening = savedOpening) {
  date = dayKey(date);
  const ledger = journalLines();
  const codes = [
    ...new Set([
      ...rows.map((row) => accountCode(row[0])),
      ...Object.keys(opening?.balances || {}),
      ...ledger.map((line) => line.code),
    ]),
  ].filter((code) => /^11[12]/.test(code));
  const snapshots = [];
  for (const code of codes) {
    const delta = rows
      .filter((row) => accountCode(row[0]) === code)
      .reduce((n, [, , d, c]) => n + Number(d || 0) - Number(c || 0), 0);
    const entries = new Map();
    for (const line of ledger.filter((line) => line.code === code))
      entries.set(line.entry, (entries.get(line.entry) || 0) + line.debit - line.credit);
    const replay = [...entries].map(([entry, value]) => [dayKey(entry.day), value, 'recorded']);
    if (opening) replay.unshift([opening.day, opening.balances[code] || 0, 'opening']);
    replay.push([date, delta, 'pending']);
    replay.sort((a, b) => a[0].localeCompare(b[0]));
    let balance = journalOpening[code] || 0;
    for (const [day, value, state] of replay) {
      if (state === 'pending') snapshots.push([code, balance, balance + value]);
      balance = state === 'opening' ? value : balance + value;
      if (day >= date && balance < 0)
        return {
          error:
            'TK ' +
            code +
            ' sẽ âm ' +
            money(-balance) +
            ' vào ' +
            isoDate(day) +
            '. Kiểm tra số dư trước khi ghi sổ.',
          snapshots,
        };
    }
  }
  return { error: '', snapshots };
}
function postingLines(kind, x) {
  return kind === 'journal' ? x.lines || rowDefinitions.journal.values : sourceJournalData(kind, x);
}
function postingPreview(lines, date) {
  const cash = cashProjection(lines, date);
  const affected = new Set(lines.map((row) => accountCode(row[0])));
  return (
    postingTable([{ state: 'Xem trước', day: isoDate(dayKey(date)), lines }]) +
    meta(
      cash.snapshots
        .filter(([code]) => affected.has(code))
        .map(([code, before, after]) => [
          'TK ' + code + ' trước → sau',
          money(before) + ' → ' + money(after),
        ]),
    )
  );
}
const formBack = (kind, list) =>
  editingEntry
    ? '<p>' +
      a(targets[kind] + '?code=' + encodeURIComponent(editingEntry.code), 'Quay lại ' + editingEntry.code) +
      '</p>' +
      pad('Sửa nháp ' + esc(editingEntry.code), '')
    : back(list);
const optionsWith = (current, choices) => [...new Set([...(current ? [current] : []), ...choices])];
function journalForm() {
  const x = editingEntry;
  return (
    formBack('journal', 2) +
    editWrap(
      'journal',
      pad(
        'Thông tin bút toán',
        grid(
          field('Ngày hạch toán', 'day', x ? dayKey(x.day) : sampleDate, 'date'),
          select('Loại bút toán', 'type', optionsWith(x?.type, ['Điều chỉnh', 'Chi phí'])),
          field('Diễn giải', 'party', x?.party),
        ),
      ) +
        '<datalist id="journal-accounts">' +
        accounts
          .filter((account) => availableManual(accountCode(account)))
          .map((account) => '<option value="' + esc(account) + '"></option>')
          .join('') +
        '</datalist>' +
        editor('journal', 'Dòng hạch toán', x ? x.lines || rowDefinitions.journal.values : [[], []]) +
        formEnd(),
    )
  );
}
const payPartyField = (key, value) =>
  partyPicker(key, key === 'suppliers' ? 'Nhà cung cấp' : 'Khách hàng', 'party', value);
const paymentKind = (type) => (type === 'Chi tiền' ? 'buy' : 'sale');
const paymentType = (kind) => (kind === 'buy' ? 'Chi tiền' : 'Thu tiền');
function paymentSourceField(type, code) {
  return optionsField(
    'Hóa đơn để điền nhanh',
    'invoicePreset',
    openDebt(paymentKind(type)).map((invoice) => [
      invoice.code,
      invoice.code +
        ' · ' +
        invoice.party +
        ' · ' +
        money(remaining(invoice)) +
        (draftForInvoice(invoice.code) ? ' · Có phiếu nháp' : ''),
    ]),
    code,
  ).replace('<option value="">Chọn</option>', '<option value="">Chọn hóa đơn hoặc nhập trực tiếp</option>');
}
function payForm() {
  const x = editingEntry,
    params = routeParams();
  const side = params.get('side'),
    code = params.get('invoice');
  const context =
    !x && ['buy', 'sale'].includes(side) ? openDebt(side).find((invoice) => invoice.code === code) : null;
  const pending = context && draftForInvoice(context.code);
  if (pending)
    return (
      back(5) + pad('Đã có phiếu nháp', a('7?code=' + encodeURIComponent(pending.code), 'Mở ' + pending.code))
    );
  const type = x?.type || paymentType(side);
  const party = x?.party || context?.party || '';
  const key = type === 'Chi tiền' ? 'suppliers' : 'customers';
  const initial = x
    ? (x.lines || rowDefinitions.pay.values).map(([code, left, part]) => {
        const item = records[paymentKind(type)].find((invoice) => invoice.code === code);
        return [code, item ? remaining(item) : left, part];
      })
    : context
      ? [[context.code, remaining(context), remaining(context)]]
      : [[]];
  const links = context
    ? '<div class="actions payment-back">' +
      a(targets[side] + '?code=' + encodeURIComponent(context.code), 'Quay lại ' + context.code) +
      a(5, 'Danh sách thanh toán') +
      '</div>'
    : formBack('pay', 5);
  const preset = x
    ? ''
    : pad(
        'Điền từ hóa đơn',
        paymentSourceField(type, context?.code) +
          '<p class="muted payment-help">Chọn hóa đơn còn nợ để điền nhanh. Hóa đơn có phiếu nháp sẽ mở phiếu đã lập. Với khoản ứng trước, chọn đối tác và để trống bảng phân bổ.</p>',
      );
  const notice =
    code && !context && !x
      ? pad('', note('Hóa đơn nguồn không còn số dư để thanh toán hoặc không tìm thấy.'))
      : '';
  return (
    links +
    notice +
    editWrap(
      'pay',
      pad(
        'Thông tin thu / chi',
        grid(
          x
            ? '<label>Loại thanh toán<input name="type" value="' + esc(type) + '" readonly></label>'
            : select('Loại thanh toán', 'type', ['Thu tiền', 'Chi tiền'], type),
          payPartyField(key, party),
          field('Ngày thanh toán', 'day', x ? dayKey(x.day) : todayKey(), 'date'),
          select(
            'Tài khoản tiền',
            'cash',
            optionsWith(x?.cash, [
              ...new Set(
                [
                  configuredAccount('bank'),
                  configuredAccount('cash'),
                  ...['bank', 'cash'].flatMap((key) => defaultAccountChoices(key).map(([code]) => code)),
                ].map((code) => accounts.find((value) => accountCode(value) === code)),
              ),
            ]),
            x?.cash,
          ),
          field('Mã giao dịch ngân hàng', 'ref', x?.ref || ''),
          field('Số tiền (đ)', 'amount', x?.amount ?? (context ? remaining(context) : ''), 'number'),
        ),
      ) +
        preset +
        editor('pay', 'Phân bổ hóa đơn', initial, false, paymentOptions(type, party)) +
        pad(
          '',
          note(
            'Có thể sửa số tiền và phân bổ để thanh toán một phần. Thu hoặc chi ứng trước thì để trống bảng phân bổ. Với tài khoản 112, nhập mã giao dịch trước khi ghi sổ.',
          ),
        ) +
        formEnd(),
    )
  );
}
function invoiceAsOf(delivery, end) {
  return records.sale.find(
    (x) =>
      x.source === delivery.code &&
      x.state === 'Đã ghi sổ' &&
      dayKey(x.day) <= end &&
      dayKey(x.post || x.day) <= end,
  );
}
function uninvoicedDeliveries(end, accepted) {
  return salesDeliveries.filter(
    (x) =>
      x.state === 'Đã ghi sổ' &&
      dayKey(x.day) <= end &&
      (accepted ? x.requiresAcceptance && x.accepted && x.accepted <= end : !x.requiresAcceptance) &&
      !invoiceAsOf(x, end),
  );
}
function invoiceTiming(source) {
  if (!source || (source.requiresAcceptance && !source.accepted)) return null;
  return source.accepted
    ? { day: source.accepted, label: 'ngày nghiệm thu' }
    : { day: dayKey(source.day), label: 'ngày giao hàng' };
}
function salesDateAdvisory(source, day, post) {
  const timing = invoiceTiming(source);
  return timing && [day, post].some((value) => validDate(value) && dayKey(value) !== timing.day)
    ? 'Ngày hóa đơn hoặc hạch toán khác ' +
        timing.label +
        ' ' +
        isoDate(timing.day) +
        '. Rà soát thời điểm lập hóa đơn.'
    : '';
}
function invoice(kind) {
  const buy = kind === 'buy',
    listId = buy ? 29 : 27,
    x = editingEntry;
  if (!x && !routeParams().has('source') && activeRecord?.kind === kind)
    return back(listId) + invoiceDocument(kind, activeRecord.code);
  const contextCode = x?.source || routeParams().get('source') || activeRecord?.code;
  const sourceModel = (buy ? receipts : salesDeliveries).find((row) => row.code === contextCode);
  if (sourceModel?.state !== 'Đã ghi sổ')
    return (
      back(listId) +
      pad(
        'Chọn chứng từ nguồn',
        note(
          buy
            ? 'Mở một phiếu nhập kho đã ghi sổ để lập hóa đơn.'
            : 'Mở một phiếu giao hàng đã ghi sổ để lập hóa đơn.',
        ) + a(buy ? 'receipts' : 'deliveries', buy ? 'Mở phiếu nhập kho' : 'Mở phiếu giao hàng'),
      )
    );
  const initial = x
    ? x.lines || rowDefinitions[kind].values
    : buy
      ? receiptLines(sourceModel).map((line) => [line.item, line.uom || 'Tấm', line.qty, line.price, '10'])
      : deliveryLines(sourceModel).map((line) => [
          productFor(line).name,
          productFor(line).extra || 'Cái',
          line.qty,
          line.price,
          productFor(line).rate || '10',
        ]);
  const timing = buy ? null : invoiceTiming(sourceModel);
  const defaultDate =
    timing?.day || (dayKey(sourceModel.day) > sampleDate ? dayKey(sourceModel.day) : sampleDate);
  const dateNotice = timing
    ? '<p id="sales-date-warning" data-source="' +
      esc(sourceModel.code) +
      '" class="field-error" role="status"></p>' +
      note('Hóa đơn điền sẵn theo ' + timing.label + ' ' + isoDate(timing.day) + '.')
    : '';
  const linked = (buy ? billedReceipt : billedDelivery)(sourceModel.code, x);
  if (linked && !x)
    return (
      back(listId) +
      pad(
        'Chứng từ đã có hóa đơn',
        a(targets[kind] + '?code=' + encodeURIComponent(linked.code), linked.code),
      )
    );
  const partner = partyPicker(
    buy ? 'suppliers' : 'customers',
    buy ? 'Nhà cung cấp' : 'Khách hàng',
    'party',
    sourceModel.party,
    { locked: true },
  );
  const sourceField =
    '<label>' +
    (buy ? 'Phiếu nhập kho' : 'Phiếu giao hàng') +
    '<input name="source" value="' +
    esc(sourceModel.code) +
    '" readonly></label>';
  return (
    (x
      ? formBack(kind, listId)
      : '<p>' +
        a(
          buy ? procurementUrl('receipt', sourceModel.code) : saleUrl('delivery', sourceModel.code),
          'Quay lại ' + sourceModel.code,
        ) +
        '</p>') +
    editWrap(
      kind,
      pad(
        'Thông tin hóa đơn',
        note(
          'Ngày hóa đơn và ngày hạch toán: người dùng chọn theo chứng từ thực tế, hệ thống kiểm tra ngày hợp lệ và kỳ đã khóa. Thời hạn thanh toán chọn theo thỏa thuận với đối tác. Đối tác được tự động lấy từ phiếu nhập / phiếu giao để bảo đảm khớp chứng từ nguồn.',
        ) +
          grid(
            partner,
            sourceField,
            field('Ngày hóa đơn', 'day', x ? dayKey(x.day) : defaultDate, 'date'),
            field('Ngày hạch toán', 'post', x ? x.post || dayKey(x.day) : defaultDate, 'date'),
            field('Hạn thanh toán', 'due', x?.due || '2026-12-19', 'date'),
            field(
              buy ? 'Số hóa đơn NCC' : 'Tham chiếu đơn bán',
              'ref',
              x?.ref || (!buy ? sourceModel.source : ''),
            ),
            ...(!buy ? [field('Lý do nếu sửa thuế GTGT', 'vatReason', x?.vatReason || '')] : []),
            ...(buy
              ? [
                  field('Ký hiệu hóa đơn', 'symbol', x?.symbol ?? '1C26TTP'),
                  field('Hồ sơ hóa đơn XML', 'xml', '', 'file'),
                ]
              : []),
          ),
      ) +
        dateNotice +
        (!buy && customerTaxError(sourceModel.party)
          ? pad('', note(esc(customerTaxError(sourceModel.party))))
          : '') +
        editor(kind, 'Dòng hàng từ chứng từ nguồn', initial, true) +
        pad(
          '',
          note(
            buy
              ? 'Có thể chỉnh đơn giá thực tế và thuế suất. Số lượng lấy từ phiếu nhập.'
              : 'Mặt hàng, số lượng và đơn giá lấy từ phiếu giao. Chọn thuế suất trên hóa đơn.',
          ),
        ) +
        formEnd(),
    )
  );
}
function detail(kind, code) {
  const x = records[kind].find((item) => item.code === code) || records[kind][0];
  const recorded = x.state === 'Đã ghi sổ';
  const lines = x.lines || rowDefinitions[kind].values;
  const summary = meta([
    ['Số chứng từ', x.code],
    ['Ngày chứng từ', x.day],
    [kind === 'journal' ? 'Diễn giải' : 'Đối tác', esc(x.party)],
    ['Tổng tiền', money(x.amount)],
    ['Trạng thái ghi sổ', pill(x.state, recorded ? 'good' : '')],
  ]);
  const buttons =
    x.state === 'Nháp'
      ? b('edit-' + kind, 'Sửa nháp') + b('post-' + kind, 'Xác nhận ghi sổ', 'primary')
      : recorded && !x.special && !(kind === 'journal' && x.sourceManaged)
        ? b('cancel-' + kind, 'Hủy chứng từ', 'warn')
        : '';
  return (
    pad(x.code, summary + '<div class="actions" style="margin-top:14px">' + buttons + '</div>') +
    card(
      '<div class="pad"><h2>' +
        (kind === 'pay' ? 'Phân bổ thanh toán' : 'Dòng hạch toán') +
        '</h2></div>' +
        table(
          rowDefinitions[kind].cols,
          lines.map((row) =>
            row.map((value, index) =>
              kind === 'pay'
                ? index === 0
                  ? value
                    ? recordLink(x.type === 'Chi tiền' ? 'buy' : 'sale', value)
                    : '—'
                  : money(value || 0)
                : esc(value),
            ),
          ),
          kind === 'pay' ? [1, 2] : [],
        ),
    ) +
    (x.sourceRoute ? pad('Chứng từ nguồn', a(x.sourceRoute, x.source)) : '') +
    (x.flow && !x.sourceRoute
      ? pad(
          'Nguồn nghiệp vụ',
          meta([
            ['Hồ sơ', esc(x.source)],
            ['Màn nghiệp vụ', a(x.flow, registry[x.flow][0])],
          ]),
        )
      : '') +
    pad(
      'Lịch sử xử lý',
      note(x.log ? esc(x.log) : 'Chứng từ mẫu · Xem trạng thái và các thao tác trên chứng từ.'),
    )
  );
}
