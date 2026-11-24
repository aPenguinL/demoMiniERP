const productFor = (x) => itemBy(x?.product || defaultProduct);
const salesOrders = [
  {
    code: 'SO-2026-00002',
    party: 'Nội thất An Phú',
    day: '17/11/2026',
    qty: 12,
    price: 1000000,
    state: 'Đã xác nhận',
    sample: true,
  },
];
const salesDeliveries = [
  {
    code: 'DN-2026-00003',
    party: 'Nội thất An Phú',
    source: 'SO-2026-00002',
    day: '18/11/2026',
    qty: 12,
    price: 1000000,
    state: 'Đã ghi sổ',
    sample: true,
  },
];
const saleUrl = (kind, code) =>
  (kind === 'order' ? 'orders-sale' : 'deliveries') + '?ref=' + encodeURIComponent(code);
const deliveryLines = (x) => (x?.lines?.length ? x.lines : x ? [x] : []);
const delivered = (code, product) =>
  salesDeliveries
    .filter((d) => d.source === code && d.state === 'Đã ghi sổ')
    .flatMap(deliveryLines)
    .filter((line) => !product || productFor(line).code === product)
    .reduce((sum, line) => sum + line.qty, 0);
const billedDelivery = (code, except) =>
  records.sale.find((x) => x !== except && x.source === code && x.state !== 'Đã hủy');
