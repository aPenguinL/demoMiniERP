const stockChecks = [],
  stockTransfers = [],
  kitMovements = [],
  materialReturns = [];

function checkStock() {
  return openModal(
    'Ghi phiếu kiểm kê',
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      optionsField('Kho', 'warehouse', warehouseOptions(), typeDefault(materialGroup)?.code).replace(
        '<select ',
        '<select data-count-warehouse="true" ',
      ),
      optionsField(
        'Mã hàng',
        'item',
        catalogSpec.items.rows
          .filter((x) => x.group === materialGroup)
          .map((x) => [x.code, x.code + ' · ' + x.name]),
      ),
      field('SL thực đếm · ĐVT cơ sở', 'qty', '', 'number'),
      ...(warehouseOnly() ? [] : [field('Giá đơn vị thừa (nếu tồn sổ bằng 0)', 'price', '', 'number')]),
    ) + textArea('Số biên bản / ghi chú', 'reason'),
    (data) => {
      const day = data.get('day'),
        err = postingDateError(day);
      if (err) return err;
      const item = itemBy(data.get('item')),
        qty = Number(data.get('qty')),
        reason = String(data.get('reason') || '').trim();
      if (
        !item ||
        !reason ||
        !data.get('qty') ||
        !Number.isFinite(qty) ||
        qty < 0 ||
        Number(qty.toFixed(6)) !== qty ||
        (item.group === finishedGroup && !Number.isSafeInteger(qty))
      )
        return 'Nhập mã, số thực đếm hợp lệ và biên bản.';
      if (stockOutAfter(item.code, day)) return 'Mã hàng có xuất sau ngày kiểm kê.';
      if (stockChecks.some((x) => !x.cancelled && x.item === item.code && !x.resolution))
        return 'Mã này còn phiếu kiểm kê chưa xử lý.';
      const warehouse = warehouseFor(data, 'warehouse', item)?.code;
      const book = inventoryByWarehouse(item.code, day).find((x) => x.warehouse.code === warehouse);
      if (!book) return 'Chọn kho từ danh mục.';
      const diff = Number((qty - book.qty).toFixed(6));
      if (!diff) return 'Số thực đếm khớp sổ, không phát sinh chênh lệch.';
      const total = inventory(item.code, day);
      const value = total.qty
        ? stockValueOut(total, Math.abs(diff))
        : Math.round(Number(data.get('price')) * diff);
      if (warehouseOnly() && !total.qty) return 'Cần Kế toán bổ sung căn cứ giá để ghi chênh lệch.';
      if (!Number.isSafeInteger(value) || value <= 0) return 'Nhập giá trị hợp lệ để ghi chênh lệch.';
      const code = 'KK-' + String(stockChecks.length + 1).padStart(4, '0'),
        acct = stockAccount(item.group);
      const lines =
        diff > 0
          ? [debitLine(acct, value, item.code), creditLine('3381', value, code)]
          : [debitLine('1381', value, code), creditLine(acct, value, item.code)];
      stockChecks.push({
        code,
        day,
        item: item.code,
        warehouse,
        qty: diff,
        value: diff > 0 ? value : -value,
        reason,
      });
      writeJournal('JV-' + code, isoDate(day), 'Kiểm kê ' + item.name, lines, {
        source: code,
        sourceRoute: 'stock-check',
        sourceManaged: true,
      });
      touchClosing(day);
      say('Đã ghi chênh lệch kiểm kê.');
      return '';
    },
    'Ghi chênh lệch',
  );
}
function resolveStock(x) {
  if (!x || x.cancelled || x.resolution || !tenantOnly()) return;
  const many = x.qty < 0;
  return openModal(
    'Xử lý kiểm kê · ' + x.code,
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      select(
        'Xử lý',
        'type',
        many
          ? ['Trong định mức · 154', 'Ngoài định mức · 632', 'Phải bồi thường · 1388']
          : ['Ghi thu nhập · 711'],
      ),
      ...(many ? [workField()] : []),
    ) + textArea('Căn cứ xử lý', 'reason'),
    (data) => {
      const day = data.get('day'),
        err = postingDateError(day);
      if (err) return err;
      const reason = String(data.get('reason') || '').trim(),
        acct = String(data.get('type')).split(' · ')[1],
        work = data.get('work');
      if (x.resolution || day < x.day || !reason || !(many ? ['154', '632', '1388'] : ['711']).includes(acct))
        return 'Kiểm tra ngày, lý do và phương án.';
      if (acct === '154') {
        const error = workError(work, day);
        if (error) return error;
      }
      const value = Math.abs(x.value);
      const lines = many
        ? [debitLine(acct, value, acct === '154' ? work : x.code), creditLine('1381', value, x.code)]
        : [debitLine('3381', value, x.code), creditLine('711', value, x.code)];
      const code = 'JV-' + x.code + '-XL';
      writeJournal(code, isoDate(day), 'Xử lý kiểm kê ' + x.code, lines, {
        source: x.code,
        sourceRoute: 'stock-check',
        sourceManaged: true,
        log: reason,
      });
      x.resolution = { day, reason, code, account: acct };
      touchClosing(day);
      say('Đã xử lý kiểm kê.');
      return '';
    },
    'Ghi xử lý',
  );
}

