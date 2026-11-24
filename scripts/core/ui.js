const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const money = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + ' đ';
const a = (id, label) => '<a href="#' + id + '">' + esc(label) + '</a>';
const b = (id, label, cls = '') =>
  !allowedAction(id)
    ? ''
    : '<button type="button" class="' + cls + '" data-do="' + id + '">' + esc(label) + '</button>';
const jump = (id, label) => b('go-' + id, label, 'primary');
const pill = (value, cls = '') => '<span class="pill ' + cls + '">' + esc(value) + '</span>';
const card = (body, cls = '') => '<section class="card ' + cls + '">' + body + '</section>';
const pad = (title, body) => card((title ? '<h2>' + title + '</h2>' : '') + body, 'pad');
const note = (body) => '<p class="note">' + body + '</p>';
const meta = (rows) =>
  '<div class="meta">' +
  rows.map(([x, y]) => '<div><span>' + x + '</span><b>' + y + '</b></div>').join('') +
  '</div>';
const table = (cols, rows, num = []) =>
  '<div class="tableScroll"><table><thead><tr>' +
  cols.map((c, i) => '<th class="' + (num.includes(i) ? 'num' : '') + '">' + c + '</th>').join('') +
  '</tr></thead><tbody>' +
  (rows.length
    ? rows
        .map(
          (r) =>
            '<tr>' +
            r.map((x, i) => '<td class="' + (num.includes(i) ? 'num' : '') + '">' + x + '</td>').join('') +
            '</tr>',
        )
        .join('')
    : '<tr><td class="empty" colspan="' + cols.length + '">Không có dữ liệu phù hợp.</td></tr>') +
  '</tbody></table></div>';
const moneyInput = (value, attrs = '') =>
  '<input type="text" inputmode="numeric" data-money ' + attrs + ' value="' + esc(moneyDisplay(value)) + '">';
const moneyRaw = (value) => String(value ?? '').replaceAll('.', '');
const moneyDisplay = (value) => String(value ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const noFutureLabels = new Set([
  'Ngày hạch toán',
  'Ngày hóa đơn',
  'Ngày thanh toán',
  'Ngày nhập',
  'Ngày giao',
  'Ngày đặt',
  'Ngày đầu kỳ',
  'Ngày hồ sơ',
  'Ngày nộp',
]);
const periodDateLabels = new Set([
  'Ngày hạch toán',
  'Ngày thanh toán',
  'Ngày nhập',
  'Ngày giao',
  'Ngày đặt',
  'Ngày đầu kỳ',
]);
const field = (label, name, value = '', type = 'text') =>
  type === 'date'
    ? '<label class="date-field">' +
      label +
      '<input type="date" lang="vi" name="' +
      name +
      '" data-date' +
      (noFutureLabels.has(label) ? ' data-no-future' : '') +
      (periodDateLabels.has(label) ? ' data-open-period' : '') +
      ' value="' +
      esc(validDate(value) ? dayKey(value) : '') +
      '"><small class="field-error" aria-live="polite"></small></label>'
    : type === 'number' &&
        ['amount', 'price', 'monthly', 'value', 'profit', 'plus', 'minus', 'paid'].includes(name)
      ? '<label>' + label + moneyInput(value, 'name="' + name + '"') + '</label>'
      : '<label>' +
        label +
        '<input name="' +
        name +
        '" type="' +
        type +
        '" value="' +
        esc(value) +
        '"' +
        (type === 'number' ? ' min="0" step="any"' : '') +
        '></label>';
const select = (label, name, values, selected) =>
  '<label>' +
  label +
  '<select name="' +
  name +
  '">' +
  values.map((v) => '<option' + (v === selected ? ' selected' : '') + '>' + esc(v) + '</option>').join('') +
  '</select></label>';
const grid = (...fields) => '<div class="formGrid">' + fields.join('') + '</div>';
const cards = (items) =>
  '<div class="cards">' +
  items
    .map(([label, v, id]) =>
      card(
        '<span class="muted">' + label + '</span><b>' + v + '</b>' + (id ? a(id, 'Xem chi tiết') : ''),
        'pad metric',
      ),
    )
    .join('') +
  '</div>';
const tabs = (labels, selected) =>
  '<div class="tabs">' +
  labels.map((x, i) => b('tab-' + i, x, i === selected ? 'active' : '')).join('') +
  '</div>';
const textArea = (label, name, value = '') =>
  '<label>' + label + '<textarea name="' + name + '" rows="3">' + esc(value) + '</textarea></label>';