function saleDocuments(kind) {
  const delivery = kind === 'delivery',
    list = delivery ? salesDeliveries : salesOrders;
  const pageId = delivery ? 'deliveries' : 'orders-sale';
  const ref = new URLSearchParams(location.hash.split('?')[1] || '').get('ref');
  const x = list.find((r) => r.code === ref);
  if (!x)
    return card(
      (delivery ? '' : '<div class="order-register">') +
        documentFilters() +
        table(
          ['Số chứng từ', 'Ngày', 'Khách hàng', 'Mặt hàng', 'Số lượng', 'Giá trị', 'Trạng thái'],
          visibleDocuments(list).map((r) => [
            a(saleUrl(kind, r.code), r.code),
            r.day,
            esc(r.party),
            kind === 'order' || deliveryLines(r).length > 1
              ? a(saleUrl(kind, r.code), orderSummary(r))
              : esc(productFor(r).name),
            orderQuantity(r),
            money(purchaseTotal(r)),
            pill(r.state, isConfirmed(r.state) ? 'good' : ''),
          ]),
          [4, 5],
        ) +
        (delivery ? '' : '</div>'),
    );
  const invoice = delivery ? billedDelivery(x.code) : null;
  const buttons =
    x.state === 'Nháp'
      ? b('sales-edit-' + kind + '|' + x.code, 'Sửa nháp') +
        b(
          'sales-post-' + kind + '|' + x.code,
          delivery ? 'Xác nhận giao hàng' : 'Xác nhận đơn bán',
          'primary',
        )
      : isConfirmed(x.state)
        ? (delivery
            ? x.requiresAcceptance && !x.accepted
              ? b('sales-accept|' + x.code, 'Nghiệm thu', 'primary')
              : !invoice
                ? b('sales-invoice-' + x.code, 'Lập hóa đơn bán', 'primary')
                : ''
            : (pendingOrderItems(x, 'sale').length
                ? b('sales-delivery-' + x.code, 'Lập phiếu giao', 'primary')
                : '') +
              ' ' +
              a('8?tab=deposits', 'Xem cọc')) +
          (!x.sample ? b('sales-cancel-' + kind + '|' + x.code, 'Hủy chứng từ', 'warn') : '')
        : '';
  const links = delivery
    ? a(saleUrl('order', x.source), x.source) +
      (invoice ? ' · ' + a('28?code=' + encodeURIComponent(invoice.code), invoice.code) : '')
    : [
        ...salesDeliveries
          .filter((d) => d.source === x.code)
          .map((d) => a(saleUrl('delivery', d.code), d.code)),
        ...deposits.filter((d) => d.order === x.code).map((d) => recordLink('pay', d.code)),
      ].join(' · ');
  return (
    pad(
      x.code,
      meta([
        ['Khách hàng', esc(x.party)],
        ['Ngày', x.day],
        ['Trạng thái', pill(x.state)],
        ['Mặt hàng', delivery && deliveryLines(x).length === 1 ? esc(productFor(x).name) : orderSummary(x)],
        ['Tổng số lượng', orderQuantity(x)],
        ['Giá trị', money(purchaseTotal(x))],
        ...(delivery
          ? [
              ['Kho xuất', esc(warehouseName(x.warehouse || seedWarehouses[finishedGroup]))],
              [
                'Ghi nhận doanh thu',
                x.requiresAcceptance && !x.accepted
                  ? x.acceptanceDue && x.acceptanceDue < todayKey()
                    ? 'Quá hạn nghiệm thu'
                    : 'Chờ nghiệm thu'
                  : x.recognize
                    ? 'Đã ghi doanh thu'
                    : 'Theo hóa đơn',
              ],
              ...(x.accepted
                ? [
                    ['Ngày nghiệm thu', isoDate(x.accepted)],
                    ['Biên bản', esc(x.acceptanceRef)],
                  ]
                : []),
            ]
          : []),
        ...(!delivery
          ? [
              [
                'Còn giao',
                pendingOrderItems(x, 'sale').reduce((n, l) => n + l.qty - delivered(x.code, l.product), 0),
              ],
              [
                'Cọc đang giữ',
                money(deposits.filter((d) => d.order === x.code).reduce((n, d) => n + depositBalance(d), 0)),
              ],
            ]
          : []),
      ]) +
        '<div class="actions">' +
        buttons +
        a(pageId, delivery ? 'Quay lại phiếu giao' : 'Quay lại đơn bán') +
        '</div>',
    ) +
    (delivery
      ? card(
          tabs(['Hàng hóa', 'Hạch toán'], tab) +
            (tab === 1
              ? postingTable(linkedJournal(x.code))
              : table(
                  ['Mặt hàng', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền'],
                  deliveryLines(x).map((line) => [
                    esc(productFor(line).name),
                    esc(productFor(line).extra || 'Cái'),
                    line.qty,
                    money(line.price),
                    money(line.qty * line.price),
                  ]),
                  [2, 3, 4],
                )),
        )
      : pad('Các mặt hàng trong đơn', orderLineTable(x, 'sale'))) +
    pad('Chứng từ liên quan', links || 'Chưa có chứng từ liên quan')
  );
}
function editSaleDocument(kind, x, order) {
  if (kind !== 'delivery') return editMultiOrder('sale', x);
  const choices = salesOrders.filter(
    (row) => row.state === 'Đã xác nhận' && (row.code === x?.source || pendingOrderItems(row, 'sale').length),
  );
  if (!choices.length)
    return openModal(
      'Chưa có đơn bán còn giao',
      note('Xác nhận đơn bán trước khi lập phiếu giao.') + a('orders-sale', 'Mở đơn bán'),
      () => '',
      'Đóng',
    );
  const fields =
    '<div class="formGrid receipt-header-fields">' +
    optionsField(
      'Đơn bán',
      'receiptOrder',
      choices.map((row) => [row.code, row.code + ' · ' + row.party]),
      x?.source || order?.code,
    ) +
    field(
      'Ngày giao',
      'day',
      x ? dayKey(x.day) : order && dayKey(order.day) > sampleDate ? dayKey(order.day) : sampleDate,
      'date',
    ) +
    warehouseField('Kho xuất', 'warehouse', finishedGroup, null, x?.warehouse) +
    '</div>';
  const advanced =
    '<details><summary>Tùy chọn nghiệm thu và doanh thu</summary>' +
    grid(
      select('Cần nghiệm thu', 'acceptance', ['Không', 'Có'], x?.requiresAcceptance ? 'Có' : 'Không'),
      field('Hạn nghiệm thu', 'acceptanceDue', x?.acceptanceDue || '', 'date'),
      select('Ghi nhận doanh thu khi giao', 'recognition', ['Chưa', 'Có'], x?.recognize ? 'Có' : 'Chưa'),
    ) +
    '</details>';
  openModal(
    x ? 'Sửa nháp phiếu giao' : 'Tạo phiếu giao',
    fields + '<div id="receipt-order-lines" data-flow="sale"></div>' + advanced,
    (data) => {
      const source = salesOrders.find((row) => row.code === data.get('receiptOrder'));
      const day = data.get('day'),
        warehouse = data.get('warehouse'),
        dateError = postingDateError(day);
      if (dateError) return dateError;
      if (source?.state !== 'Đã xác nhận' || day < dayKey(source.day))
        return 'Chọn đơn bán đã xác nhận và ngày giao từ ngày đặt trở đi.';
      if (!validWarehouse(warehouse, finishedGroup)) return 'Chọn kho thành phẩm đang sử dụng.';
      const selected = data.getAll('receiptLine');
      if (!selected.length) return 'Nhập số lượng giao cho ít nhất một mặt hàng.';
      const ordered = orderItems(source),
        lines = [];
      for (const index of selected) {
        const line = ordered[Number(index)],
          qty = Number(data.get('receiveQty-' + index));
        if (
          !line ||
          !Number.isSafeInteger(qty) ||
          qty <= 0 ||
          qty > deliveryLimit(source, line, warehouse, day)
        )
          return 'Số lượng giao phải là số nguyên dương, không vượt số còn giao hoặc tồn khả dụng tại kho.';
        lines.push({ product: line.product, qty, price: line.price });
      }
      const requiresAcceptance = data.get('acceptance') === 'Có';
      const acceptanceDue = requiresAcceptance ? data.get('acceptanceDue') : '';
      if (acceptanceDue && (!validDate(acceptanceDue) || acceptanceDue < day))
        return 'Hạn nghiệm thu không được trước ngày giao.';
      const code =
        x?.code || 'DN-' + day.slice(0, 4) + '-' + String(100 + salesDeliveries.length).padStart(5, '0');
      const model = {
        ...lines[0],
        lines,
        source: source.code,
        day: isoDate(day),
        party: source.party,
        warehouse,
        state: 'Nháp',
        requiresAcceptance,
        acceptanceDue,
        recognize: !requiresAcceptance && data.get('recognition') === 'Có',
      };
      if (x) Object.assign(x, model);
      else salesDeliveries.push({ ...model, code });
      const target = saleUrl('delivery', code),
        feedback = 'Đã lưu nháp ' + code + ' với ' + lines.length + ' mặt hàng.';
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
function deliveryLimit(order, line, warehouse, day) {
  const pending = line.qty - delivered(order.code, line.product);
  const available = validDate(day) && warehouse ? quantityAt(line.product, warehouse, day) : 0;
  return Math.max(0, Math.min(pending, available));
}
function deliveryCostLines(x) {
  return deliveryLines(x).map((line) => {
    const balance = inventory(productFor(line).code, dayKey(x.day));
    return { ...line, cost: line.cost ?? (balance.qty >= line.qty ? stockValueOut(balance, line.qty) : 0) };
  });
}
function deliveryPostLines(x, items = deliveryCostLines(x)) {
  const cost = items.reduce((sum, line) => sum + line.cost, 0);
  const lines = [
    debitLine(x.requiresAcceptance ? '157' : '632', cost, x.code),
    ...items.map((line) => creditLine(stockAccount(finishedGroup), line.cost, productFor(line).code)),
  ];
  if (x.recognize) {
    const base = purchaseTotal(x);
    lines.push(debitLine('1319', base, x.party), creditLine(configuredAccount('income'), base, x.code));
  }
  return lines;
}
function saleDocumentTransition(op, kind, code) {
  const delivery = kind === 'delivery',
    x = (delivery ? salesDeliveries : salesOrders).find((row) => row.code === code);
  if (!x || x.sample || (op === 'post' ? x.state !== 'Nháp' : x.state === 'Đã hủy')) return;
  return openModal(
    op === 'post' ? 'Xác nhận chứng từ' : 'Hủy chứng từ',
    note(esc(x.code)) +
      (op === 'post'
        ? delivery
          ? postingPreview(deliveryPostLines(x), x.day)
          : ''
        : textArea('Lý do hủy', 'reason')),
    (data) => {
      const dateError = postingDateError(x.day);
      if (dateError) return dateError;
      if (op === 'post' && delivery) {
        const order = salesOrders.find((o) => o.code === x.source);
        const day = dayKey(x.day),
          warehouse = validWarehouse(x.warehouse || seedWarehouses[finishedGroup], finishedGroup);
        if (!warehouse || order?.state !== 'Đã xác nhận' || day < dayKey(order.day))
          return 'Kiểm tra đơn bán, kho xuất và ngày giao.';
        const linesOrdered = orderItems(order);
        for (const line of deliveryLines(x)) {
          const product = productFor(line),
            ordered = linesOrdered.find((item) => item.product === product.code);
          if (!ordered || line.qty > deliveryLimit(order, ordered, warehouse.code, day))
            return 'Số lượng giao vượt số còn giao hoặc tồn kho của ' + product.name + '.';
          if (stockOutAfter(product.code, day)) return product.name + ' đã có phiếu xuất sau ngày này.';
        }
        const items = deliveryCostLines(x);
        if (items.some((line) => line.cost <= 0)) return 'Có thành phẩm chưa có giá nhập kho.';
        x.warehouse = warehouse.code;
        if (x.lines?.length) x.lines = items;
        else x.cost = items[0].cost;
        const lines = deliveryPostLines(x, items);
        writeJournal(
          'JV-GH-' + x.code.split('-').pop(),
          x.day,
          x.recognize ? 'Giá vốn và doanh thu theo ngày giao ' + x.code : 'Ghi nhận giá vốn ' + x.code,
          lines,
          { source: x.code, sourceRoute: saleUrl('delivery', x.code), sourceManaged: true },
        );
      }
      if (op === 'cancel') {
        const reason = String(data.get('reason') || '').trim();
        if (!reason) return 'Nhập lý do hủy.';
        if (!delivery && deposits.some((d) => d.order === x.code && depositBalance(d) > 0))
          return 'Xử lý trả hoặc giữ cọc tại màn Đặt cọc trước khi hủy đơn.';
        if (delivery && x.accepted && periodLocked(x.accepted)) return 'Kỳ nghiệm thu đã khóa.';
        if (
          delivery &&
          costAdjustments.some((a) =>
            deliveryLines(x).some((line) => a.delivery.get(deliveryLineKey(x, productFor(line).code))),
          )
        )
          return 'Phiếu giao đã được điều chỉnh giá thành. Dùng hóa đơn trả hàng khi cần đảo giao dịch.';
        if (
          delivery &&
          x.state === 'Đã ghi sổ' &&
          deliveryLines(x).some((line) => stockOutAfter(productFor(line).code, x.day))
        )
          return 'Đã có xuất thành phẩm sau phiếu giao. Hủy theo thứ tự ngược.';
        if (
          delivery
            ? billedDelivery(x.code)
            : salesDeliveries.some((d) => d.source === x.code && d.state !== 'Đã hủy')
        )
          return 'Còn chứng từ liên quan; xử lý chứng từ phía sau trước.';
        for (const j of linkedJournal(x.code))
          if (j.state === 'Đã ghi sổ') {
            j.state = 'Đã hủy';
            j.log = 'Đã đảo khi hủy ' + x.code + ' · ' + reason;
          }
      }
      x.state = op === 'post' ? (delivery ? 'Đã ghi sổ' : 'Đã xác nhận') : 'Đã hủy';
      touchClosing(x.day);
      say(x.state + ' · ' + x.code);
      return '';
    },
    op === 'post' ? 'Xác nhận' : 'Hủy chứng từ',
  );
}
function linkedJournal(source) {
  return records.journal.filter((entry) => entry.source === source);
}
function postingTable(entries) {
  return table(
    ['Bút toán', 'Ngày ghi sổ', 'Trạng thái', 'Tài khoản', 'Đối tượng', 'Nợ', 'Có'],
    entries.flatMap((entry) =>
      entry.lines.map(([account, party, debit, credit]) => [
        entry.state === 'Xem trước' ? 'Chưa ghi sổ' : journalAnchor(entry.code),
        esc(entry.day),
        pill(entry.state, entry.state === 'Đã ghi sổ' ? 'good' : ''),
        entry.state === 'Xem trước'
          ? esc(account)
          : b('docledger-' + accountCode(account) + '|' + entry.code, account, 'link'),
        esc(party || '—'),
        debit ? money(debit) : '—',
        credit ? money(credit) : '—',
      ]),
    ),
    [5, 6],
  );
}
function invoiceDocument(kind, code) {
  const x = records[kind].find((item) => item.code === code);
  if (!x) return pad('', note('Không tìm thấy hóa đơn đã chọn.'));
  const buy = kind === 'buy',
    recorded = x.state === 'Đã ghi sổ';
  const source = (buy ? receipts : salesDeliveries).find((row) => row.code === x.source);
  const sourceLink = source
    ? a(buy ? procurementUrl('receipt', source.code) : saleUrl('delivery', source.code), source.code)
    : x.special === 'service'
      ? a(workUrl(x.source), x.source)
      : x.sourceRoute
        ? a(x.sourceRoute, x.source)
        : esc(x.source || '—');
  const amounts = invoiceTax(x, kind);
  const metrics = [
    [buy ? 'Tổng phải trả' : 'Tổng phải thu', money(x.amount)],
    [buy ? 'Đã trả' : 'Đã thu', money(x.paid || 0)],
    [buy ? 'Còn phải trả' : 'Còn phải thu', money(remaining(x))],
  ];
  const fields = [
    ['Ngày hóa đơn', esc(x.day)],
    ['Ngày hạch toán', x.post ? isoDate(x.post) : esc(x.day)],
    ['Hạn thanh toán', isoDate(dueDate(x))],
    [buy ? (x.special === 'service' ? 'Lệnh gia công' : 'Phiếu nhập kho') : 'Phiếu giao hàng', sourceLink],
    ...(source?.source
      ? [
          [
            buy ? 'Đơn mua' : 'Đơn bán',
            a(buy ? procurementUrl('order', source.source) : saleUrl('order', source.source), source.source),
          ],
        ]
      : []),
    ...(buy
      ? [
          ['Số hóa đơn NCC', esc(x.ref || '—')],
          ['Ký hiệu hóa đơn', esc(x.symbol || '—')],
        ]
      : []),
    ...(!buy && invoiceDeposits(x).length
      ? [['Cọc còn giữ', money(invoiceDeposits(x).reduce((sum, row) => sum + depositBalance(row), 0))]]
      : []),
  ];
  const metadata =
    '<dl class="invoice-meta">' +
    fields.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') +
    '</dl>';
  const totals =
    '<div class="invoice-totals">' +
    metrics
      .map(([label, value]) => '<div><small>' + label + '</small><strong>' + value + '</strong></div>')
      .join('') +
    '</div>';
  const electronic = !buy
    ? pill(x.einv || 'Chờ phát hành', x.einv === 'Đã cấp mã' ? 'good' : x.einv === 'Lỗi' ? 'bad' : 'attn')
    : '';
  const draftActions =
    x.state === 'Nháp' ? b('post-' + kind, 'Xác nhận ghi sổ', 'primary') + b('edit-' + kind, 'Sửa nháp') : '';
  const issueActions =
    recorded && !buy
      ? x.einv === 'Đã cấp mã'
        ? b('sales-adjust|' + x.code, 'Trả lại / Giảm giá')
        : b('issue-single', 'Phát hành HĐĐT', 'primary')
      : '';
  const depositAction =
    recorded && !buy && invoiceDeposits(x).length ? b('deposit-apply|' + x.code, 'Cấn trừ đặt cọc') : '';
  const reviewAction =
    recorded && buy && x.special && x.review === 'Chờ duyệt'
      ? tenantOnly()
        ? b('special-review|' + x.code, 'Duyệt chứng từ', 'primary')
        : pill('Chờ Quản trị tenant duyệt', 'attn')
      : '';
  const cancelAction = recorded && !x.special ? b('cancel-' + kind, 'Hủy chứng từ', 'warn') : '';
  const buttons =
    draftActions +
    invoicePaymentButton(kind, x) +
    issueActions +
    depositAction +
    reviewAction +
    (recorded && !buy ? a(11, 'Xem sổ cái') : '') +
    (buy ? a(23, 'Đối soát cuối kỳ') : '') +
    b('print-accounting', 'In / Lưu PDF') +
    cancelAction;
  const goods =
    table(
      ['Mặt hàng / dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thuế suất', 'Thành tiền'],
      (x.lines || rowDefinitions[kind].values).map(([name, uom, qty, price, rate]) => [
        esc(name),
        esc(uom),
        esc(qty),
        money(price),
        esc(/^\d+$/.test(String(rate)) ? rate + '%' : rate),
        money(Math.round(Number(qty) * Number(price))),
      ]),
      [2, 3, 4, 5],
    ) +
    '<div class="invoice-line-totals"><span>Tiền hàng <strong>' +
    money(amounts.base) +
    '</strong></span><span>Thuế GTGT <strong>' +
    money(amounts.tax) +
    '</strong></span></div>';
  const variance = buy && source ? amounts.base - receiptValue(source) : 0;
  const accounting =
    (variance
      ? '<div class="pad">' +
        note(
          'Chênh lệch giá trước thuế so với phiếu nhập: ' +
            money(variance) +
            '. Kiểm tra bút toán điều chỉnh vật tư bên dưới.',
        ) +
        '</div>'
      : '') +
    postingTable(
      x.state === 'Nháp'
        ? [
            {
              code: x.code,
              day: x.post ? isoDate(x.post) : x.day,
              state: 'Xem trước',
              lines: sourceJournalData(kind, x),
            },
          ]
        : linkedJournal(x.code),
    );
  return (
    pad(
      x.code,
      '<div class="summary-row"><strong>' +
        esc(x.party) +
        '</strong><div class="actions">' +
        pill(x.state, recorded ? 'good' : '') +
        electronic +
        '</div></div>' +
        metadata +
        totals +
        '<div class="actions invoice-actions">' +
        buttons +
        '</div>',
    ) +
    card(
      tabs(['Hàng hóa', 'Hạch toán', 'Thanh toán'], tab) +
        (tab === 1 ? accounting : tab === 2 ? relatedPayments(x) : goods),
    ) +
    pad(
      '',
      '<details class="invoice-history"><summary>Lịch sử xử lý</summary>' +
        note(esc(x.log || 'Chứng từ mẫu.')) +
        '</details>',
    )
  );
}

function acceptDelivery(x) {
  if (!x?.requiresAcceptance || x.accepted || x.state !== 'Đã ghi sổ') return;
  return openModal(
    'Nghiệm thu · ' + x.code,
    grid(field('Ngày hạch toán', 'day', sampleDate, 'date'), field('Số biên bản nghiệm thu', 'ref')) +
      note('Nợ 632 / Có 157 và ghi doanh thu chờ lập hóa đơn.'),
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day);
      if (error) return error;
      if (x.accepted || day < dayKey(x.day) || !String(data.get('ref') || '').trim())
        return 'Kiểm tra ngày và số biên bản nghiệm thu.';
      const value = purchaseTotal(x);
      const currentCost = deliveryCostAt(x, day);
      const lines = [
        debitLine('632', currentCost, x.code),
        creditLine('157', currentCost, x.code),
        debitLine('1319', value, x.party),
        creditLine(configuredAccount('income'), value, x.code),
      ];
      writeJournal('JV-NT-' + x.code, isoDate(day), 'Nghiệm thu giao hàng ' + x.code, lines, {
        source: x.code,
        sourceRoute: saleUrl('delivery', x.code),
        sourceManaged: true,
      });
      x.accepted = day;
      x.acceptanceRef = String(data.get('ref')).trim();
      x.recognize = true;
      touchClosing(day);
      route('28?source=' + encodeURIComponent(x.code));
      return '';
    },
    'Ghi nhận nghiệm thu',
  );
}

const scrapSales = [];
function scrapView() {
  return salesWorkspace('scrap');
}

function sellScrap() {
  return openModal(
    'Ghi thu bán phế liệu',
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      payPartyField('customers', ''),
      field('Nội dung / Phế liệu', 'description'),
      field('Giá chưa thuế (đ)', 'amount', '', 'number'),
      optionsField('Thuế suất GTGT', 'rate', vatRates, '10'),
      select('Cách hạch toán', 'mode', ['Ghi thu nhập khác 711', 'Ghi giảm chi phí lệnh 154']),
      workField(),
      select('Tài khoản thu', 'cash', ['1111', '1121']),
      field('Mã giao dịch ngân hàng', 'bank'),
    ),
    (data) => {
      const day = data.get('day'),
        err = postingDateError(day);
      if (err) return err;
      const party = catalogMatch('customers', data.get('party'))?.name,
        description = String(data.get('description') || '').trim();
      const base = Number(data.get('amount')),
        rate = data.get('rate'),
        cash = data.get('cash'),
        reduce = data.get('mode') === 'Ghi giảm chi phí lệnh 154',
        work = reduce ? data.get('work') : '';
      if (
        !catalogMatch('customers', party) ||
        !description ||
        !Number.isSafeInteger(base) ||
        base <= 0 ||
        !vatRates.some(([v]) => v === rate) ||
        !['1111', '1121'].includes(cash)
      )
        return 'Chọn khách hàng và kiểm tra thông tin bán phế liệu.';
      if (cash === '1121' && !String(data.get('bank') || '').trim()) return 'Nhập mã giao dịch ngân hàng.';
      if (
        reduce &&
        (work === commonWork ||
          workError(work, day) ||
          base >
            workBalance(work, day) +
              finishedReceipts
                .filter((x) => !x.cancelled && x.work === work && x.day <= day && x.actual == null)
                .reduce((n, x) => n + x.value, 0))
      )
        return 'Chọn lệnh chưa tính giá có chi phí còn đủ để giảm.';
      const tax = Math.round((base * (Number(rate) || 0)) / 100),
        code = 'PL-' + String(scrapSales.length + 1).padStart(4, '0');
      const lines = [
        debitLine(cash, base + tax, party),
        creditLine(work ? '154' : '711', base, work || party),
        ...(tax ? [creditLine('33311', tax, code)] : []),
      ];
      writeJournal('JV-' + code, isoDate(day), 'Bán phế liệu · ' + description, lines, {
        source: code,
        sourceRoute: '27?type=scrap',
        sourceManaged: true,
        log: String(data.get('bank') || ''),
      });
      scrapSales.push({
        code,
        day: isoDate(day),
        state: 'Đã ghi sổ',
        einv: 'Chờ phát hành',
        party,
        description,
        work,
        lines: [[description, 'Lần', 1, base, rate]],
      });
      touchClosing(day);
      say('Đã ghi bán phế liệu và đưa vào hàng chờ HĐĐT.');
      return '';
    },
    'Ghi thu',
  );
}
const warranties = [];
const warrantyBalance = (row) => row.provision - row.used;
function warrantyView() {
  const { rows, toolbar } = searchList(
    'warranties',
    warranties,
    'Tìm mã hồ sơ hoặc đơn bán',
    (x) => [x.code, x.order, x.note],
    [
      [
        'status',
        'Tất cả trạng thái',
        [
          ['open', 'Đang theo dõi'],
          ['closed', 'Đã kết thúc'],
        ],
        (x) => (x.closed ? 'closed' : 'open'),
      ],
    ],
  );
  return (
    pad(
      'Bảo hành theo đơn bán',
      b('warranty-new', 'Mở hồ sơ bảo hành', 'primary') +
        toolbar +
        table(
          ['Hồ sơ', 'Đơn bán', 'Cam kết', 'Còn dự phòng', 'Trạng thái', 'Thao tác'],
          rows.map((x) => [
            x.code,
            a(saleUrl('order', x.order), x.order),
            esc(x.note),
            money(warrantyBalance(x)),
            pill(x.closed ? 'Đã kết thúc' : 'Đang theo dõi'),
            x.closed
              ? '—'
              : b('warranty-spend|' + x.code, 'Ghi chi phí', 'link') +
                ' ' +
                b('warranty-close|' + x.code, 'Kết thúc', 'link'),
          ]),
          [3],
        ),
    ) + pad('Bút toán bảo hành', postingTable(records.journal.filter((x) => x.sourceRoute === 'warranty')))
  );
}
function newWarranty() {
  return openModal(
    'Hồ sơ bảo hành',
    grid(
      optionsField(
        'Đơn đã giao',
        'order',
        salesOrders
          .filter((x) => x.state === 'Đã xác nhận' && delivered(x.code) > 0)
          .map((x) => [x.code, x.code + ' · ' + x.party]),
      ),
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      field('Trích dự phòng (đ)', 'amount', '0', 'number'),
    ) + textArea('Cam kết / căn cứ ước tính', 'reason'),
    (data) => {
      const order = salesOrders.find((x) => x.code === data.get('order')),
        day = data.get('day'),
        amount = Number(data.get('amount')),
        reason = String(data.get('reason') || '').trim();
      const err = postingDateError(day);
      if (err) return err;
      if (
        !order ||
        order.state !== 'Đã xác nhận' ||
        !salesDeliveries.some(
          (x) => x.source === order.code && x.state === 'Đã ghi sổ' && dayKey(x.day) <= day,
        ) ||
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        !reason ||
        warranties.some((x) => x.order === order.code && !x.closed)
      )
        return 'Kiểm tra đơn, ngày đã giao, số dự phòng và cam kết.';
      const code = 'BH-' + String(warranties.length + 1).padStart(4, '0');
      if (amount)
        writeJournal(
          'JV-' + code,
          isoDate(day),
          'Trích dự phòng bảo hành ' + order.code,
          [debitLine('6421', amount, code), creditLine('352', amount, code)],
          { source: code, sourceRoute: 'warranty', sourceManaged: true },
        );
      warranties.push({ code, order: order.code, day, note: reason, provision: amount, used: 0, events: [] });
      touchClosing(day);
      say('Đã mở hồ sơ bảo hành.');
      return '';
    },
    'Lưu hồ sơ',
  );
}
function warrantyEvent(row, close) {
  if (!row || row.closed) return;
  return openModal(
    close ? 'Kết thúc bảo hành' : 'Chi bảo hành',
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      ...(close
        ? []
        : [
            field('Số tiền (đ)', 'amount', '', 'number'),
            select('Tài khoản chi', 'cash', ['1111', '1121']),
            field('Mã giao dịch ngân hàng', 'ref'),
          ]),
    ) + textArea('Biên bản / lý do', 'reason'),
    (data) => {
      const day = data.get('day'),
        err = postingDateError(day);
      if (err) return err;
      const amount = Number(data.get('amount')),
        cash = data.get('cash'),
        reason = String(data.get('reason') || '').trim();
      if (row.closed || day < row.day || row.events.some((x) => x > day) || !reason)
        return 'Kiểm tra ngày và lý do.';
      const left = warrantyBalance(row);
      if (
        !close &&
        (!Number.isSafeInteger(amount) ||
          amount <= 0 ||
          !['1111', '1121'].includes(cash) ||
          (cash === '1121' && !String(data.get('ref') || '').trim()))
      )
        return 'Kiểm tra số tiền và thông tin tài khoản chi.';
      const fromReserve = Math.min(left, amount);
      const lines = close
        ? left
          ? [debitLine('352', left, row.code), creditLine('6421', left, row.code)]
          : []
        : [
            ...(fromReserve ? [debitLine('352', fromReserve, row.code)] : []),
            ...(amount > fromReserve ? [debitLine('6421', amount - fromReserve, row.code)] : []),
            creditLine(cash, amount, row.code),
          ];
      const cashError = cashProjection(lines, day).error;
      if (cashError) return cashError;
      if (lines.length)
        writeJournal(
          'JV-' + row.code + '-' + String(records.journal.length + 1),
          isoDate(day),
          close ? 'Hoàn nhập dự phòng bảo hành' : 'Chi bảo hành',
          lines,
          { source: row.code, sourceRoute: 'warranty', sourceManaged: true, log: reason },
        );
      row.events.push(day);
      if (close) {
        row.closed = true;
        row.used = row.provision;
      } else row.used += fromReserve;
      touchClosing(day);
      say(close ? 'Đã kết thúc hồ sơ.' : 'Đã ghi chi bảo hành.');
      return '';
    },
    'Xác nhận',
  );
}
function orderMargin(order, end) {
  const deliveries = salesDeliveries.filter(
    (x) => x.source === order.code && x.state === 'Đã ghi sổ' && dayKey(x.day) <= end,
  );
  const shipped = deliveries.filter((x) => !x.requiresAcceptance || (x.accepted && x.accepted <= end));
  let revenue = 0,
    cost = 0,
    unbilled = 0;
  for (const ship of shipped) {
    const invoice = invoiceAsOf(ship, end);
    if (!invoice) unbilled += 1;
    revenue += invoice ? invoiceTax(invoice, 'sale').base : purchaseTotal(ship);
    cost += deliveryCostAt(ship, end);
    if (invoice)
      revenue -= saleAdjustments
        .filter((x) => x.invoice === invoice.code && x.state === 'Đã ghi sổ' && x.day <= end)
        .reduce((n, x) => n + x.base, 0);
    cost -= stockReturns
      .filter((x) => x.delivery === ship.code && x.day <= end)
      .reduce((n, x) => n + x.value, 0);
    const originalReturns = stockReturns.filter((x) => x.delivery === ship.code && x.day <= end);
    for (const adjustment of costAdjustments.filter((x) => x.day <= end)) {
      for (const line of deliveryLines(ship)) {
        const priorQty = originalReturns
          .filter(
            (x) =>
              x.item === productFor(line).code &&
              x.day <= adjustment.day &&
              x.journalSequence < adjustment.seq,
          )
          .reduce((n, x) => n + x.qty, 0);
        cost -= Math.round((deliveryCostDelta(adjustment, ship, line) * priorQty) / line.qty);
      }
    }
  }
  return { revenue, cost, unbilled };
}
function marginView() {
  const end = periodEnd(closingPeriod),
    orders = salesOrders.filter((x) => x.state === 'Đã xác nhận');
  const line = (x) => {
    const result = orderMargin(x, end);
    return [
      money(result.revenue),
      money(result.cost),
      money(result.revenue - result.cost),
      result.unbilled ? pill('Tạm tính · chưa lập HĐ', 'attn') + ' · ' + result.unbilled + ' phiếu' : '—',
    ];
  };
  return (
    pad(
      'Lãi gộp lũy kế theo đơn đến ' + isoDate(end),
      table(
        ['Đơn', 'Khách', 'Doanh thu', 'Giá vốn', 'Lãi gộp', 'Căn cứ'],
        orders.map((x) => [a(saleUrl('order', x.code), x.code), esc(x.party), ...line(x)]),
        [2, 3, 4],
      ),
    ) +
    pad(
      'Lệnh sản xuất liên kết đơn',
      table(
        ['Lệnh', 'Đơn', 'Dở dang', 'Doanh thu liên kết', 'Giá vốn liên kết', 'Lãi gộp liên kết', 'Căn cứ'],
        workOrders.map((x) => {
          const order = orders.find((o) => o.code === x.sale);
          const metrics = !order
            ? ['—', '—', '—', '—']
            : workOrders.filter((w) => w.sale === x.sale).length > 1
              ? ['Chung nhiều lệnh', '—', '—', '—']
              : line(order);
          return [
            a(workUrl(x.code), x.code),
            order ? a(saleUrl('order', order.code), order.code) : '—',
            money(workBalance(x.code, end)),
            ...metrics,
          ];
        }),
        [2, 3, 4, 5],
      ) +
        note(
          'Số theo lệnh lấy từ đơn liên kết duy nhất. Đơn gắn nhiều lệnh vẫn xem đầy đủ ở bảng theo đơn. Doanh thu tạm tính lấy theo phiếu giao trong báo cáo quản trị, chưa ghi thêm doanh thu hoặc thuế vào sổ.',
        ),
    )
  );
}

