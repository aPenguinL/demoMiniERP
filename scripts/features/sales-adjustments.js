const saleAdjustments = [];

const adjustmentAmount = (invoice, asOf = '9999-12-31') =>
  saleAdjustments
    .filter((x) => x.invoice === invoice && x.day <= asOf && x.state === 'Đã ghi sổ')
    .reduce((n, x) => n + x.base + x.tax, 0);
function salesAdjustment(invoice) {
  if (invoice?.state !== 'Đã ghi sổ' || !issued(invoice))
    return openModal(
      'Hóa đơn gốc chưa phát hành',
      note('Phát hành hóa đơn gốc trước khi lập hóa đơn điều chỉnh.'),
      () => '',
      'Đóng',
    );
  const delivery = salesDeliveries.find((x) => x.code === invoice.source);
  const invoiceRows = invoice.lines || rowDefinitions.sale.values;
  const shipped = deliveryLines(delivery);
  const selectLine =
    invoiceRows.length > 1
      ? optionsField(
          'Mặt hàng điều chỉnh',
          'adjustLine',
          invoiceRows.map(([name], index) => [String(index), name]),
          '0',
        )
      : '';

  return openModal(
    'Trả lại / giảm giá · ' + invoice.code,
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      ...(selectLine ? [selectLine] : []),
      select('Nghiệp vụ', 'type', ['Trả lại hàng', 'Giảm giá']),
      field('Số lượng trả (nếu có)', 'qty', '', 'number'),
      field('Giảm giá chưa thuế (đ)', 'amount', '', 'number'),
      warehouseField(
        'Kho nhận',
        'warehouse',
        finishedGroup,
        delivery && productFor(delivery),
        delivery?.warehouse || seedWarehouses[finishedGroup],
      ),
    ) + textArea('Lý do', 'reason'),
    (data) => {
      const day = data.get('day'),
        err = postingDateError(day);
      if (err) return err;
      const reason = String(data.get('reason') || '').trim(),
        isReturn = data.get('type') === 'Trả lại hàng';
      const index = invoiceRows.length > 1 ? Number(data.get('adjustLine') || 0) : 0;
      if (!invoiceRows[index]) return 'Chọn mặt hàng điều chỉnh.';
      const [, , originalQty, price, rate] = invoiceRows[index];
      const product = shipped[index] ? productFor(shipped[index]).code : null;
      const usedQty = saleAdjustments
        .filter((x) => x.invoice === invoice.code && (x.product === product || (!x.product && index === 0)))
        .reduce((sum, row) => sum + row.qty, 0);
      const qty = isReturn ? Number(data.get('qty')) : 0,
        base = isReturn ? qty * price : Number(data.get('amount')),
        tax = Math.round((base * (Number(rate) || 0)) / 100);
      const previous = saleAdjustments.filter((x) => x.invoice === invoice.code);
      const original = invoiceTax(invoice, 'sale');
      if (
        day < dayKey(invoice.post || invoice.day) ||
        !reason ||
        !Number.isSafeInteger(base) ||
        base <= 0 ||
        previous.reduce((n, x) => n + x.base, 0) + base > original.base ||
        previous.reduce((n, x) => n + x.tax, 0) + tax > original.tax
      )
        return 'Ngày, căn cứ và tổng tiền điều chỉnh phải phù hợp hóa đơn gốc.';
      if (
        isReturn &&
        (!product || !Number.isSafeInteger(qty) || qty <= 0 || qty + usedQty > Number(originalQty))
      )
        return 'Số lượng trả vượt lượng đã giao.';
      const warehouse = isReturn ? warehouseFor(data, 'warehouse', itemBy(product)) : null;
      if (isReturn && !warehouse) return 'Chọn kho thành phẩm đang sử dụng.';
      const code = 'DC-HD-' + String(saleAdjustments.length + 1).padStart(4, '0');
      saleAdjustments.push({
        code,
        invoice: invoice.code,
        party: invoice.party,
        day,
        base,
        tax,
        qty,
        product,
        warehouse: warehouse?.code,
        rate: String(rate),
        reason,
        state: 'Chờ phát hành',
      });
      touchClosing(day);
      route('27?type=adjustment');
      return '';
    },
    'Lập HĐĐT điều chỉnh',
  );
}
function postAdjustment(row) {
  if (!row || row.state !== 'Chờ phát hành') return;
  return openModal(
    'Phát hành HĐĐT điều chỉnh · ' + row.code,
    meta([
      ['Hóa đơn gốc', row.invoice],
      ['Giá trị điều chỉnh', money(row.base + row.tax)],
    ]) + select('Phản hồi mô phỏng', 'outcome', ['Thành công', 'Lỗi kết nối']),
    (data) => {
      const err = postingDateError(row.day) || customerTaxError(row.party);
      if (err) return err;
      if (data?.get('outcome') === 'Lỗi kết nối') {
        row.einv = 'Lỗi';
        say('Phát hành điều chỉnh lỗi. Có thể thử lại từ danh sách.');
        return '';
      }
      row.einv = 'Chờ phát hành';
      const invoice = records.sale.find((x) => x.code === row.invoice),
        delivery = salesDeliveries.find((x) => x.code === invoice.source);
      const item = row.product || (delivery && productFor(delivery).code);
      const deliveryLine = deliveryLines(delivery).find((line) => productFor(line).code === item);
      if (row.qty && (!deliveryLine || stockOutAfter(item, row.day)))
        return 'Có phiếu giao xuất sau ngày điều chỉnh. Kiểm tra thứ tự tính giá vốn.';
      const lines = [
        debitLine(
          postedCounterAccount(row.invoice, 'income', 'credit') || configuredAccount('income'),
          row.base,
          row.invoice,
        ),
        ...(row.tax ? [debitLine('33311', row.tax, row.invoice)] : []),
        creditLine(
          postedCounterAccount(row.invoice, 'receivable', 'debit') || configuredAccount('receivable'),
          row.base + row.tax,
          row.party,
        ),
      ];
      if (row.qty) {
        const earlier = stockReturns.filter((x) => x.delivery === delivery.code && x.item === item);
        const totalCost = deliveryLineCostAt(delivery, deliveryLine, row.day);
        const precedingQty = earlier.reduce((n, x) => n + x.qty, 0);
        const value =
          Math.round((totalCost * (precedingQty + row.qty)) / deliveryLine.qty) -
          Math.round((totalCost * precedingQty) / deliveryLine.qty);
        if (!validWarehouse(row.warehouse, finishedGroup))
          return 'Kho nhận không còn sử dụng. Chọn lại kho thành phẩm.';
        stockReturns.push({
          code: row.code,
          delivery: delivery.code,
          item,
          day: row.day,
          qty: row.qty,
          value,
          warehouse: row.warehouse,
          journalSequence: records.journal.length,
        });
        if (value)
          lines.push(debitLine(stockAccount(finishedGroup), value, item), creditLine('632', value, item));
      }
      writeJournal('JV-' + row.code, isoDate(row.day), 'Điều chỉnh hóa đơn ' + row.invoice, lines, {
        source: row.code,
        sourceRoute: 'sales-adjustments',
        sourceManaged: true,
      });
      row.state = 'Đã ghi sổ';
      row.einvoice = 'VNPT-MAU-' + row.code;
      touchClosing(row.day);
      say('Đã mô phỏng phát hành và ghi sổ.');
      return '';
    },
    'Mô phỏng phát hành và ghi sổ',
  );
}
function adjustmentsView() {
  return salesWorkspace('adjustment');
}
