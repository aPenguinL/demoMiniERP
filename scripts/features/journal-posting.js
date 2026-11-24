const purchase = {
  order: 'PO-2026-00001',
  receipt: 'GRN-2026-00001',
  invoice: 'PINV-2026-00089',
  supplier: 'Công ty TNHH Tân Hoàng Phát',
  sku: 'VCN-0000004',
  name: 'Ván MDF chống ẩm',
  warehouse: 'KHO-NL',
  qty: 20,
  unitPrice: 410000,
  opening: 77900000,
};
const postedAmount = (code, period = '11/2026', all = journalLines()) =>
  all
    .filter((line) => line.code === code && monthOf(line) === period)
    .reduce((n, x) => n + x.debit - x.credit, beginningAmount(code, period, all));
const purchaseLine = (label, object, debit, credit) => [
  accounts.find((x) => accountCode(x) === label) || label,
  object,
  debit,
  credit,
];
const debitLine = (code, amount, object = '') => purchaseLine(code, object, amount, 0);
const creditLine = (code, amount, object = '') => purchaseLine(code, object, 0, amount);
function writeJournal(code, day, party, lines, options = {}) {
  const state = options.state || 'Đã ghi sổ';
  const entry = {
    kind: 'journal',
    code,
    day,
    party,
    lines,
    state,
    amount: lines.reduce((n, x) => n + x[2], 0),
    log: state === 'Nháp' ? 'Đã tạo bản nháp.' : 'Bút toán đã ghi trong phiên mẫu.',
    ...options,
  };
  records.journal.push(entry);
  return entry;
}
const journalBy = (code) => records.journal.find((x) => x.code === code);
function purchaseVarianceSplit(receipt, variance, day) {
  const item = catalogMatch('items', receipt.item)?.code || receipt.item;
  const issued = productionIssues.filter(
    (r) =>
      r.item === item && !r.cancelled && dayKey(r.day) >= dayKey(receipt.day) && dayKey(r.day) <= dayKey(day),
  );
  let left = Math.min(
    receipt.qty,
    issued.reduce((n, r) => n + r.qty, 0),
  );
  const byWork = new Map();
  for (const r of issued) {
    if (left <= 0) break;
    const q = Math.min(r.qty, left);
    left -= q;
    byWork.set(r.work, (byWork.get(r.work) || 0) + q);
  }
  const parts = [];
  let used = 0;
  for (const [work, qty] of byWork) {
    const value = Math.round((variance * qty) / receipt.qty);
    used += value;
    parts.push(workError(work, day) ? ['632', value, work] : ['154', value, work]);
  }
  parts.push([stockAccount(materialGroup), variance - used, item]);
  return parts.filter(([, value]) => value);
}
function postedCounterAccount(source, key, side) {
  const posting = linkedJournal(source).find((entry) => entry.state === 'Đã ghi sổ');
  const [, , pattern] = defaultAccountRules[key];
  const row = posting?.lines.find(
    ([account, , debit, credit]) =>
      (pattern
        ? pattern.test(accountCode(account))
        : accountCode(account).startsWith(defaultAccountRules[key][1])) &&
      (side === 'debit' ? debit : credit) > 0,
  );
  return row ? accountCode(row[0]) : '';
}
function sourceJournalData(kind, x) {
  if (kind === 'buy' || kind === 'sale') {
    const { base, tax } = invoiceTax(x, kind);
    if (kind === 'buy') {
      const receipt = receipts.find((r) => r.code === x.source && r.state === 'Đã ghi sổ');
      const provisional = receipt ? receiptValue(receipt) : base;
      const parts = receipt
        ? receiptLines(receipt).flatMap((line, index) => {
            const variance = invoiceReceiptVariance(line, x, index);
            return variance
              ? purchaseVarianceSplit({ ...line, day: receipt.day }, variance, x.post || x.day)
              : [];
          })
        : [];
      return [
        debitLine(receipt ? '3319' : '6422', receipt ? provisional : base, x.source || x.party),
        ...parts.map(([account, value, object]) =>
          value > 0 ? debitLine(account, value, object) : creditLine(account, -value, object),
        ),
        ...(tax ? [debitLine('1331', tax, x.code)] : []),
        creditLine(configuredAccount('payable'), x.amount, x.party),
      ];
    }
    const delivery = salesDeliveries.find((row) => row.code === x.source);
    return [
      debitLine(configuredAccount('receivable'), x.amount, x.party),
      creditLine(delivery?.recognize ? '1319' : configuredAccount('income'), base, delivery?.code),
      ...(tax ? [creditLine('33311', tax, x.code)] : []),
    ];
  }
  if (kind === 'pay') {
    const out = x.type === 'Chi tiền',
      key = out ? 'payable' : 'receivable';
    const fallback = configuredAccount(key),
      cash = x.cash ? accountCode(x.cash) : configuredAccount('bank');
    const allocations = new Map();
    let unallocated = x.amount;
    for (const [invoice, , part] of x.lines || []) {
      const amount = Number(part);
      if (!invoice || !amount) continue;
      const code = postedCounterAccount(invoice, key, out ? 'credit' : 'debit') || fallback;
      allocations.set(code, (allocations.get(code) || 0) + amount);
      unallocated -= amount;
    }
    if (unallocated > 0) allocations.set(fallback, (allocations.get(fallback) || 0) + unallocated);
    const counterpart = [...allocations].map(([code, amount]) =>
      out ? debitLine(code, amount, x.party) : creditLine(code, amount, x.party),
    );
    return out ? [...counterpart, creditLine(cash, x.amount)] : [debitLine(cash, x.amount), ...counterpart];
  }
  return [];
}
const journalHref = (code) => '4?code=' + encodeURIComponent(code);
const purchaseHref = (code) => '30?code=' + encodeURIComponent(code);
const journalAnchor = (code) => a(journalHref(code), code);
const isoDate = (value) => (value ? value.split('-').reverse().join('/') : '—');
const demoJournal = (code, source, day, party, lines, sourceRoute) =>
  writeJournal(code, day, party, lines, { source, sourceRoute, sourceManaged: true });