function salesWorkspace(defaultType = '') {
  const p = routeParams();
  const selected = p.get('type') || defaultType || invoiceKind;
  const stageFilter = p.get('einv') || invoiceStage;
  const rows = visibleDocuments([
    ...records.sale.map((x) => ({ ...x, type: 'finished' })),
    ...scrapSales.map((x) => ({ ...x, type: 'scrap' })),
    ...saleAdjustments.map((x) => ({
      ...x,
      day: isoDate(x.day),
      amount: -(x.base + x.tax),
      type: 'adjustment',
      einv: x.einvoice ? 'Đã cấp mã' : x.einv,
    })),
  ]).filter(
    (x) =>
      (!selected || x.type === selected) &&
      (!stageFilter ||
        ((x.state === 'Đã ghi sổ' || x.type === 'adjustment') &&
          (x.einv || 'Chờ phát hành') === stageFilter)),
  );
  const labels = { finished: 'Bán thành phẩm', scrap: 'Bán phế liệu', adjustment: 'Điều chỉnh · trả lại' };
  return pad(
    'Hóa đơn bán',
    documentFilters() +
      '<div class="filters">' +
      optionsField(
        'Loại hóa đơn',
        'sales-type',
        Object.entries(labels).filter(([type]) => type !== 'scrap'),
        selected,
      ) +
      optionsField(
        'Trạng thái HĐĐT',
        'sales-einv',
        [
          ['Chờ phát hành', 'Chờ phát hành'],
          ['Đã cấp mã', 'Đã cấp mã'],
          ['Lỗi', 'Lỗi'],
        ],
        stageFilter,
      ) +
      '</div>' +
      table(
        ['Số chứng từ', 'Loại', 'Khách', 'Ngày', 'Hóa đơn gốc', 'Tổng tiền', 'Ghi sổ', 'HĐĐT', 'Thao tác'],
        rows.map((x) => [
          x.type === 'finished' ? recordLink('sale', x.code) : esc(x.code),
          labels[x.type],
          esc(x.party),
          esc(x.day),
          x.invoice ? recordLink('sale', x.invoice) : '—',
          money(x.amount ?? invoiceTax(x, 'sale').base + invoiceTax(x, 'sale').tax),
          pill(x.state),
          x.state === 'Nháp' || x.state === 'Đã hủy' ? '—' : pill(x.einv || 'Chờ phát hành'),
          x.type === 'adjustment'
            ? x.einvoice
              ? journalAnchor('JV-' + x.code)
              : b('sales-adjust-post|' + x.code, 'Phát hành', 'link')
            : x.state === 'Đã ghi sổ'
              ? b(
                  'einv-' + x.code,
                  x.einv === 'Đã cấp mã' ? 'Xem HĐĐT' : x.einv === 'Lỗi' ? 'Xem lỗi / thử lại' : 'Phát hành',
                  'link',
                )
              : '—',
        ]),
        [5],
      ),
  );
}
