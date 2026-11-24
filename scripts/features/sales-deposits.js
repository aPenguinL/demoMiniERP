const deposits = [];

const depositBalance = (x) => x.amount - x.events.reduce((n, e) => n + e.amount, 0);
function depositView() {
  const { rows, toolbar } = searchList(
    'deposits',
    deposits,
    'Tìm mã phiếu, đơn bán hoặc khách hàng',
    (x) => [x.code, x.order, x.party],
    [
      [
        'status',
        'Tất cả trạng thái',
        [
          ['open', 'Còn giữ cọc'],
          ['settled', 'Đã xử lý hết'],
        ],
        (x) => (depositBalance(x) > 0 ? 'open' : 'settled'),
      ],
    ],
  );
  return pad(
    'Tiền đặt cọc theo đơn bán',
    toolbar +
      table(
        ['Phiếu', 'Ngày', 'Đơn bán', 'Khách', 'Đã nhận', 'Còn giữ', 'Thao tác'],
        rows.map((x) => [
          recordLink('pay', x.code),
          isoDate(x.day),
          a(saleUrl('order', x.order), x.order),
          esc(x.party),
          money(x.amount),
          money(depositBalance(x)),
          depositBalance(x) ? b('deposit-settle|' + x.code, 'Trả / giữ cọc', 'link') : '—',
        ]),
        [4, 5],
      ),
  );
}
function receiveDeposit(order) {
  if (order?.state !== 'Đã xác nhận') return;
  return openModal(
    'Thu đặt cọc · ' + order.code,
    grid(
      field('Ngày thanh toán', 'day', sampleDate, 'date'),
      field('Số tiền (đ)', 'amount', '', 'number'),
      select('Tài khoản tiền', 'cash', [accounts[0], accounts[1]]),
      field('Mã giao dịch ngân hàng', 'ref'),
    ),
    (data) => {
      const day = data.get('day'),
        amount = Number(data.get('amount')),
        cash = accountCode(data.get('cash'));
      const error = postingDateError(day);
      if (error) return error;
      if (
        order.state !== 'Đã xác nhận' ||
        day < dayKey(order.day) ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !['1111', '1121'].includes(cash)
      )
        return 'Kiểm tra ngày, đơn bán và số tiền cọc.';
      if (cash === '1121' && !String(data.get('ref') || '').trim()) return 'Nhập mã giao dịch ngân hàng.';
      const code = 'PT-COC-' + String(deposits.length + 1).padStart(4, '0');
      writeJournal(
        'JV-' + code,
        isoDate(day),
        'Thu đặt cọc ' + order.code,
        [debitLine(cash, amount, order.code), creditLine('131', amount, order.party)],
        { source: code, sourceRoute: '8?tab=deposits', sourceManaged: true },
      );
      deposits.push({
        code,
        order: order.code,
        party: order.party,
        amount,
        day,
        cash,
        ref: data.get('ref'),
        events: [],
      });
      records.pay.push({
        code,
        day: isoDate(day),
        party: order.party,
        amount,
        state: 'Đã ghi sổ',
        type: 'Thu đặt cọc',
        cash,
        ref: data.get('ref'),
        lines: [],
        deposit: true,
        special: 'deposit',
        source: order.code,
        sourceRoute: saleUrl('order', order.code),
      });
      touchClosing(day);
      say('Đã ghi nhận cọc.');
      return '';
    },
    'Ghi thu đặt cọc',
  );
}
function disposeDeposit(deposit) {
  if (!deposit || depositBalance(deposit) <= 0) return;
  return openModal(
    'Xử lý cọc · ' + deposit.code,
    grid(
      field('Ngày thanh toán', 'day', sampleDate, 'date'),
      select('Xử lý', 'type', tenantOnly() ? ['Trả cọc', 'Giữ cọc theo thỏa thuận'] : ['Trả cọc']),
      field('Mã giao dịch hoàn tiền', 'ref'),
    ) + textArea('Căn cứ xử lý', 'reason'),
    (data) => {
      const day = data.get('day'),
        amount = depositBalance(deposit),
        type = data.get('type');
      const error = postingDateError(day);
      if (error) return error;
      if (
        day < deposit.day ||
        !amount ||
        !String(data.get('reason') || '').trim() ||
        !['Trả cọc', 'Giữ cọc theo thỏa thuận'].includes(type)
      )
        return 'Nhập căn cứ và ngày hợp lệ.';
      if (type === 'Giữ cọc theo thỏa thuận' && !tenantOnly()) return 'Quản trị tenant duyệt giữ cọc.';
      if (type === 'Trả cọc' && deposit.cash === '1121' && !String(data.get('ref') || '').trim())
        return 'Nhập mã hoàn tiền ngân hàng.';
      const lines = [
        debitLine('131', amount, deposit.party),
        creditLine(type === 'Trả cọc' ? deposit.cash : '711', amount, deposit.order),
      ];
      const cashError = cashProjection(lines, day).error;
      if (cashError) return cashError;
      const paymentCode = 'PC-COC-' + deposit.code.slice(7) + '-' + (deposit.events.length + 1);
      const code =
        type === 'Trả cọc' ? 'JV-' + paymentCode : 'JV-' + deposit.code + '-' + (deposit.events.length + 1);
      writeJournal(code, isoDate(day), type + ' · ' + deposit.order, lines, {
        source: deposit.code,
        sourceRoute: '8?tab=deposits',
        sourceManaged: true,
        log: String(data.get('reason')).trim(),
      });
      if (type === 'Trả cọc')
        records.pay.push({
          code: paymentCode,
          day: isoDate(day),
          party: deposit.party,
          amount,
          state: 'Đã ghi sổ',
          type: 'Chi trả cọc',
          cash: deposit.cash,
          ref: data.get('ref'),
          lines: [],
          deposit: true,
          special: 'deposit',
          source: deposit.order,
          sourceRoute: saleUrl('order', deposit.order),
        });
      deposit.events.push({ type, day, amount, code });
      touchClosing(day);
      say('Đã xử lý số cọc còn giữ.');
      return '';
    },
    'Ghi xử lý cọc',
  );
}
const invoiceDeposits = (x) =>
  deposits.filter(
    (d) => d.order === salesDeliveries.find((row) => row.code === x.source)?.source && depositBalance(d) > 0,
  );
