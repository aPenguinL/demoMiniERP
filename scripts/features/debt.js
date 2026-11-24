let debtFilter = 'all';
const dueDate = (x) =>
  x.due || { 'SINV-2026-00065': '2026-12-19', 'PINV-2026-00089': '2026-11-18' }[x.code] || '2026-12-19';
const isLate = (x) => dueDate(x) < todayKey();
const remaining = (x) => Math.max(0, (x?.amount || 0) - (x?.paid || 0) - adjustmentAmount(x?.code));
const openDebt = (kind) => records[kind].filter((x) => x.state === 'Đã ghi sổ' && remaining(x) > 0);
function debtCard(kind, title) {
  const debts = openDebt(kind);
  const sign = kind === 'buy' ? -1 : 1;
  const period = postingPeriod(todayKey());
  const base = kind === 'buy' ? '331' : '131';
  const codes = [...new Set([...openingCodes(), ...journalLines().map((line) => line.code)])];
  const total =
    sign *
    codes
      .filter((code) => code.startsWith(base) && partyType(code))
      .reduce((n, code) => n + postedAmount(code, period), 0);
  const invoiceTotal = debts.reduce((n, x) => n + remaining(x), 0);
  const late = debts.filter(isLate).reduce((n, x) => n + remaining(x), 0);
  const link = (filter, label, amount) =>
    '<div><span>' +
    label +
    '</span><a href="#8?side=' +
    kind +
    '&amp;due=' +
    filter +
    '">' +
    money(amount) +
    '</a></div>';
  return pad(
    title,
    '<strong>' +
      money(total) +
      '</strong><div class="due-split">' +
      link('current', 'Hóa đơn trong hạn', invoiceTotal - late) +
      link('late', 'Hóa đơn quá hạn', late) +
      '</div>',
  );
}
const unallocated = (x) => (x.deposit ? 0 : x.amount - sum(x.lines || [], 2));
function debtJournalRows(kind, period = postingPeriod(todayKey())) {
  const prefix = kind === 'buy' ? '331' : '131';
  const key = kind === 'buy' ? 'suppliers' : 'customers';
  return journalLines().filter(
    (line) =>
      partyType(line.code) === key &&
      line.code.startsWith(prefix) &&
      (!line.entry.sourceManaged || line.entry.profile) &&
      monthKey(monthOf(line)) <= monthKey(period),
  );
}
function receivable() {
  if (tab === 3)
    return card(tabs(['Phải thu', 'Phải trả', 'Ứng trước', 'Cọc đang giữ'], tab)) + depositView();
  const kind = tab === 1 ? 'buy' : 'sale';
  const open =
    tab === 2 ? records.pay.filter((x) => x.state === 'Đã ghi sổ' && unallocated(x) > 0) : openDebt(kind);
  const { rows, toolbar } = searchList(
    tab === 2 ? 'debt-advances' : 'debt-' + kind,
    open,
    'Tìm theo mã chứng từ hoặc đối tác',
    (x) => [x.code, x.party, x.ref],
    tab === 2
      ? []
      : [
          [
            'due',
            'Tất cả hạn thanh toán',
            [
              ['current', 'Trong hạn'],
              ['late', 'Quá hạn'],
            ],
            (x) => (isLate(x) ? 'late' : 'current'),
          ],
        ],
    { due: debtFilter === 'all' ? '' : debtFilter },
  );
  return (
    '<div class="cards">' +
    debtCard('sale', 'Phải thu khách hàng') +
    debtCard('buy', 'Phải trả nhà cung cấp') +
    '</div>' +
    card(
      tabs(['Phải thu', 'Phải trả', 'Ứng trước', 'Cọc đang giữ'], tab) +
        toolbar +
        (tab === 2
          ? table(
              ['Đối tác', 'Ngày', 'Phiếu', 'Chưa phân bổ', 'Thao tác'],
              rows.map((x) => [
                esc(x.party),
                x.day,
                recordLink('pay', x.code),
                money(unallocated(x)),
                b('allocate-' + x.code, 'Phân bổ', 'link'),
              ]),
              [3],
            )
          : table(
              ['Đối tác', 'Hóa đơn mở', 'Còn nợ', 'Hạn thanh toán', 'Theo hạn', 'Thao tác'],
              rows.map((x) => [
                b('party-' + kind + '-' + x.code, x.party, 'link'),
                recordLink(kind, x.code),
                money(remaining(x)),
                dueDate(x).split('-').reverse().join('/'),
                pill(isLate(x) ? 'Quá hạn' : 'Trong hạn', isLate(x) ? 'attn' : 'good'),
                invoicePaymentButton(kind, x),
              ]),
              [2],
            )),
    ) +
    (tab !== 2
      ? pad(
          'Công nợ từ bút toán và hồ sơ',
          table(
            ['Đối tác', 'Bút toán', 'Ngày', 'Tăng / giảm công nợ'],
            debtJournalRows(kind).map((line) => [
              esc(catalogMatch(kind === 'buy' ? 'suppliers' : 'customers', line.party)?.name || line.party),
              recordLink('journal', line.entry.code),
              line.entry.day,
              money((kind === 'buy' ? -1 : 1) * (line.debit - line.credit)),
            ]),
            [3],
          ),
        )
      : '')
  );
}
