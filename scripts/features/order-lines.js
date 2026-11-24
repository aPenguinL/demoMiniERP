// Phase 1: multi-item order editing. Fulfillment receipts/deliveries select a line explicitly.
const orderItems = (x) =>
  x?.lines?.length
    ? x.lines
    : [
        {
          item: x?.item || '',
          product: x?.product || defaultProduct,
          qty: Number(x?.qty) || 0,
          price: Number(x?.price) || 0,
        },
      ];
const orderQuantity = (x) => orderItems(x).reduce((v, l) => v + (Number(l.qty) || 0), 0);
const orderTotal = (x) =>
  orderItems(x).reduce((v, l) => v + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
const orderSummary = (x) => orderItems(x).length + ' mặt hàng';
const orderLineTable = (x, kind) =>
  table(
    kind === 'buy'
      ? ['Mặt hàng', 'ĐVT', 'Số lượng đặt', 'Đã nhận', 'Còn nhận', 'Đơn giá', 'Thành tiền']
      : ['Mặt hàng', 'ĐVT', 'Số lượng đặt', 'Đã giao', 'Còn giao', 'Đơn giá', 'Thành tiền'],
    orderItems(x).map((l) => {
      const item = kind === 'buy' ? catalogMatch('items', l.item) : itemBy(l.product),
        used = kind === 'buy' ? received(x.code, l.item) : delivered(x.code, l.product);
      return [
        esc(item?.name || l.item),
        esc(item?.extra || '—'),
        l.qty,
        used,
        Math.max(0, l.qty - used),
        money(l.price),
        money(l.qty * l.price),
      ];
    }),
    [2, 3, 4, 5, 6],
  );
const pendingOrderItems = (x, kind) =>
  orderItems(x).filter(
    (l) => l.qty - (kind === 'buy' ? received(x.code, l.item) : delivered(x.code, l.product)) > 0,
  );
function newOrderRow(kind, entry = {}) {
  const buy = kind === 'buy',
    options = catalogSpec.items.rows.filter((r) => r.group === (buy ? materialGroup : finishedGroup));
  const id = buy ? catalogMatch('items', entry.item)?.code || '' : entry.product || '';
  const chooser =
    '<select class="line-item" name="line-item" aria-label="Mặt hàng" required><option value="">Chọn mặt hàng</option>' +
    options
      .map(
        (r) =>
          '<option value="' +
          esc(r.code) +
          '"' +
          (r.code === id ? ' selected' : '') +
          '>' +
          esc(r.code + ' · ' + r.name) +
          '</option>',
      )
      .join('') +
    '</select>';
  return (
    '<tr>' +
    [
      '<td>' + chooser + '</td>',
      '<td class="line-unit">' + esc(options.find((r) => r.code === id)?.extra || '—') + '</td>',
      '<td><input aria-label="Số lượng" class="num line-qty" type="number" min="0.000001" step="any" value="' +
        esc(entry.qty ?? 1) +
        '" required><small class="err order-line-error" aria-live="polite"></small></td>',
      '<td><input aria-label="Đơn giá" class="num line-price" type="number" min="1" step="1" value="' +
        esc(entry.price ?? '') +
        '" required><small class="err order-line-error" aria-live="polite"></small></td>',
      '<td class="num line-total">—</td>',
      '<td><button type="button" data-order-remove="true" aria-label="Xóa dòng hàng">Xóa</button></td>',
    ].join('') +
    '</tr>'
  );
}
function editMultiOrder(kind, x) {
  const buy = kind === 'buy',
    label = buy ? 'đơn mua' : 'đơn bán',
    date = x ? dayKey(x.day) : sampleDate,
    party = x?.party || '',
    entries = orderItems(x);
  const head = grid(
    field('Ngày ' + (buy ? 'đặt' : 'đặt'), 'day', date, 'date'),
    catalogInput(buy ? 'suppliers' : 'customers', buy ? 'Nhà cung cấp' : 'Khách hàng', 'party', party),
  );
  const rows =
    '<div><div class="summary-row"><strong>Danh sách mặt hàng</strong></div><div class="order-lines"><table><thead><tr><th>Mặt hàng</th><th>ĐVT</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th></th></tr></thead><tbody id="order-line-body">' +
    entries.map((y) => newOrderRow(kind, y)).join('') +
    '</tbody></table></div><div class="order-add-row"><button type="button" data-order-add="' +
    kind +
    '">+ Thêm dòng hàng</button></div><div class="order-totals"><span id="order-item-count"></span><span id="order-grand-total"></span></div></div>';
  openModal(
    (x ? 'Sửa nháp ' : 'Tạo ') + label,
    head + rows,
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day);
      if (error) return error;
      const p = escToText(data.get('party'));
      if (!p || !catalogMatch(buy ? 'suppliers' : 'customers', p)) return 'Chọn đối tác hợp lệ từ danh mục.';
      const entries = [...document.querySelectorAll('#order-line-body tr')].map((tr) => {
        const code = tr.querySelector('[name="line-item"]').value,
          qty = Number(tr.querySelector('.line-qty').value),
          price = Number(tr.querySelector('.line-price').value),
          item = itemBy(code);
        return { code, item, qty, price };
      });
      if (!entries.length) return 'Thêm ít nhất một mặt hàng.';
      if (
        entries.some(
          (v) =>
            !v.item ||
            v.item.group !== (buy ? materialGroup : finishedGroup) ||
            !(v.qty > 0) ||
            !Number.isFinite(v.qty) ||
            !Number.isSafeInteger(v.price) ||
            v.price <= 0,
        )
      )
        return 'Chọn mặt hàng, số lượng và đơn giá hợp lệ ở tất cả các dòng.';
      if (new Set(entries.map((v) => v.code)).size !== entries.length)
        return 'Một mặt hàng đang xuất hiện ở nhiều dòng. Gộp số lượng trước khi lưu.';
      const lines = entries.map((v) => ({ item: v.item.name, product: v.code, qty: v.qty, price: v.price }));
      const list = buy ? purchaseOrders : salesOrders,
        first = lines[0];
      const model = {
        day: isoDate(day),
        party: p,
        lines,
        item: first.item,
        product: first.product,
        qty: first.qty,
        price: first.price,
        state: 'Nháp',
      };
      const code =
        x?.code ||
        (buy ? 'PO' : 'SO') + '-' + day.slice(0, 4) + '-' + String(100 + list.length).padStart(5, '0');
      if (x) Object.assign(x, model);
      else list.push({ ...model, code });
      const target = buy ? procurementUrl('order', code) : saleUrl('order', code);
      const feedback = 'Đã lưu nháp ' + code + ' với ' + lines.length + ' dòng hàng.';
      if (location.hash === '#' + target) say(feedback);
      else {
        orderSaveFeedback = { target, feedback };
        route(target);
      }
      return '';
    },
    'Lưu nháp',
  );
  document.getElementById('dialog').classList.add('order-dialog');
  refreshOrderRows();
}
function orderNumberError(input, showRequired = false) {
  const price = input.matches('.line-price');
  const value = input.valueAsNumber;
  if (input.validity.badInput) return price ? 'Nhập đơn giá bằng số.' : 'Nhập số lượng bằng số.';
  if (input.value === '') return showRequired ? (price ? 'Nhập đơn giá.' : 'Nhập số lượng.') : '';
  if (value < 0) return price ? 'Đơn giá không được âm.' : 'Số lượng không được âm.';
  if (input.validity.rangeUnderflow) return price ? 'Đơn giá phải từ 1 đ.' : 'Số lượng phải từ 0,000001.';
  if (price && !Number.isSafeInteger(value)) return 'Đơn giá phải là số nguyên hợp lệ.';
  return '';
}
function showOrderNumberError(input, showRequired = false) {
  const error = orderNumberError(input, showRequired);
  input.setCustomValidity(error);
  input.setAttribute('aria-invalid', String(Boolean(error)));
  input.nextElementSibling.textContent = error;
  return error;
}
$('dialogForm').addEventListener(
  'invalid',
  (event) => {
    const input = event.target;
    const error = input.name?.startsWith('receiveQty-')
      ? receiptQuantityError(input)
      : input.matches('.line-qty,.line-price')
        ? showOrderNumberError(input, true)
        : input.matches('.line-item')
          ? 'Chọn mặt hàng cho tất cả các dòng.'
          : input.validationMessage;
    if (!$('modalErr').textContent) $('modalErr').textContent = error;
  },
  true,
);
function refreshOrderRows() {
  const body = $('order-line-body');
  if (!body) return;
  if ($('modalErr')) $('modalErr').textContent = '';
  const rows = [...body.rows];
  const selected = new Set(rows.map((row) => row.querySelector('.line-item').value).filter(Boolean));
  let total = 0,
    hasError = false;
  for (const tr of rows) {
    const chooser = tr.querySelector('.line-item');
    for (const option of chooser.options) {
      const taken = option.value !== chooser.value && selected.has(option.value);
      option.hidden = taken;
      option.disabled = taken;
    }
    const item = itemBy(chooser.value);
    const qty = tr.querySelector('.line-qty'),
      price = tr.querySelector('.line-price');
    const qtyError = showOrderNumberError(qty),
      priceError = showOrderNumberError(price);
    const invalid = Boolean(qtyError || priceError);
    const complete = item && qty.value && price.value && !invalid;
    const value = complete ? qty.valueAsNumber * price.valueAsNumber : 0;
    tr.querySelector('.line-unit').textContent = item?.extra || '—';
    tr.querySelector('.line-total').textContent = complete ? money(value) : '—';
    hasError ||= invalid;
    total += value;
  }
  $('order-item-count').textContent = body.rows.length + ' mặt hàng';
  $('order-grand-total').textContent = hasError ? 'Tổng: —' : 'Tổng: ' + money(total);
}
document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-order-add]');
  if (add) {
    document
      .getElementById('order-line-body')
      ?.insertAdjacentHTML('beforeend', newOrderRow(add.dataset.orderAdd));
    refreshOrderRows();
    return;
  }
  if (e.target.closest('[data-order-remove]')) {
    e.target.closest('tr')?.remove();
    refreshOrderRows();
  }
});
document.addEventListener('input', (e) => {
  if (e.target.closest('#order-line-body')) refreshOrderRows();
});
document.addEventListener('change', (e) => {
  if (e.target.closest('#order-line-body')) refreshOrderRows();
});
document
  .getElementById('dialog')
  .addEventListener('close', () => document.getElementById('dialog').classList.remove('order-dialog'));
