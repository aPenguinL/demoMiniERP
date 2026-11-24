const purchaseOrders = [
  {
    code: purchase.order,
    day: '15/11/2026',
    party: purchase.supplier,
    item: purchase.name,
    qty: purchase.qty,
    price: purchase.unitPrice,
    state: 'Đã xác nhận',
    sample: true,
  },
];
const receipts = [
  {
    code: purchase.receipt,
    source: purchase.order,
    day: '16/11/2026',
    party: purchase.supplier,
    item: purchase.name,
    qty: purchase.qty,
    price: purchase.unitPrice,
    warehouse: purchase.warehouse,
    provisional: 8200000,
    state: 'Đã ghi sổ',
    sample: true,
  },
];
const billedReceipt = (code, except) =>
  records.buy.find((x) => x !== except && x.source === code && x.state !== 'Đã hủy');
const receiptLines = (x) => (x?.lines?.length ? x.lines : x ? [x] : []);
const receiptLineValue = (line) => line.provisional ?? Math.round(line.qty * line.price);
const received = (code, item) =>
  normQty(
    receipts
      .filter((x) => x.source === code && x.state === 'Đã ghi sổ')
      .flatMap(receiptLines)
      .filter((line) => !item || line.item === item)
      .reduce((sum, line) => sum + line.qty, 0),
  );
const procurementUrl = (kind, code, from = 'buy') =>
  kind === 'order'
    ? 'orders-buy?ref=' + encodeURIComponent(code)
    : 'receipts?ref=' + encodeURIComponent(code) + '&from=' + from;
