let testDataLoaded = false;
const testDocumentGroups = [
  ['Đơn mua', 'orders-buy', 'PO', '00001', 'Đã xác nhận'],
  ['Phiếu nhập kho', 'receipts', 'GRN', '00001', 'Đã ghi sổ'],
  ['Hóa đơn mua', '29', 'PINV', '00089', 'Đã ghi sổ'],
  ['Đơn bán', 'orders-sale', 'SO', '00002', 'Đã xác nhận'],
  ['Phiếu giao hàng', 'deliveries', 'DN', '00003', 'Đã ghi sổ'],
  ['Hóa đơn bán', '27', 'SINV', '00065', 'Đã ghi sổ'],
  ['Phiếu thanh toán', '5', 'PT', '00008', 'Đã ghi sổ'],
  ['Bút toán', '2', 'JV', '00012', 'Đã ghi sổ'],
];
function testDocumentLink(prefix, sequence) {
  const code = prefix + '-2026-' + sequence;
  const routeByType = {
    PO: () => procurementUrl('order', code),
    GRN: () => procurementUrl('receipt', code),
    SO: () => saleUrl('order', code),
    DN: () => saleUrl('delivery', code),
    PINV: () => purchaseHref(code),
    SINV: () => '28?code=' + encodeURIComponent(code),
    PT: () => '7?code=' + encodeURIComponent(code),
    PC: () => '7?code=' + encodeURIComponent(code),
    JV: () => journalHref(code),
  };
  return a(routeByType[prefix](), code);
}
function testDataView() {
  const testLink = (prefix, sequence) => (testDataLoaded ? testDocumentLink(prefix, sequence) : '—');
  const docs = testDocumentGroups.map(([label, id, prefix, existing, state]) => [
    a(id, label),
    testLink(prefix, '90101'),
    testDocumentLink(prefix, existing) + ' ' + pill(state, 'good'),
    testLink(prefix, '90102'),
  ]);
  const extended = [
    [
      a(27, 'Hóa đơn điện tử'),
      'Chờ phát hành, Đã cấp mã, Lỗi',
      testLink('SINV', '90103') + ' · ' + testLink('SINV', '90104'),
    ],
    [
      a(5, 'Phiếu chi'),
      'Nháp, Đã ghi sổ, Đã hủy',
      testLink('PC', '90101') + ' · ' + testLink('PC', '90103') + ' · ' + testLink('PC', '90102'),
    ],
    [
      a(8, 'Công nợ'),
      'Chưa thanh toán, thanh toán một phần, đã thanh toán',
      testLink('SINV', '90104') + ' · ' + testLink('PINV', '90104') + ' · ' + testLink('SINV', '90103'),
    ],
    [a(10, 'Sao kê ngân hàng'), 'Chờ khớp, Đã khớp', testDataLoaded ? 'FT-DEMO-90103' : '—'],
    [
      a('warehouse-docs?type=purchase', 'Chứng từ kho'),
      'Nháp, Đã ghi sổ, Đã hủy',
      testLink('GRN', '90101') + ' · ' + testLink('GRN', '90104') + ' · ' + testLink('GRN', '90102'),
    ],
    [
      a('warehouse-docs?type=count', 'Kiểm kê'),
      'Chờ xử lý, đã xử lý, đã hủy',
      testDataLoaded
        ? ['KK-DEMO-01', 'KK-DEMO-02', 'KK-DEMO-03']
            .map((code) => a(stockDocLink('count', code), code))
            .join(' · ')
        : '—',
    ],
    [
      a('warehouse-docs?type=transfer', 'Chuyển kho'),
      'Đã ghi sổ, đã hủy',
      testDataLoaded
        ? ['CK-DEMO-01', 'CK-DEMO-02'].map((code) => a(stockDocLink('transfer', code), code)).join(' · ')
        : '—',
    ],
    [
      a('8?tab=deposits', 'Đặt cọc'),
      'Còn giữ, đã trả hết',
      testDataLoaded ? 'PT-COC-DEMO-01 · PT-COC-DEMO-02' : '—',
    ],
    [
      a('warranty', 'Bảo hành'),
      'Đang theo dõi, Đã kết thúc',
      testDataLoaded ? 'BH-DEMO-01 · BH-DEMO-02' : '—',
    ],
    [
      a('materials', 'Nguyên liệu') + ' · ' + a('products', 'Thành phẩm') + ' · ' + a('warehouse', 'Kho'),
      'Đang sử dụng và ngừng sử dụng',
      testDataLoaded ? 'Tìm DEMO để xem mẫu ngừng sử dụng.' : '—',
    ],
    [
      a('suppliers', 'Nhà cung cấp') + ' · ' + a('customers', 'Khách hàng'),
      'Doanh nghiệp, Hộ / cá nhân',
      testDataLoaded ? 'Tìm DEMO để xem khách cá nhân.' : '—',
    ],
    [
      a('assets', 'Tài sản') + ' · ' + a('prepaid', 'Chi phí trả trước'),
      'Còn số dư, hết số dư',
      'Tài sản máy CNC và CCDC mẫu. Sau khi nạp, tìm DEMO để xem hồ sơ hết số dư.',
    ],
    [
      a(17, 'Tờ khai GTGT'),
      'Nháp → Đã chốt → Đã nộp',
      'Dùng các nút Chốt số liệu và Ghi nhận đã nộp để thử lần lượt.',
    ],
    [
      a(23, 'Chốt sổ'),
      'Đang mở → Kết chuyển → Duyệt → Đã khóa',
      'Kỳ 11/2026. Hoàn tất hoặc hủy các bản nháp trước khi kết chuyển.',
    ],
    [
      a(26, 'Báo cáo tài chính'),
      'Kỳ có số liệu và kỳ chưa phát sinh',
      'Đổi kỳ để so sánh. Báo cáo lấy số từ bút toán đã ghi sổ.',
    ],
  ];
  return (
    pad(
      '',
      note(
        'Bộ mẫu dùng kỳ 11/2026. Mã 90xxx hoặc DEMO là dữ liệu kiểm thử. Bản nháp và kiểm kê chờ xử lý cần được giải quyết trước khi chốt kỳ.',
      ) +
        (testDataLoaded
          ? pill('Đã nạp dữ liệu kiểm thử', 'good')
          : b('load-test-data', 'Nạp dữ liệu kiểm thử', 'primary')),
    ) +
    pad('Chứng từ theo trạng thái', table(['Màn hình', 'Nháp', 'Đã xác nhận / ghi sổ', 'Đã hủy'], docs)) +
    pad('Các tình huống kiểm thử khác', table(['Màn hình', 'Trạng thái', 'Dữ liệu hoặc thao tác'], extended))
  );
}
function loadTestData() {
  if (testDataLoaded) return;
  const day = '19/11/2026',
    date = dayKey(day),
    warehouse = 'KHO-NL',
    salesWarehouse = 'KHO-TP';
  const partyBuy = purchase.supplier,
    partySale = 'Khách cá nhân DEMO',
    product = 'TP-GHE-GO',
    price = 500000;
  if (periodLocked(date) || stage.closing)
    return say('Kỳ đã kết chuyển hoặc đã khóa. Mở một phiên demo mới để nạp bộ mẫu.');
  if (
    !validWarehouse(warehouse, materialGroup) ||
    !validWarehouse(salesWarehouse, finishedGroup) ||
    !catalogMatch('suppliers', partyBuy) ||
    !itemBy('VCN-0000004') ||
    itemBy(product)?.group !== finishedGroup ||
    stockOutAfter(product, date) ||
    quantityAt(product, salesWarehouse, date) < 3
  )
    return say('Không đủ danh mục hoặc tồn kho theo ngày mẫu. Mở một phiên demo mới để nạp bộ mẫu.');
  catalogSpec.customers.rows.push({ code: 'KH-DEMO', name: partySale, extra: '', customerType: 'Cá nhân' });
  catalogSpec.items.rows.push(
    {
      code: 'NL-DEMO',
      name: 'Nguyên liệu DEMO ngừng sử dụng',
      extra: 'Tấm',
      group: materialGroup,
      active: false,
      openQty: 0,
      openValue: 0,
    },
    {
      code: 'TP-DEMO',
      name: 'Thành phẩm DEMO ngừng sử dụng',
      extra: 'Cái',
      group: finishedGroup,
      active: false,
      openQty: 0,
      openValue: 0,
    },
  );
  catalogSpec.warehouse.rows.push(
    { code: 'KHO-DEMO', name: 'Kho DEMO ngừng sử dụng', group: materialGroup, active: false, default: false },
    { code: 'KHO-DEMO-NL', name: 'Kho phụ DEMO', group: materialGroup, active: true, default: false },
  );
  for (const key of ['assets', 'prepaid'])
    profileStore[key].push({
      ...profileStore[key][0],
      code: key === 'assets' ? 'TS-DEMO' : 'CCDC-DEMO',
      party: 'Hồ sơ DEMO hết số dư',
      value: 0,
      opening: 0,
      monthlyAmount: 0,
    });
  const code = (prefix, sequence) => prefix + '-2026-' + sequence;
  const draft = 'Nháp',
    canceled = 'Đã hủy',
    posted = 'Đã ghi sổ',
    confirmed = 'Đã xác nhận';
  const draftLog = 'Dữ liệu kiểm thử';
  const buyLine = { item: purchase.name, product: purchase.sku, uom: 'Tấm', qty: 2, price: 400000 };
  const buyForm = { day, party: partyBuy, ...buyLine };
  const saleForm = { day, party: partySale, product, qty: 1, price };
  const addOrder = (list, prefix, sequence, model, state) => {
    const row = { ...model, code: code(prefix, sequence), state, log: draftLog };
    list.push(row);
    return row;
  };
  const purchaseSource = addOrder(purchaseOrders, 'PO', '90103', { ...buyForm, qty: 8 }, confirmed);
  for (const [sequence, state] of [
    ['90101', draft],
    ['90102', canceled],
  ]) {
    addOrder(purchaseOrders, 'PO', sequence, buyForm, state);
    addOrder(salesOrders, 'SO', sequence, saleForm, state);
    addOrder(receipts, 'GRN', sequence, { ...buyForm, source: purchaseSource.code, warehouse }, state);
  }
  for (const sequence of ['90103', '90104']) {
    const receipt = addOrder(
      receipts,
      'GRN',
      sequence,
      { ...buyForm, source: purchaseSource.code, warehouse },
      posted,
    );
    demoJournal(
      'JV-DEMO-' + receipt.code,
      receipt.code,
      day,
      'Nhập kho mẫu',
      receiptPostLines(receipt),
      procurementUrl('receipt', receipt.code),
    );
  }
  const saleSource = addOrder(salesOrders, 'SO', '90103', { ...saleForm, qty: 5 }, confirmed);
  for (const [sequence, state] of [
    ['90101', draft],
    ['90102', canceled],
  ])
    addOrder(
      salesDeliveries,
      'DN',
      sequence,
      { ...saleForm, source: saleSource.code, warehouse: salesWarehouse },
      state,
    );
  for (const sequence of ['90103', '90104', '90105']) {
    const delivery = {
      ...saleForm,
      code: code('DN', sequence),
      source: saleSource.code,
      warehouse: salesWarehouse,
      state: posted,
    };
    delivery.cost = stockValueOut(inventory(product, date), delivery.qty);
    salesDeliveries.push(delivery);
    demoJournal(
      'JV-DEMO-' + delivery.code,
      delivery.code,
      day,
      'Giá vốn giao hàng mẫu',
      deliveryPostLines(delivery),
      saleUrl('delivery', delivery.code),
    );
  }
  const invoiceModel = (kind, sequence, source, state, einv = 'Chờ phát hành') => {
    const buy = kind === 'buy',
      unit = buy ? 'Tấm' : 'Cái';
    const qty = buy ? buyLine.qty : saleForm.qty;
    const unitPrice = buy ? buyLine.price : price;
    const name = buy ? buyLine.item : productFor(saleForm).name;
    const row = {
      kind,
      code: code(buy ? 'PINV' : 'SINV', sequence),
      source,
      day,
      post: date,
      due: date,
      party: buy ? partyBuy : partySale,
      amount: Math.round(qty * unitPrice * 1.1),
      paid: 0,
      state,
      einv,
      ref: 'DEMO-' + sequence,
      lines: [[name, unit, qty, unitPrice, '10']],
      log: draftLog,
    };
    records[kind].push(row);
    if (state === posted)
      demoJournal(
        'JV-DEMO-' + row.code,
        row.code,
        day,
        'Hóa đơn mẫu',
        sourceJournalData(kind, row),
        targets[kind] + '?code=' + row.code,
      );
    return row;
  };
  invoiceModel('buy', '90101', code('GRN', '90103'), draft);
  invoiceModel('buy', '90102', code('GRN', '90102'), canceled);
  const buyPosted = invoiceModel('buy', '90104', code('GRN', '90104'), posted);
  invoiceModel('sale', '90101', code('DN', '90105'), draft);
  invoiceModel('sale', '90102', code('DN', '90102'), canceled);
  const salePaid = invoiceModel('sale', '90103', code('DN', '90103'), posted, 'Đã cấp mã');
  salePaid.vnpt = { number: 'DEMO-90103', symbol: '1C26TTP (mẫu)', lookup: 'DEMO-90103', date: day };
  const saleFailed = invoiceModel('sale', '90104', code('DN', '90104'), posted, 'Lỗi');
  saleFailed.vnpt = { error: 'Lỗi kết nối mô phỏng' };
  const paymentModel = (prefix, sequence, invoice, amount, state, cash = accounts[0], ref = '') => {
    const row = {
      kind: 'pay',
      code: code(prefix, sequence),
      day,
      post: date,
      party: invoice.party,
      amount,
      state,
      type: prefix === 'PC' ? 'Chi tiền' : 'Thu tiền',
      cash,
      ref,
      lines: [[invoice.code, remaining(invoice), amount]],
      log: draftLog,
    };
    records.pay.push(row);
    if (state === posted) {
      invoice.paid += amount;
      demoJournal(
        'JV-DEMO-' + row.code,
        row.code,
        day,
        'Thanh toán mẫu',
        sourceJournalData('pay', row),
        '7?code=' + row.code,
      );
    }
    return row;
  };
  paymentModel('PT', '90101', saleFailed, 100000, draft);
  paymentModel('PT', '90102', saleFailed, 100000, canceled);
  const matched = paymentModel(
    'PT',
    '90103',
    salePaid,
    salePaid.amount,
    posted,
    accounts[1],
    'FT-DEMO-90103',
  );
  paymentModel('PC', '90101', buyPosted, 100000, draft);
  paymentModel('PC', '90102', buyPosted, 100000, canceled);
  paymentModel('PC', '90103', buyPosted, 200000, posted);
  bank.push([day, matched.ref, matched.party, matched.amount, 'Đã khớp', matched.code]);
  for (const [sequence, state] of [
    ['90101', draft],
    ['90102', canceled],
  ])
    writeJournal(
      code('JV', sequence),
      day,
      'Chi phí văn phòng DEMO',
      [debitLine('6422', 50000), creditLine('3388', 50000)],
      { state, log: draftLog },
    );
  warranties.push(
    {
      code: 'BH-DEMO-01',
      order: saleSource.code,
      day: date,
      note: 'Bảo hành ghế gỗ DEMO',
      provision: 0,
      used: 0,
      events: [],
    },
    {
      code: 'BH-DEMO-02',
      order: saleSource.code,
      day: date,
      note: 'Hồ sơ DEMO đã kết thúc',
      provision: 0,
      used: 0,
      events: [date],
      closed: true,
    },
  );
  const countItem = buyLine.product;
  const countValue = stockValueOut(inventory(countItem, date), 1);
  for (const [sequence, resolved, cancelled] of [
    ['01', false, false],
    ['02', true, false],
    ['03', false, true],
  ]) {
    const code = 'KK-DEMO-' + sequence;
    const count = {
      code,
      day: date,
      item: countItem,
      warehouse,
      qty: 1,
      value: countValue,
      reason: 'Tìm thấy vật tư thừa khi kiểm kê DEMO',
      cancelled,
    };
    stockChecks.push(count);
    if (!cancelled) {
      demoJournal(
        'JV-' + code,
        code,
        day,
        'Ghi thừa kiểm kê mẫu',
        [debitLine('152', countValue, countItem), creditLine('3381', countValue, code)],
        stockDocLink('count', code),
      );
      if (resolved) {
        count.resolution = {
          code: 'JV-' + code + '-XL',
          day: date,
          reason: 'Ghi thu nhập khác',
          account: '711',
        };
        demoJournal(
          count.resolution.code,
          code,
          day,
          'Xử lý kiểm kê mẫu',
          [debitLine('3381', countValue, code), creditLine('711', countValue, code)],
          stockDocLink('count', code),
        );
      }
    }
  }
  for (const [sequence, cancelled] of [
    ['01', false],
    ['02', true],
  ])
    stockTransfers.push({
      code: 'CK-DEMO-' + sequence,
      day: date,
      item: countItem,
      from: warehouse,
      to: 'KHO-DEMO-NL',
      qty: 1,
      reason: 'Chuyển vật tư giữa hai kho DEMO',
      sequence: records.journal.length,
      cancelled,
    });
  for (const [sequence, refunded] of [
    ['01', false],
    ['02', true],
  ]) {
    const code = 'PT-COC-DEMO-' + sequence,
      amount = 50000;
    const deposit = {
      code,
      order: saleSource.code,
      party: partySale,
      amount,
      day: date,
      cash: '1111',
      events: [],
    };
    deposits.push(deposit);
    records.pay.push({
      code,
      day,
      party: partySale,
      amount,
      state: posted,
      type: 'Thu đặt cọc',
      cash: '1111',
      lines: [],
      deposit: true,
      special: 'deposit',
      source: saleSource.code,
      sourceRoute: saleUrl('order', saleSource.code),
    });
    demoJournal(
      'JV-' + code,
      code,
      day,
      'Thu đặt cọc mẫu',
      [debitLine('1111', amount, saleSource.code), creditLine('131', amount, partySale)],
      '8?tab=deposits',
    );
    if (refunded) {
      const refund = 'PC-COC-DEMO-' + sequence;
      records.pay.push({
        code: refund,
        day,
        party: partySale,
        amount,
        state: posted,
        type: 'Chi trả cọc',
        cash: '1111',
        lines: [],
        deposit: true,
        special: 'deposit',
        source: saleSource.code,
        sourceRoute: saleUrl('order', saleSource.code),
      });
      demoJournal(
        'JV-' + refund,
        code,
        day,
        'Trả đặt cọc mẫu',
        [debitLine('131', amount, partySale), creditLine('1111', amount, saleSource.code)],
        '8?tab=deposits',
      );
      deposit.events.push({ type: 'Trả cọc', day: date, amount, code: 'JV-' + refund });
    }
  }
  testDataLoaded = true;
  touchClosing(date);
  say('Đã nạp dữ liệu kiểm thử. Bấm mã trong bảng để mở chứng từ.');
}