function stockCheckView() {
  return warehouseDocuments('count');
}

function defectiveView() {
  return warehouseDocuments('transfer');
}
const kitHasUsage = (kit) =>
  inventory(kit.code).qty > 0 ||
  kitMovements.some((x) => x.item === kit.code) ||
  workOrders.some((w) => w.outputs.some((x) => x.item === kit.code));
function editKit(kit) {
  if (!kit || kit.group !== finishedGroup || kit.variantOf) return;
  const active = kitHasUsage(kit);
  if (active && !kit.kit)
    return openModal('Mã đã sử dụng như thành phẩm', note('Tạo một mã riêng để khai bộ.'), () => '', 'Đóng');
  const known = kit.kit || [];
  return openModal(
    'Cấu phần · ' + kit.name,
    table(
      ['Mã', 'Số lượng'],
      known.map((x) => [x.item, x.qty]),
    ) +
      grid(
        optionsField(
          'Mã thành phần',
          'item',
          catalogSpec.items.rows
            .filter((x) => x.group === finishedGroup && x !== kit && !x.kit)
            .map((x) => [x.code, x.code + ' · ' + x.name]),
        ),
        field('Số đơn vị mỗi bộ (0 để xóa)', 'qty', '', 'number'),
      ),
    (data) => {
      const part = itemBy(data.get('item')),
        qty = Number(data.get('qty'));
      if (
        !part ||
        part === kit ||
        part.kit ||
        part.group !== finishedGroup ||
        !String(data.get('qty') || '') ||
        !Number.isSafeInteger(qty) ||
        qty < 0
      )
        return 'Chọn mã thành phần và số lượng hợp lệ.';
      if (catalogSpec.items.rows.some((x) => x.kit?.some((y) => y.item === kit.code)))
        return 'Mã là cấu phần của bộ khác.';
      const next = known.filter((x) => x.item !== part.code);
      if (qty > 0) next.push({ item: part.code, qty });
      if (!next.length && active) return 'Bộ đã có phát sinh, cần giữ cấu phần.';
      kit.kit = next.length ? next : null;
      say('Đã cập nhật cấu phần.');
      return '';
    },
    'Lưu cấu phần',
  );
}
function chooseKit() {
  const choices = catalogSpec.items.rows.filter((x) => x.kit?.length);
  return openModal(
    'Chọn bộ thành phẩm',
    optionsField(
      'Bộ',
      'kit',
      choices.map((x) => [x.code, x.code + ' · ' + x.name]),
    ),
    (data) => {
      const kit = choices.find((x) => x.code === data.get('kit'));
      if (!kit) return 'Chọn bộ thành phẩm.';
      setTimeout(() => assembleKit(kit), 0);
      return '';
    },
    'Tiếp tục',
  );
}
function assembleKit(kit) {
  if (!kit?.kit?.length) return;
  return openModal(
    'Đóng bộ thành phẩm',
    meta([
      ['Bộ', esc(kit.name)],
      ['Thành phần', esc(kit.kit.map((x) => x.qty + ' ' + itemBy(x.item).name).join(' + '))],
    ]) +
      grid(
        field('Ngày hạch toán', 'day', sampleDate, 'date'),
        field('Số bộ', 'qty', '', 'number'),
        warehouseField('Kho thành phẩm', 'warehouse', finishedGroup, kit),
      ),
    (data) => {
      const day = data.get('day'),
        err = postingDateError(day);
      if (err) return err;
      const count = Number(data.get('qty'));
      const warehouse = warehouseFor(data, 'warehouse', kit);
      if (!warehouse || !Number.isSafeInteger(count) || count <= 0)
        return 'Chọn kho thành phẩm và nhập số bộ nguyên dương.';
      if ([kit.code, ...kit.kit.map((x) => x.item)].some((code) => stockOutAfter(code, day)))
        return 'Đã có giao dịch xuất sau ngày đóng bộ.';
      const parts = kit.kit.map((x) => ({ ...x, qty: x.qty * count, stock: inventory(x.item, day) }));
      if (parts.some((x) => x.qty > quantityAt(x.item, warehouse.code, day)))
        return 'Tồn kho bán không đủ bàn hoặc ghế để đóng bộ.';
      const code = 'DB-' + String(1 + new Set(kitMovements.map((x) => x.code)).size).padStart(4, '0');
      const lines = [];
      let value = 0;
      for (const x of parts) {
        const cost = stockValueOut(x.stock, x.qty);
        value += cost;
        kitMovements.push({ code, item: x.item, day, qty: -x.qty, value: -cost, warehouse: warehouse.code });
        if (cost) lines.push(creditLine(stockAccount(finishedGroup), cost, x.item));
      }
      kitMovements.push({ code, item: kit.code, day, qty: count, value, warehouse: warehouse.code });
      writeJournal(
        'JV-' + code,
        isoDate(day),
        'Đóng bộ thành phẩm',
        [debitLine(stockAccount(finishedGroup), value, kit.code), ...lines],
        { source: code, sourceRoute: stockDocLink('kit', code), sourceManaged: true },
      );
      touchClosing(day);
      say('Đã nhập ' + count + ' bộ thành phẩm.');
      return '';
    },
    'Ghi đóng bộ',
  );
}

