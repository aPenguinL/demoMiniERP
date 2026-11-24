function purchaseSpecial(mode) {
  const service = mode === 'service';
  return openModal(
    service ? 'Hóa đơn gia công ngoài' : 'Mua vật tư không hóa đơn',
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      service
        ? payPartyField('suppliers', '')
        : optionsField(
            'Hộ / cá nhân bán',
            'party',
            catalogSpec.suppliers.rows
              .filter((x) => x.sellerType === 'Hộ / cá nhân')
              .map((x) => [x.name, x.code + ' · ' + x.name]),
          ),
      ...(service
        ? [
            workField(),
            field('Tên dịch vụ', 'description'),
            field('Số hóa đơn nhà cung cấp', 'invoice'),
            optionsField('Thuế GTGT', 'rate', vatRates, '10'),
          ]
        : [
            itemField('Vật tư', 'item', materialGroup),
            warehouseField('Kho nhập', 'warehouse', materialGroup, null, null, 'item'),
            field('Số lượng theo ĐVT cơ sở', 'qty', '', 'number'),
            field('Địa chỉ người bán', 'address'),
            field('MST / Số định danh người bán', 'identity'),
            field('Căn cứ thuộc diện lập bảng kê', 'basis'),
            field('Số bảng kê lâm sản', 'woodNumber'),
            field('Tệp hồ sơ nguồn gốc gỗ', 'woodFile', '', 'file'),
          ]),
      field(service ? 'Giá chưa thuế (đ)' : 'Đơn giá (đ)', 'price', '', 'number'),
    ) + (service ? '' : '<p id="wood-purchase-warning" class="field-error" role="status"></p>'),
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day);
      if (error) return error;
      const party = data.get('party'),
        vendor = catalogMatch('suppliers', party),
        price = Number(data.get('price'));
      if (!vendor || !Number.isSafeInteger(price) || price <= 0)
        return 'Chọn người bán và nhập đơn giá hợp lệ.';
      if (service) {
        const work = data.get('work'),
          workIssue = workError(work, day);
        if (workIssue) return workIssue;
        const description = String(data.get('description') || '').trim(),
          ref = String(data.get('invoice') || '').trim(),
          rate = data.get('rate');
        if (
          !description ||
          !ref ||
          !vatRates.some(([x]) => x === rate) ||
          records.buy.some((x) => x.party === party && x.ref === ref && x.state !== 'Đã hủy')
        )
          return 'Kiểm tra dịch vụ, số hóa đơn chưa dùng và thuế suất.';
        const code = 'GC-' + String(records.buy.length + 1).padStart(4, '0'),
          tax = Math.round((price * (Number(rate) || 0)) / 100);
        const lines = [
          debitLine('154', price, work),
          ...(tax ? [debitLine('1331', tax, code)] : []),
          creditLine(configuredAccount('payable'), price + tax, party),
        ];
        records.buy.push({
          code,
          kind: 'buy',
          party,
          day: isoDate(day),
          post: day,
          source: work,
          special: 'service',
          ref,
          state: 'Đã ghi sổ',
          review: tenantOnly() ? 'Đã duyệt' : 'Chờ duyệt',
          createdBy: roleLabels[demoRole],
          amount: price + tax,
          paid: 0,
          lines: [[description, 'Dịch vụ', 1, price, rate]],
        });
        writeJournal('JV-' + code, isoDate(day), 'Gia công ngoài ' + work, lines, {
          source: code,
          sourceRoute: purchaseHref(code),
          sourceManaged: true,
        });
      } else {
        if (vendor.sellerType !== 'Hộ / cá nhân') return 'Chọn hộ hoặc cá nhân từ danh mục người bán.';
        const item = itemBy(data.get('item')),
          qty = Number(data.get('qty'));
        const address = String(data.get('address') || '').trim(),
          identity = String(data.get('identity') || '').trim(),
          basis = String(data.get('basis') || '').trim();
        if (
          item?.group !== materialGroup ||
          !Number.isFinite(qty) ||
          qty <= 0 ||
          Number(qty.toFixed(6)) !== qty ||
          !address ||
          !identity ||
          !basis
        )
          return 'Điền vật tư, số lượng và đủ thông tin người bán, căn cứ lập bảng kê.';
        const warehouse = warehouseFor(data, 'warehouse', item);
        if (!warehouse) return 'Chọn kho nguyên liệu đang sử dụng.';
        if (stockOutAfter(item.code, day)) return 'Mã vật tư đã phát sinh xuất sau ngày này.';
        const amount = Math.round(qty * price);
        if (!Number.isSafeInteger(amount) || amount <= 0) return 'Thành tiền không hợp lệ.';
        const code = 'KHĐ-' + String(records.buy.length + 1).padStart(4, '0');
        const number = String(data.get('woodNumber') || '').trim(),
          selectedFile = data.get('woodFile');
        const origin = { number, file: selectedFile?.name ? selectedFile : null };
        receipts.push({
          code,
          party,
          day: isoDate(day),
          state: 'Đã ghi sổ',
          item: item.name,
          uom: item.extra,
          qty,
          price,
          warehouse: warehouse.code,
          special: 'noinvoice',
          origin,
        });
        records.buy.push({
          code,
          kind: 'buy',
          party,
          day: isoDate(day),
          post: day,
          source: code,
          state: 'Đã ghi sổ',
          special: 'noinvoice',
          review: tenantOnly() ? 'Đã duyệt' : 'Chờ duyệt',
          createdBy: roleLabels[demoRole],
          amount,
          paid: 0,
          lines: [[item.name, item.extra, qty, price, 'kkk']],
          seller: { address, identity, basis },
        });
        writeJournal(
          'JV-' + code,
          isoDate(day),
          'Mua vật tư không hóa đơn',
          [
            debitLine(stockAccount(materialGroup), amount, item.code),
            creditLine(configuredAccount('payable'), amount, party),
          ],
          { source: code, sourceRoute: purchaseHref(code), sourceManaged: true },
        );
      }
      touchClosing(day);
      const last = receipts.at(-1);
      say(
        !service && woodWarning(last)
          ? 'Đã ghi sổ. Gỗ mua thiếu số bảng kê lâm sản hoặc tệp nguồn gốc. Kiểm tra tại phiếu nhập và cuối kỳ.'
          : 'Đã ghi sổ chứng từ mua.',
      );
      return '';
    },
    'Ghi sổ',
  );
}
$('dialogForm').addEventListener('change', () => {
  const form = $('dialogForm'),
    work = $('wage-direct-work');
  if (work) {
    const employee = employees.find((x) => x.code === form.elements.employee?.value);
    work.hidden = employee?.kind !== 'Thợ trực tiếp';
    $('wage-cost-destination').textContent =
      employee?.kind === 'Quản lý xưởng'
        ? commonLabel
        : employee?.kind === 'Văn phòng'
          ? 'Chi phí văn phòng vào TK 6422.'
          : employee?.kind === 'Bán hàng / giao lắp'
            ? 'Chi phí bán hàng / giao lắp vào TK 6421.'
            : '';
  }
  const warning = $('wood-purchase-warning');
  if (!warning) return;
  const item = itemBy(form.elements.namedItem('item')?.value);
  const missing = !form.elements.woodNumber?.value?.trim() || !form.elements.woodFile?.files?.length;
  warning.textContent =
    item?.wood && missing
      ? 'Vật tư gỗ cần số bảng kê lâm sản và tệp hồ sơ nguồn gốc. Thiếu hồ sơ sẽ được nhắc khi chốt sổ.'
      : '';
});
function sellerDayTotal(invoice) {
  return records.buy
    .filter(
      (x) =>
        x.special === 'noinvoice' &&
        x.state === 'Đã ghi sổ' &&
        dayKey(x.day) === dayKey(invoice.day) &&
        (x.seller.identity === invoice.seller.identity ||
          catalogMatch('suppliers', x.party)?.code === catalogMatch('suppliers', invoice.party)?.code),
    )
    .reduce((n, x) => n + x.amount, 0);
}
function cashTaxWarning(payment) {
  if (payment.type !== 'Chi tiền' || !accountCode(payment.cash).startsWith('111')) return '';
  const allocated = records.buy.filter(
    (x) =>
      x.state === 'Đã ghi sổ' && (payment.lines || []).some((row) => row[0] === x.code && Number(row[2]) > 0),
  );
  const noInvoice = allocated.filter((x) => x.special === 'noinvoice' && sellerDayTotal(x) >= 5000000);
  const vatInvoice = allocated.filter((x) => x.special !== 'noinvoice' && x.amount >= 5000000);
  const notes = [];
  if (noInvoice.length)
    notes.push(
      'Chi phí có thể không được trừ: tổng mua trong ngày của cùng hộ / cá nhân từ 5 triệu đồng và phiếu này chi bằng tiền mặt.',
    );
  if (vatInvoice.length)
    notes.push(
      'Hóa đơn ' +
        vatInvoice.map((x) => x.code).join(', ') +
        ' từ 5 triệu đồng trả bằng tiền mặt: chi phí có thể không được trừ và thuế GTGT đầu vào có thể không được khấu trừ.',
    );
  return notes.join(' ');
}
function paymentMethods(invoice) {
  const methods = new Set();
  for (const payment of records.pay)
    if (
      payment.state === 'Đã ghi sổ' &&
      (payment.lines || []).some(([code, , value]) => code === invoice.code && Number(value) > 0)
    )
      methods.add(accountCode(payment.cash).startsWith('111') ? 'Tiền mặt' : 'Không dùng tiền mặt');
  const list = [...methods];
  if (remaining(invoice) > 0) list.push(invoice.paid ? 'Còn phải trả' : 'Chưa thanh toán');
  return list.join(' · ') || '—';
}
function noInvoiceView() {
  const entries = records.buy.filter((x) => x.special === 'noinvoice' && x.state === 'Đã ghi sổ');
  const { rows, toolbar } = searchList(
    'no-invoice',
    entries,
    'Tìm chứng từ, người bán hoặc tên hàng',
    (x) => [x.code, x.party, x.seller.identity, x.lines[0][0]],
    [
      [
        'period',
        'Tất cả kỳ',
        columnChoices(entries.map((x) => postingPeriod(x.day))),
        (x) => postingPeriod(x.day),
      ],
      [
        'origin',
        'Tất cả hồ sơ gỗ',
        [
          ['missing', 'Thiếu hồ sơ'],
          ['ok', 'Không thiếu hồ sơ'],
        ],
        (x) => (woodWarning(receipts.find((r) => r.code === x.source)) ? 'missing' : 'ok'),
      ],
    ],
  );
  return pad(
    'Bảng kê mua không có hóa đơn · đối chiếu 02/TNDN',
    b('buy-noinvoice', 'Ghi nhận mua không hóa đơn', 'primary') +
      toolbar +
      table(
        [
          'Ngày',
          'Chứng từ',
          'Duyệt',
          'Người bán',
          'Địa chỉ',
          'MST / Số định danh',
          'Hàng',
          'ĐVT',
          'SL',
          'Đơn giá',
          'Căn cứ lập bảng kê',
          'Thành tiền',
          'Hình thức thanh toán',
          'Hồ sơ gỗ',
        ],
        rows.map((x) => [
          x.day,
          recordLink('buy', x.code),
          x.review === 'Chờ duyệt'
            ? tenantOnly()
              ? b('special-review|' + x.code, 'Duyệt', 'link')
              : pill('Chờ duyệt', 'attn')
            : pill('Đã duyệt', 'good'),
          esc(x.party),
          esc(x.seller.address),
          esc(x.seller.identity),
          esc(x.lines[0][0]),
          esc(x.lines[0][1]),
          x.lines[0][2],
          money(x.lines[0][3]),
          esc(x.seller.basis),
          money(x.amount),
          esc(paymentMethods(x)) +
            (sellerDayTotal(x) >= 5000000 && paymentMethods(x).includes('Tiền mặt')
              ? ' ' + pill('Rủi ro chi phí được trừ', 'attn')
              : ''),
          woodWarning(receipts.find((r) => r.code === x.source)) ? pill('Thiếu hồ sơ', 'attn') : '—',
        ]),
        [8, 9, 11],
      ) +
      note(
        'Bảng kê được tổng hợp từ chứng từ đã ghi sổ. Kiểm tra căn cứ thuộc diện lập bảng kê và chứng từ thanh toán trước khi kê khai.',
      ),
  );
}