const purchaseTotal = (x) => Math.round(x.lines?.length ? orderTotal(x) : x.qty * x.price);
const receiptValue = (x) => receiptLines(x).reduce((sum, line) => sum + receiptLineValue(line), 0);
function procurementRows(kind, items) {
  const rows = visibleDocuments(items);
  return card(
    (kind === 'order' ? '<div class="order-register">' : '') +
      documentFilters() +
      table(
        ['Số chứng từ', 'Ngày', 'Nhà cung cấp', 'Hàng hóa', 'Số lượng', 'Giá trị', 'Trạng thái'],
        rows.map((x) => [
          a(procurementUrl(kind, x.code), x.code),
          x.day,
          esc(x.party),
          kind === 'order' || receiptLines(x).length > 1
            ? a(procurementUrl(kind, x.code), orderSummary(x))
            : esc(x.item),
          kind === 'order' ? orderQuantity(x) : receiptLines(x).reduce((sum, line) => sum + line.qty, 0),
          money(kind === 'order' ? purchaseTotal(x) : receiptValue(x)),
          pill(x.state, isConfirmed(x.state) ? 'good' : ''),
        ]),
        [4, 5],
      ) +
      '<div class="subfoot">Hiển thị ' +
      rows.length +
      ' / ' +
      items.length +
      ' chứng từ</div>' +
      (kind === 'order' ? '</div>' : ''),
  );
}
function purchaseOrder() {
  const ref = new URLSearchParams(location.hash.split('?')[1] || '').get('ref');
  const x = purchaseOrders.find((row) => row.code === ref);
  if (!x) return procurementRows('order', purchaseOrders);
  const pending = pendingOrderItems(x, 'buy').reduce((v, l) => v + l.qty - received(x.code, l.item), 0);
  const controls =
    (x.state === 'Nháp'
      ? b('proc-edit-order|' + x.code, 'Sửa nháp') +
        b('proc-post-order|' + x.code, 'Xác nhận đơn mua', 'primary')
      : x.state === 'Đã xác nhận' && pending
        ? b('receipt-from-order-' + x.code, 'Lập phiếu nhập', 'primary')
        : '') +
    (!x.sample && ['Nháp', 'Đã xác nhận'].includes(x.state)
      ? b('proc-cancel-order|' + x.code, 'Hủy đơn mua', 'warn')
      : '');
  return pad(
    x.code,
    meta([
      ['Nhà cung cấp', esc(x.party)],
      ['Ngày đơn', x.day],
      ['Trạng thái', pill(x.state)],
      ['Còn nhận', pending],
    ]) +
      orderLineTable(x, 'buy') +
      pad(
        'Phiếu nhập liên quan',
        receipts
          .filter((r) => r.source === x.code)
          .map((r) => a(procurementUrl('receipt', r.code), r.code))
          .join(' · ') || 'Chưa có phiếu nhập',
      ) +
      '<div class="actions">' +
      controls +
      a('orders-buy', 'Về danh sách đơn mua') +
      '</div>',
  );
}
function receiptView() {
  const ref = new URLSearchParams(location.hash.split('?')[1] || '').get('ref');
  const x = receipts.find((row) => row.code === ref);
  if (!x) return warehouseOnly() ? warehouseDocuments('purchase') : procurementRows('receipt', receipts);
  const returnTo =
    routeParams().get('from') === 'buy' ? 'receipts?restore=1' : stockDocLink('purchase', x.code);
  if (warehouseOnly())
    return stockDocumentDetail(
      stockDocuments().find((doc) => doc.type === 'purchase' && doc.code === x.code),
    );
  const invoice = billedReceipt(x.code);
  const controls =
    x.special || x.sample
      ? ''
      : x.state === 'Nháp'
        ? b('proc-edit-receipt|' + x.code, 'Sửa nháp') +
          b('proc-post-receipt|' + x.code, 'Xác nhận nhập kho', 'primary')
        : x.state === 'Đã ghi sổ'
          ? (!invoice ? b('invoice-from-receipt-' + x.code, 'Lập hóa đơn mua', 'primary') : '') +
            b('proc-cancel-receipt|' + x.code, 'Hủy phiếu nhập', 'warn')
          : '';
  const journal = linkedJournal(x.code);
  const origin = x.source ? a(procurementUrl('order', x.source), x.source) : '—';
  const invoiceLink =
    x.special === 'noinvoice'
      ? 'Mua không hóa đơn'
      : invoice
        ? a(purchaseHref(invoice.code), invoice.code)
        : 'Chưa lập';
  const goods = table(
    ['Mã vật tư', 'Tên hàng', 'Kho', 'ĐVT', 'Số lượng', 'Đơn giá', 'Giá trị'],
    receiptLines(x).map((line) => [
      esc(catalogMatch('items', line.item)?.code || '—'),
      esc(line.item),
      esc(warehouseName(line.warehouse || x.warehouse)),
      esc(line.uom || catalogMatch('items', line.item)?.extra || '—'),
      line.qty,
      money(line.price),
      money(receiptLineValue(line)),
    ]),
    [4, 5, 6],
  );
  return (
    pad(
      x.code,
      '<div class="summary-row"><strong>' +
        esc(x.party) +
        '</strong>' +
        pill(x.state, x.state === 'Đã ghi sổ' ? 'good' : '') +
        '</div>' +
        meta([
          ['Ngày nhập', esc(x.day)],
          ['Giá trị nhập', money(receiptValue(x))],
          ['Đơn mua', origin],
          ['Hóa đơn', invoiceLink],
        ]) +
        '<div class="actions">' +
        controls +
        b('print-accounting', 'In / Lưu PDF') +
        a(returnTo, 'Quay lại') +
        '</div>',
    ) +
    card(tabs(['Hàng hóa', 'Hạch toán'], tab) + (tab === 1 ? postingTable(journal) : goods)) +
    receiptOrigin(x)
  );
}
function stockView() {
  return stockByWarehouse();
}
function editProcurement(kind, x, order) {
  if (kind !== 'receipt') return editMultiOrder('buy', x);
  const choices = purchaseOrders.filter(
    (row) => row.state === 'Đã xác nhận' && (row.code === x?.source || pendingOrderItems(row, 'buy').length),
  );
  if (!choices.length)
    return openModal(
      'Chưa có đơn mua còn nhận',
      note('Xác nhận đơn mua trước khi lập phiếu nhập.') + a('orders-buy', 'Mở đơn mua'),
      () => '',
      'Đóng',
    );
  const selected = x?.source || order?.code || '';
  const savedWarehouses = new Set(receiptLines(x).map((line) => line.warehouse || x?.warehouse));
  const warehouseOptionsForReceipt = warehouseOptions(materialGroup);
  const selectedWarehouse =
    savedWarehouses.size === 1 ? [...savedWarehouses][0] : x ? '' : typeDefault(materialGroup)?.code;
  const fields =
    '<div class="formGrid receipt-header-fields">' +
    optionsField(
      'Đơn mua',
      'receiptOrder',
      choices.map((row) => [row.code, row.code + ' · ' + row.party]),
      selected,
    ) +
    field(
      'Ngày nhập',
      'day',
      x ? dayKey(x.day) : order && dayKey(order.day) > sampleDate ? dayKey(order.day) : sampleDate,
      'date',
    ) +
    optionsField('Kho nhập', 'warehouse', warehouseOptionsForReceipt, selectedWarehouse) +
    '</div>';
  openModal(
    x ? 'Sửa nháp phiếu nhập kho' : 'Tạo phiếu nhập kho',
    fields + '<div id="receipt-order-lines"></div>',
    (data) => {
      const source = purchaseOrders.find((row) => row.code === data.get('receiptOrder'));
      const day = data.get('day');
      const error = postingDateError(day);
      if (error) return error;
      if (source?.state !== 'Đã xác nhận') return 'Chọn đơn mua đã xác nhận.';
      if (day < dayKey(source.day)) return 'Ngày nhập không được trước ngày đặt.';
      const warehouse = data.get('warehouse');
      if (!validWarehouse(warehouse, materialGroup)) return 'Chọn kho nguyên liệu đang sử dụng.';
      const ordered = orderItems(source);
      const selected = data.getAll('receiptLine');
      if (!selected.length) return 'Nhập số lượng vào cột Ghi nhận cho ít nhất một mặt hàng.';
      const lines = [];
      for (const index of selected) {
        const line = ordered[Number(index)],
          qty = Number(data.get('receiveQty-' + index));
        if (
          !line ||
          !Number.isFinite(qty) ||
          qty <= 0 ||
          normQty(qty) !== qty ||
          qty > normQty(line.qty - received(source.code, line.item))
        )
          return 'Số lượng ghi nhận phải lớn hơn 0 và không vượt số còn nhận.';
        lines.push({
          item: line.item,
          warehouse,
          qty,
          price: line.price,
          uom: catalogMatch('items', line.item)?.extra || 'Tấm',
        });
      }
      const code = x?.code || 'GRN-' + day.slice(0, 4) + '-' + String(100 + receipts.length).padStart(5, '0');
      const model = {
        ...lines[0],
        day: isoDate(day),
        party: source.party,
        source: source.code,
        state: 'Nháp',
        lines,
      };
      if (x) Object.assign(x, model);
      else receipts.push({ ...model, code });
      const target = procurementUrl('receipt', code);
      const feedback = 'Đã lưu nháp ' + code + ' với ' + lines.length + ' mặt hàng.';
      if (location.hash === '#' + target) say(feedback);
      else {
        orderSaveFeedback = { target, feedback };
        route(target);
      }
      return '';
    },
    'Lưu nháp',
  );
  $('dialog').classList.add('order-dialog');
  refreshReceiptLines(x);
}
function refreshReceiptLines(draft) {
  const target = $('receipt-order-lines');
  if (!target) return;
  const sale = target.dataset.flow === 'sale',
    form = $('dialogForm');
  const order = (sale ? salesOrders : purchaseOrders).find(
    (row) => row.code === form.elements.receiptOrder.value,
  );
  if (!order) {
    target.innerHTML = note(
      sale ? 'Chọn đơn bán để xem các mặt hàng cần giao.' : 'Chọn đơn mua để xem các mặt hàng còn nhận.',
    );
    return;
  }
  const saved = draft?.source === order.code ? (sale ? deliveryLines(draft) : receiptLines(draft)) : [];
  const rows = orderItems(order).flatMap((line, index) => {
    const qty = normQty(
      saved
        .filter((row) => (sale ? productFor(row).code === line.product : row.item === line.item))
        .reduce((sum, row) => sum + row.qty, 0),
    );
    const remaining = sale
      ? line.qty - delivered(order.code, line.product)
      : normQty(line.qty - received(order.code, line.item));
    const left = sale
      ? deliveryLimit(order, line, form.elements.warehouse.value, form.elements.day.value)
      : Math.max(0, remaining);
    if (remaining <= 0 && !qty) return [];
    const item = sale ? productFor(line) : catalogMatch('items', line.item);
    const name = esc(item?.name || line.item);
    return [
      [
        '<input type="checkbox" name="receiptLine" value="' +
          index +
          '" aria-label="Ghi nhận ' +
          name +
          '"' +
          (qty ? ' checked' : '') +
          '>',
        name,
        esc(item?.extra || '—'),
        line.qty,
        '<input type="number" name="receiveQty-' +
          index +
          '" aria-label="Số lượng ghi nhận ' +
          name +
          '" step="' +
          (sale ? '1' : '0.000001') +
          '" min="' +
          (sale ? '1' : '0.000001') +
          '" max="' +
          left +
          '" value="' +
          (qty || '') +
          '"' +
          (qty ? ' required' : '') +
          ' aria-describedby="receipt-qty-error-' +
          index +
          '"><small class="err receipt-qty-error" id="receipt-qty-error-' +
          index +
          '" aria-live="polite"></small>',
        money(line.price),
        '<span data-receipt-value="' + index + '"></span>',
      ],
    ];
  });
  target.innerHTML =
    '<div class="summary-row"><strong>Hàng ' +
    (sale ? 'giao' : 'nhập') +
    ' từ ' +
    esc(order.code) +
    '</strong><span>' +
    esc(order.party) +
    '</span></div>' +
    table(['Chọn', 'Mặt hàng', 'ĐVT', 'Đặt', 'Ghi nhận', 'Đơn giá', 'Thành tiền'], rows, [3, 5, 6]) +
    '<p class="receipt-total">Tổng giá trị ' +
    (sale ? 'giao' : 'nhập') +
    ' <strong id="receipt-total"></strong></p>';
  updateReceiptTotal();
}
function receiptQuantityError(input) {
  const { validity } = input;
  if (validity.rangeOverflow)
    return 'Vượt số cho phép. Tối đa ' + Number(input.max).toLocaleString('vi-VN') + '.';
  if (validity.badInput || validity.valueMissing || validity.rangeUnderflow)
    return 'Nhập số lượng lớn hơn 0.';
  if (validity.stepMismatch)
    return input.step === '1'
      ? 'Số lượng giao phải là số nguyên.'
      : 'Số lượng được nhập tối đa 6 chữ số thập phân.';
  return '';
}
function updateReceiptTotal() {
  const target = $('receipt-order-lines');
  if (!target || !$('receipt-total')) return;
  const form = $('dialogForm');
  const sale = target.dataset.flow === 'sale';
  const order = (sale ? salesOrders : purchaseOrders).find(
    (row) => row.code === form.elements.receiptOrder.value,
  );
  const lines = orderItems(order);
  let total = 0,
    hasError = false;
  for (const check of target.querySelectorAll('[name="receiptLine"]')) {
    const qty = form.elements['receiveQty-' + check.value];
    qty.required = check.checked;
    if (sale)
      qty.max = deliveryLimit(
        order,
        lines[Number(check.value)],
        form.elements.warehouse.value,
        form.elements.day.value,
      );
    const feedback = $('receipt-qty-error-' + check.value);
    const error = check.checked ? receiptQuantityError(qty) : '';
    if (feedback.textContent && $('modalErr')?.textContent === feedback.textContent)
      $('modalErr').textContent = '';
    feedback.textContent = error;
    hasError ||= Boolean(error);
    qty.setAttribute('aria-invalid', String(Boolean(error)));
    const value =
      check.checked && !error && qty.validity.valid
        ? Math.round(Number(qty.value) * lines[Number(check.value)].price)
        : null;
    target.querySelector('[data-receipt-value="' + check.value + '"]').textContent =
      value === null ? '—' : money(value);
    total += value || 0;
  }
  $('receipt-total').textContent = hasError ? '—' : money(total);
}
$('dialogForm').addEventListener('change', (event) => {
  if (!$('receipt-order-lines')) return;
  if (event.target.name === 'receiptOrder') {
    refreshReceiptLines();
    return;
  }
  if (event.target.name === 'receiptLine' && !event.target.checked)
    event.currentTarget.elements['receiveQty-' + event.target.value].value = '';
  updateReceiptTotal();
});
$('dialogForm').addEventListener('input', (event) => {
  const qty = event.target;
  if (!qty.name?.startsWith('receiveQty-')) return;
  const target = $('receipt-order-lines');
  if (!target) return;
  const check = target.querySelector(
    '[name="receiptLine"][value="' + qty.name.slice('receiveQty-'.length) + '"]',
  );
  if (check) check.checked = Boolean(qty.value || qty.validity.badInput);
  updateReceiptTotal();
});
const receiptPostLines = (x) => [
  ...receiptLines(x).map((line) => debitLine(stockAccount(materialGroup), receiptLineValue(line), line.item)),
  creditLine('3319', receiptValue(x), x.code),
];
function changeProcurement(op, kind, code) {
  const receipt = kind === 'receipt',
    x = (receipt ? receipts : purchaseOrders).find((row) => row.code === code);
  if (!x || x.sample || x.special) return;
  const post = op === 'post';
  if (post ? x.state !== 'Nháp' : x.state === 'Đã hủy') return;
  return openModal(
    post ? (receipt ? 'Xác nhận nhập kho' : 'Xác nhận đơn mua') : 'Hủy chứng từ',
    note(esc(x.code) + ' · ' + money(purchaseTotal(x))) +
      (post && receipt
        ? (woodWarning(x)
            ? note('Thiếu hồ sơ nguồn gốc gỗ. Rà soát số bảng kê và tệp trước khi xác nhận.')
            : '') + postingPreview(receiptPostLines(x), x.day)
        : post
          ? ''
          : textArea('Lý do hủy', 'reason')),
    (data) => {
      const dateError = postingDateError(x.day);
      if (dateError) return dateError;
      if (!post && receipt && currentClosing()) return 'Hủy bút toán kết chuyển trước khi hủy phiếu kho.';
      if (post && receipt) {
        const order = purchaseOrders.find((row) => row.code === x.source);
        if (order?.state !== 'Đã xác nhận' || dayKey(x.day) < dayKey(order.day))
          return 'Kiểm tra đơn mua và ngày nhập.';
        const quantitiesByItem = new Map();
        for (const receivedLine of receiptLines(x)) {
          if (!validWarehouse(receivedLine.warehouse || x.warehouse, materialGroup))
            return 'Chọn lại kho nguyên liệu cho ' + receivedLine.item + '.';
          const line = orderItems(order).find((item) => item.item === receivedLine.item);
          const allocated = normQty((quantitiesByItem.get(receivedLine.item) || 0) + receivedLine.qty);
          if (!line || allocated > normQty(line.qty - received(order.code, receivedLine.item)))
            return 'Kiểm tra số lượng còn nhận của ' + receivedLine.item + '.';
          quantitiesByItem.set(receivedLine.item, allocated);
          if (stockOutAfter(catalogMatch('items', receivedLine.item)?.code, x.day))
            return 'Mã ' + receivedLine.item + ' đã phát sinh xuất sau ngày nhập này.';
        }
        writeJournal(
          'JV-NK-' + x.code.split('-').pop(),
          x.day,
          'Nhập kho từ ' + x.code,
          receiptPostLines(x),
          { source: x.code, sourceRoute: procurementUrl('receipt', x.code), sourceManaged: true },
        );
      }
      if (!post) {
        const reason = String(data.get('reason') || '').trim();
        if (!reason) return 'Nhập lý do hủy.';
        if (
          receipt
            ? billedReceipt(x.code)
            : receipts.some((row) => row.source === x.code && row.state !== 'Đã hủy')
        )
          return 'Còn chứng từ liên quan. Xử lý chứng từ phía sau trong luồng trước.';
        if (receipt) {
          const day = dayKey(x.day);
          for (const line of receiptLines(x)) {
            const item = catalogMatch('items', line.item)?.code;
            const sameDay = [...productionIssues, ...stockTransfers, ...stockChecks].some(
              (row) => !row.cancelled && row.item === item && row.day === day,
            );
            if (firstStockOutAfter(item, day) || sameDay)
              return (
                'Đã có chứng từ xuất, chuyển kho hoặc kiểm kê cho ' +
                line.item +
                '. Xử lý chứng từ liên quan trước.'
              );
          }
        }
        for (const journal of linkedJournal(x.code))
          if (journal.state === 'Đã ghi sổ') {
            journal.state = 'Đã hủy';
            journal.log = 'Đã đảo khi hủy ' + x.code + ' · ' + reason;
          }
      }
      x.state = post ? (receipt ? 'Đã ghi sổ' : 'Đã xác nhận') : 'Đã hủy';
      touchClosing(x.day);
      say(x.state + ' · ' + x.code);
      return '';
    },
    post ? 'Xác nhận' : 'Hủy chứng từ',
  );
}

