function entryRows() {
  return [...document.querySelectorAll('#editRows tr')].map((row) =>
    [...row.querySelectorAll('input,select')].map((x) =>
      x.hasAttribute('data-money') ? moneyRaw(x.value) : x.value,
    ),
  );
}
const sum = (rows, i) => rows.reduce((n, r) => n + (Number(r[i]) || 0), 0);
function calculate(kind, rows) {
  if (kind === 'journal' || kind === 'opening') return { amount: sum(rows, 2), credit: sum(rows, 3) };
  if (kind === 'pay')
    return { amount: Number(moneyRaw($('entryForm').elements.amount.value)) || 0, allocated: sum(rows, 2) };
  const base = rows.reduce((n, r) => n + Math.round((+r[2] || 0) * (+r[3] || 0)), 0);
  const tax = rows.reduce((n, r) => n + Math.round(((+r[2] || 0) * (+r[3] || 0) * (+r[4] || 0)) / 100), 0);
  return { amount: base + tax, base, tax };
}
function updateCalc() {
  if (!$('calc')) return;
  const kind = $('editRows').dataset.kind;
  const { amount, credit, allocated, base, tax } = calculate(kind, entryRows());
  $('calc').textContent =
    credit !== undefined
      ? 'Nợ ' + money(amount) + ' · Có ' + money(credit)
      : allocated !== undefined
        ? 'Đã phân bổ ' + money(allocated) + ' · Còn lại ' + money(amount - allocated)
        : 'Trước thuế ' + money(base) + ' · Thuế ' + money(tax) + ' · Tổng ' + money(amount);
}
function saveEntry() {
  const form = $('entryForm'),
    kind = form.dataset.kind;
  const invalid = validateFormDates(form);
  if (invalid) {
    invalid.reportValidity();
    return;
  }
  const data = formData(form),
    rows = entryRows();
  const prior = editingEntry;
  if (prior && (prior.state !== 'Nháp' || !records[kind]?.includes(prior))) return;
  const { amount, credit, allocated } = calculate(kind, rows);
  const err = (m) => openModal('Kiểm tra dữ liệu', note(esc(m)), () => '', 'Đóng');
  if (!data) return err('Ngày chưa hợp lệ. Nhập theo dd/mm/yyyy.');
  const dateError =
    futureDateError(data.get('day')) ||
    futureDateError(data.get('post')) ||
    lockedDateError(data.get('post') || data.get('day'));
  if (dateError) return err(dateError);
  if ([...document.querySelectorAll('#editRows input[type=number]')].some((x) => Number(x.value) < 0))
    return err('Số liệu theo dòng phải lớn hơn hoặc bằng 0.');
  if (!amount) return err('Nhập số tiền lớn hơn 0.');
  if (kind === 'opening' && amount !== credit)
    return err(
      'Tổng Nợ và tổng Có đang lệch ' +
        money(Math.abs(amount - credit)) +
        '. Đối chiếu số dư gốc trước khi xác nhận.',
    );
  if (
    credit !== undefined &&
    (amount !== credit || rows.some((r) => !r[0] || Number(r[2]) > 0 === Number(r[3]) > 0))
  )
    return err('Chọn tài khoản cho từng dòng, nhập Nợ hoặc Có và kiểm tra hai tổng cân nhau.');
  if (
    allocated !== undefined &&
    (allocated > amount || rows.some((r) => +r[2] > (+r[1] || 0) || (Number(r[2]) > 0 && !r[0])))
  )
    return err(
      'Kiểm tra hóa đơn và số tiền phân bổ. Số phân bổ không được vượt số còn nợ hoặc số tiền thanh toán.',
    );
  if (['sale', 'buy'].includes(kind) && rows.some((r) => !r[0].trim() || +r[2] <= 0))
    return err('Nhập tên và số lượng hợp lệ cho từng dòng hóa đơn.');
  if (!data.get('day') || (kind !== 'opening' && !String(data.get('party')).trim()))
    return err('Nhập ngày và ' + (kind === 'journal' ? 'diễn giải.' : 'đối tác.'));
  if (['journal', 'opening'].includes(kind)) {
    for (const row of rows) {
      row[0] = accounts.find((account) => accountCode(account) === accountCode(row[0])) || row[0];
      if (kind === 'journal') {
        const key = partyType(accountCode(row[0]));
        if (key) row[1] = catalogMatch(key, row[1])?.code || row[1];
      }
    }
    const error = accountSelectError(rows, kind === 'opening');
    if (error) return err(error);
  }
  if (['buy', 'sale'].includes(kind)) {
    const error = invoiceSourceError(
      kind,
      {
        source: data.get('source'),
        party: data.get('party'),
        day: data.get('day'),
        post: data.get('post'),
        vatReason: data.get('vatReason'),
        lines: rows,
      },
      prior,
    );
    if (error) return err(error);
  }
  if (kind === 'pay') {
    const model = {
      type: data.get('type'),
      party: data.get('party'),
      day: data.get('day'),
      amount,
      lines: rows,
      cash: data.get('cash'),
      ref: data.get('ref'),
    };
    if (prior && model.type !== prior.type) return err('Loại phiếu đã gắn với sổ số PT hoặc PC.');
    const selected = rows.filter((row) => row[0]).map((row) => row[0]);
    if (new Set(selected).size !== selected.length)
      return err('Mỗi hóa đơn chỉ được chọn một lần trên phiếu.');
    const pending = selected.map((code) => draftForInvoice(code, prior)).find(Boolean);
    if (pending)
      return err('Hóa đơn đã có phiếu nháp ' + pending.code + '. Mở phiếu đó trong danh sách Thanh toán.');
    const allocation = paymentAllocation(model);
    if (allocation.error) return err(allocation.error);
    for (const row of rows)
      if (row[0])
        row[1] = remaining(
          records[model.type === 'Chi tiền' ? 'buy' : 'sale'].find((x) => x.code === row[0]),
        );
  }
  if (kind === 'opening') {
    const day = data.get('day');
    if (day > todayKey()) return err('Ngày đầu kỳ ở tương lai.');
    if (day !== (savedOpening?.day || configuredOpeningDay()))
      return err('Ngày số dư đầu kỳ phải khớp với kỳ khởi tạo.');
    if (savedOpening && savedOpening.day !== day)
      return err('Ngày đầu kỳ đã được xác nhận. Bạn có thể sửa số tiền của kỳ đã chọn khi kỳ còn mở.');
    if (
      Object.keys(closePeriods).some(
        (period) =>
          monthKey(period) >= monthKey(postingPeriod(day)) && periodLocked(dayKey(closePeriods[period].from)),
      )
    )
      return err('Số dư thay đổi sẽ ảnh hưởng kỳ đã khóa.');
    const balances = {};
    for (const [account, , debit, credit] of rows) {
      const code = accountCode(account);
      balances[code] = (balances[code] || 0) + (Number(debit) || 0) - (Number(credit) || 0);
    }
    const result = cashProjection([], day, { day, balances, rows });
    if (result.error) return err(result.error);
    return ask(
      'Xác nhận số dư đầu kỳ',
      note('Tổng Nợ và Có đều bằng ' + money(amount) + '. Số dư sẽ được dùng từ ' + isoDate(day) + '.'),
      () => {
        savedOpening = { day, balances, rows };
        stage.opening = true;
        touchClosing(day);
        say('Đã cập nhật số dư đầu kỳ vào sổ và báo cáo.');
      },
    );
  }
  const prefix = {
    journal: 'JV',
    pay: data.get('type') === 'Chi tiền' ? 'PC' : 'PT',
    sale: 'SINV',
    buy: 'PINV',
  }[kind];
  const changes = {
    day: isoDate(data.get('day')),
    due: data.get('due') || undefined,
    post: data.get('post') || data.get('day'),
    ref: data.get('ref'),
    cash: data.get('cash'),
    party: escToText(data.get('party')),
    source: data.get('source'),
    vatReason: String(data.get('vatReason') || '').trim(),
    symbol: data.get('symbol'),
    type: data.get('type'),
    amount,
    lines: rows,
    log: prior ? 'Đã sửa và lưu lại bản nháp.' : 'Đã lưu nháp từ form.',
  };
  if (prior) {
    Object.assign(prior, changes);
    editingEntry = null;
    activeRecord = { ...prior, kind };
    route(targets[kind] + '?code=' + encodeURIComponent(prior.code));
    return;
  }
  const x = {
    ...changes,
    kind,
    code:
      prefix +
      '-' +
      dayKey(changes.day).slice(0, 4) +
      '-' +
      String(
        100 +
          records[kind].filter((x) => x.code.startsWith(prefix + '-' + dayKey(changes.day).slice(0, 4) + '-'))
            .length,
      ).padStart(5, '0'),
    state: 'Nháp',
    einv: 'Chờ phát hành',
    paid: 0,
  };
  records[kind].push(x);
  activeRecord = x;
  if (['pay', 'buy', 'sale'].includes(kind))
    return route(targets[kind] + '?code=' + encodeURIComponent(x.code));
  if (Number(page) === targets[kind]) render();
  else route(targets[kind]);
}
function escToText(value) {
  return String(value ?? '').trim();
}
function invoiceSourceError(kind, x, except) {
  const buy = kind === 'buy';
  const source = (buy ? receipts : salesDeliveries).find(
    (row) => row.code === x.source && row.state === 'Đã ghi sổ',
  );
  const key = buy ? 'suppliers' : 'customers';
  if (!source) return 'Chọn ' + (buy ? 'phiếu nhập kho' : 'phiếu giao hàng') + ' đã ghi sổ.';
  if (!buy && source.requiresAcceptance && !source.accepted) return 'Phiếu giao chưa nghiệm thu.';
  if (!buy && source.accepted) {
    const invoiceDay = dayKey(x.day),
      postingDay = dayKey(x.post || x.day);
    if (invoiceDay < source.accepted || postingDay < source.accepted)
      return 'Ngày hóa đơn và hạch toán phải từ ngày nghiệm thu.';
    if ([invoiceDay, postingDay].some((day) => postingPeriod(day) !== postingPeriod(source.accepted)))
      return 'Ngày hóa đơn hoặc hạch toán khác kỳ nghiệm thu. Kiểm tra hồ sơ trước khi ghi sổ.';
  }
  if (!catalogMatch(key, x.party) || x.party !== source.party)
    return 'Đối tác phải có trong danh mục và khớp chứng từ nguồn.';
  if ((buy ? billedReceipt : billedDelivery)(source.code, except)) return 'Chứng từ nguồn đã có hóa đơn.';
  if (dayKey(x.post || x.day) < dayKey(source.day))
    return 'Ngày hạch toán không được trước ngày chứng từ kho.';
  const rows = x.lines || rowDefinitions[kind].values;
  const expected = buy
    ? receiptLines(source)
    : deliveryLines(source).map((line) => ({
        ...line,
        item: productFor(line).name,
        uom: productFor(line).extra || 'Cái',
        rate: productFor(line).rate || '10',
      }));
  if (rows.length !== expected.length) return 'Số dòng hàng phải khớp phiếu kho.';
  for (const [index, [name, unit, quantity, price, rate]] of rows.entries()) {
    const line = expected[index];
    if (
      name !== line.item ||
      unit !== (line.uom || 'Tấm') ||
      Number(quantity) !== line.qty ||
      !Number.isSafeInteger(Number(price)) ||
      Number(price) <= 0 ||
      (!buy && Number(price) !== line.price)
    )
      return 'Dòng hàng phải khớp phiếu kho. Chỉ hóa đơn mua được sửa đơn giá thực tế.';
    if (!vatRates.some(([value]) => value === String(rate))) return 'Chọn thuế suất từ danh sách.';
    if (
      buy &&
      invoiceReceiptVariance(line, x, index) &&
      productionIssues.some(
        (row) => row.item === catalogMatch('items', line.item)?.code && row.day >= dayKey(source.day),
      )
    )
      return 'Vật tư của mã này đã xuất sản xuất. Cần phân bổ lại chênh lệch trước khi ghi hóa đơn mua.';
    if (!buy && String(rate) !== line.rate && !tenantOnly())
      return 'Chỉ Quản trị tenant được đổi thuế suất mặc định.';
    if (!buy && String(rate) !== line.rate && !String(x.vatReason || '').trim())
      return 'Nhập lý do thay đổi thuế suất mặc định.';
  }
  if (
    !buy &&
    !linkedJournal(source.code).some(
      (entry) =>
        entry.state === 'Đã ghi sổ' &&
        entry.lines.some((row) => accountCode(row[0]) === '632' && Number(row[2]) > 0),
    )
  )
    return 'Phiếu giao chưa có bút toán giá vốn. Kiểm tra hạch toán phiếu giao.';
  return '';
}
function paymentAllocation(x, op = 'post') {
  const kind = x.type === 'Chi tiền' ? 'buy' : 'sale';
  const key = kind === 'buy' ? 'suppliers' : 'customers';
  const party = catalogMatch(key, x.party);
  if (!party) return { error: 'Chọn đối tác từ danh mục.' };
  if (
    !['Chi tiền', 'Thu tiền'].includes(x.type) ||
    !/^11[12]/.test(accountCode(x.cash || '')) ||
    !accounts.includes(x.cash) ||
    !Number.isSafeInteger(x.amount) ||
    x.amount <= 0
  )
    return { error: 'Kiểm tra loại phiếu, tài khoản tiền và số tiền.' };
  if (op === 'post' && accountCode(x.cash).startsWith('112') && !String(x.ref || '').trim())
    return { error: 'Nhập mã giao dịch ngân hàng cho phiếu qua TK 112.' };
  const changed = new Map();
  for (const [code, , part] of x.lines || []) {
    if (!code && !Number(part)) continue;
    const invoice = records[kind].find(
      (y) => y.code === code && y.state === 'Đã ghi sổ' && catalogMatch(key, y.party) === party,
    );
    const value = Number(part);
    if (!invoice || !Number.isSafeInteger(value) || value < 0)
      return { error: 'Chọn hóa đơn đã ghi sổ của đúng đối tác và nhập số phân bổ hợp lệ.' };

    changed.set(invoice, (changed.get(invoice) || 0) + value);
  }
  if (op === 'post' && [...changed].some(([invoice, value]) => value > remaining(invoice)))
    return { error: 'Số phân bổ vượt số còn nợ hiện tại.' };
  if ([...changed.values()].reduce((total, value) => total + value, 0) > x.amount)
    return { error: 'Tổng phân bổ vượt số tiền trên phiếu.' };
  return { changed };
}
function postingError(kind, x, op, lines) {
  if (op === 'cancel' && kind === 'buy') {
    if (x.special) return 'Xử lý tại chứng từ nguồn.';
    const source = receipts.find((row) => row.code === x.source);
    if (
      source &&
      receiptLines(source).some((line) =>
        productionIssues.some(
          (row) => row.item === catalogMatch('items', line.item)?.code && row.day >= dayKey(source.day),
        ),
      )
    )
      return 'Đã có xuất vật tư sau phiếu nhập.';
  }
  if (
    op === 'cancel' &&
    kind === 'journal' &&
    lines.some(
      ([acct, work, debit]) =>
        accountCode(acct).startsWith('154') && Number(debit) > 0 && workError(work, x.day),
    )
  )
    return 'Chi phí thuộc lệnh đã hoàn thành hoặc đã tính giá. Rà soát lại lệnh trước khi hủy.';
  const date = postingDateError(x.post || x.day);
  if (date) return date;
  if (!validDate(x.day) || dayKey(x.day) > todayKey()) return 'Ngày chứng từ chưa hợp lệ hoặc ở tương lai.';
  if (op === 'post') {
    if (kind === 'journal') {
      const error = accountSelectError(lines, Boolean(x.profile || x.caseAdjustment));
      if (error) return error;
      const workIssue = lines.find(
        ([acct, work, debit]) =>
          accountCode(acct).startsWith('154') && Number(debit) > 0 && workError(work, x.post || x.day),
      );
      if (workIssue) return workError(workIssue[1], x.post || x.day);
    }
    if (['buy', 'sale'].includes(kind)) {
      const error = invoiceSourceError(kind, x, x);
      if (error) return error;
    }
    if (
      !lines.length ||
      lines.some(
        ([, , d, c]) =>
          ![Number(d), Number(c)].every((v) => Number.isSafeInteger(v) && v >= 0) ||
          Number(d) > 0 === Number(c) > 0,
      ) ||
      sum(lines, 2) !== sum(lines, 3) ||
      sum(lines, 2) <= 0
    )
      return 'Dòng hạch toán phải hợp lệ và tổng Nợ bằng tổng Có.';
  }
  const changes = op === 'post' ? lines : lines.map(([code, party, d, c]) => [code, party, c, d]);
  return cashProjection(changes, x.post || x.day).error;
}
const paymentHref = (kind, code) => '6?' + new URLSearchParams({ invoice: code, side: kind });
function draftForInvoice(code, except) {
  return records.pay.find(
    (pay) =>
      pay !== except &&
      pay.state === 'Nháp' &&
      (pay.lines || []).some(([invoice, , value]) => invoice === code && Number(value) > 0),
  );
}
function startInvoicePayment(kind, code) {
  if (!['buy', 'sale'].includes(kind) || !openDebt(kind).some((row) => row.code === code)) return;
  const draft = draftForInvoice(code);
  route(draft ? '7?code=' + encodeURIComponent(draft.code) : paymentHref(kind, code));
}
function invoicePaymentButton(kind, invoice) {
  if (invoice.state !== 'Đã ghi sổ') return '';
  if (!remaining(invoice)) return pill('Đã thanh toán đủ', 'good');
  const draft = draftForInvoice(invoice.code),
    label = kind === 'buy' ? 'phiếu chi' : 'phiếu thu';
  return b(
    'payref-' + kind + '-' + invoice.code,
    draft ? 'Mở ' + label + ' nháp' : 'Lập ' + label,
    'primary',
  );
}
function relatedPayments(invoice) {
  const payments = records.pay.filter(
    (pay) =>
      pay.state !== 'Đã hủy' &&
      (pay.lines || []).some(([code, , amount]) => code === invoice.code && Number(amount) > 0),
  );
  return payments.length
    ? table(
        ['Số phiếu', 'Ngày', 'Đã phân bổ', 'Trạng thái'],
        payments.map((pay) => [
          recordLink('pay', pay.code),
          esc(pay.day),
          money(
            pay.lines
              .filter(([code]) => code === invoice.code)
              .reduce((total, row) => total + Number(row[2]), 0),
          ),
          pill(pay.state, pay.state === 'Đã ghi sổ' ? 'good' : ''),
        ]),
        [2],
      )
    : '<p class="empty">Chưa có phiếu thu hoặc phiếu chi phân bổ cho hóa đơn này.</p>';
}