function returnMaterial(issue) {
  if (!issue || issue.cancelled) return;
  const work = workOrder(issue.work),
    item = itemBy(issue.item);
  const returned = materialReturns
    .filter((x) => !x.cancelled && x.issue === (issue.lineId || issue.code))
    .reduce((n, x) => n + x.qty, 0);
  return openModal(
    'Nhập lại vật tư dư · ' + issue.code,
    meta([
      ['Lệnh', work.code],
      ['Vật tư', esc(item.name)],
      ['Còn có thể trả', Number((issue.qty - returned).toFixed(6)) + ' ' + item.extra],
    ]) +
      grid(
        field('Ngày hạch toán', 'day', sampleDate, 'date'),
        field('Số lượng trả', 'qty', '', 'number'),
        warehouseField('Kho nhập lại', 'warehouse', materialGroup, item),
      ),
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day) || workError(work.code, day);
      if (error) return error;
      const qty = Number(data.get('qty')),
        remaining = Number((issue.qty - returned).toFixed(6));
      if (
        day < issue.day ||
        !Number.isFinite(qty) ||
        qty <= 0 ||
        qty > remaining ||
        Number(qty.toFixed(6)) !== qty ||
        stockOutAfter(item.code, day)
      )
        return 'Kiểm tra số lượng còn có thể trả và thứ tự ngày.';
      const value =
        Math.round((issue.value * (returned + qty)) / issue.qty) -
        Math.round((issue.value * returned) / issue.qty);
      if (value <= 0 || value > workBalance(work.code, day))
        return 'Giá trị trả không hợp lệ hoặc vượt chi phí còn lại của lệnh.';
      const warehouse = warehouseFor(data, 'warehouse', item);
      if (!warehouse) return 'Chọn kho nguyên liệu đang sử dụng.';
      const code = 'PN-TL-' + String(materialReturns.length + 1).padStart(4, '0');
      writeJournal(
        'JV-' + code,
        isoDate(day),
        'Nhập lại vật tư dư ' + work.code,
        [debitLine(stockAccount(materialGroup), value, item.code), creditLine('154', value, work.code)],
        { source: code, sourceRoute: stockDocLink('returned', code), sourceManaged: true },
      );
      materialReturns.push({
        code,
        warehouse: warehouse.code,
        issue: issue.lineId || issue.code,
        work: work.code,
        item: item.code,
        day,
        qty,
        value,
      });
      touchClosing(day);
      say('Đã ghi nhập lại ' + code);
      return '';
    },
    'Ghi sổ nhập lại',
  );
}