function receiptOrigin(x) {
  const doc = x.origin;
  const complete = Boolean(doc?.file && doc?.number);
  const status = complete
    ? pill('Đã đủ hồ sơ', 'good')
    : woodWarning(x)
      ? pill('Thiếu hồ sơ', 'attn')
      : pill('Chưa có hồ sơ');
  const controls =
    (doc?.file ? b('wood-download|' + x.code, 'Tải hồ sơ', 'link') : '') +
    (!periodLocked(x.day) ? b('wood-edit|' + x.code, 'Cập nhật hồ sơ', 'link') : '');
  return pad(
    '',
    '<details class="receipt-origin"><summary><strong>Hồ sơ nguồn gốc gỗ</strong>' +
      status +
      '</summary>' +
      meta([
        ['Số bảng kê lâm sản', esc(doc?.number || '—')],
        ['Tệp đính kèm', esc(doc?.file?.name || '—')],
      ]) +
      (controls ? '<div class="actions">' + controls + '</div>' : '') +
      '</details>',
  );
}
const woodReceipt = (x) => receiptLines(x).some((line) => catalogMatch('items', line.item)?.wood);
const woodWarning = (x) => woodReceipt(x) && (!x.origin?.file || !x.origin?.number);
function editWood(x) {
  if (!x || periodLocked(x.day)) return;
  return openModal(
    'Hồ sơ nguồn gốc gỗ · ' + x.code,
    grid(
      field('Số bảng kê lâm sản', 'number', x.origin?.number || ''),
      field('Tệp hồ sơ', 'file', '', 'file'),
    ),
    (data) => {
      if (periodLocked(x.day)) return 'Kỳ phiếu nhập đã khóa.';
      const number = String(data.get('number') || '').trim(),
        file = data.get('file');
      if (!number || !(file?.name || x.origin?.file)) return 'Nhập số bảng kê và chọn tệp.';
      x.origin = { number, file: file?.name ? file : x.origin.file };
      say('Đã lưu hồ sơ trong phiên HTML.');
      return '';
    },
    'Lưu hồ sơ',
  );
}
function downloadWood(x) {
  if (!x?.origin?.file) return;
  const url = URL.createObjectURL(x.origin.file);
  const link = document.createElement('a');
  link.href = url;
  link.download = x.origin.file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