function seedPurchasing() {
  demoJournal(
    'JV-2026-00013',
    purchase.receipt,
    '16/11/2026',
    'Nhập kho vật tư từ ' + purchase.receipt,
    receiptPostLines(receipts[0]),
    'receipts?ref=' + purchase.receipt,
  );
  demoJournal(
    'JV-2026-00014',
    purchase.invoice,
    '17/11/2026',
    'Ghi nhận hóa đơn mua',
    sourceJournalData('buy', records.buy[0]),
    purchaseHref(purchase.invoice),
  );
  demoJournal(
    'JV-GH-00003',
    'DN-2026-00003',
    '18/11/2026',
    'Giá vốn thành phẩm giao khách',
    deliveryPostLines({ ...salesDeliveries[0], cost: 7200000 }),
    saleUrl('delivery', 'DN-2026-00003'),
  );
  demoJournal(
    'JV-2026-00015',
    'SINV-2026-00065',
    '18/11/2026',
    'Doanh thu bán thành phẩm',
    [
      debitLine('131', 13200000, 'Nội thất An Phú'),
      creditLine('5112', 12000000),
      creditLine('33311', 1200000),
    ],
    '28?code=SINV-2026-00065',
  );
  demoJournal(
    'JV-2026-00016',
    'PT-2026-00008',
    '19/11/2026',
    'Thu một phần tiền bán hàng',
    [debitLine('1121', 6000000), creditLine('131', 6000000, 'Nội thất An Phú')],
    '7?code=PT-2026-00008',
  );
  bookWage(wageModel(employees[0], '2026-11-19', 24000000, 1250000, workOrders[0].code), 'BL-2026-11');
  postWage(wageRuns.at(-1));
  demoJournal(
    'JV-2026-00017',
    'BANK-FEE-01',
    '19/11/2026',
    'Phí duy trì tài khoản',
    [debitLine('6422', 22000), creditLine('1121', 22000)],
    '10',
  );
}