function applyDeposit(invoice) {
  if (!invoice) return;
  const candidates = invoiceDeposits(invoice);
  if (!invoice || invoice.state !== 'Đã ghi sổ' || !remaining(invoice) || !candidates.length) return;
  return openModal(
    'Cấn trừ đặt cọc · ' + invoice.code,
    grid(
      optionsField(
        'Phiếu cọc',
        'deposit',
        candidates.map((x) => [x.code, x.code + ' · ' + money(depositBalance(x))]),
      ),
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      field('Số tiền (đ)', 'amount', '', 'number'),
    ) + note('Tiền cọc và công nợ hóa đơn cùng theo dõi trên TK 131. Thao tác ghi phân bổ vào hóa đơn.'),
    (data) => {
      const d = candidates.find((x) => x.code === data.get('deposit')),
        day = data.get('day'),
        amount = Number(data.get('amount'));
      const error = postingDateError(day);
      if (error) return error;
      if (
        !d ||
        invoice.state !== 'Đã ghi sổ' ||
        day < d.day ||
        day < dayKey(invoice.post || invoice.day) ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > remaining(invoice) ||
        amount > depositBalance(d)
      )
        return 'Vượt số cọc hoặc số còn phải thu, hoặc sai ngày phân bổ.';
      d.events.push({ type: 'Cấn trừ', day, amount, invoice: invoice.code });
      invoice.paid += amount;
      touchClosing(day);
      say('Đã cấn trừ tiền cọc.');
      return '';
    },
    'Cấn trừ TK 131',
  );
}

function pickDeposit() {
  const choices = salesOrders.filter((x) => x.state === 'Đã xác nhận');
  return openModal(
    'Đặt cọc theo đơn',
    optionsField(
      'Đơn bán',
      'order',
      choices.map((x) => [x.code, x.code + ' · ' + x.party]),
    ),
    (data) => {
      const order = choices.find((x) => x.code === data.get('order'));
      if (!order) return 'Chọn đơn bán đã xác nhận.';
      setTimeout(() => receiveDeposit(order), 0);
      return '';
    },
    'Tiếp tục',
  );
}
