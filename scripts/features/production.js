const materialGroup = 'Vật tư',
  finishedGroup = 'Thành phẩm';
const mdfCode = 'VCN-0000004',
  defaultProduct = 'TP-BAN-MDF';
const workOrders = [
  {
    code: 'LSX-2026-001',
    day: '2026-11-01',
    state: 'Đang sản xuất',
    sale: 'SO-2026-00002',
    outputs: [{ item: defaultProduct, qty: 20, weight: 1 }],
  },
];
const productionIssues = [],
  finishedReceipts = [],
  costRuns = [];
const itemBy = (code) => catalogSpec.items.rows.find((x) => x.code === code);
const workOrder = (code) => workOrders.find((x) => x.code === code);
const optionsField = (label, name, rows, selected = '') =>
  '<label>' +
  label +
  '<select name="' +
  name +
  '"><option value="">Chọn</option>' +
  rows
    .map(
      ([v, l]) =>
        '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(l) + '</option>',
    )
    .join('') +
  '</select></label>';
const itemField = (label, name, group, selected) =>
  optionsField(
    label,
    name,
    catalogSpec.items.rows.filter((x) => x.group === group).map((x) => [x.code, x.code + ' · ' + x.name]),
    selected,
  );
const workField = (selected = '') =>
  optionsField(
    'Lệnh sản xuất',
    'work',
    workOrders
      .filter((x) => ['Đang sản xuất', 'Hoàn thành'].includes(x.state))
      .map((x) => [x.code, x.code + ' · ' + x.state]),
    selected,
  );
const workUrl = (code) => 'production?work=' + encodeURIComponent(code);
function workError(code, day) {
  if (code === commonWork)
    return costRuns.some(
      (x) =>
        x.period === postingPeriod(day) &&
        finishedReceipts.some(
          (r) => r.work === x.work && r.actual != null && postingPeriod(r.day) === x.period,
        ),
    )
      ? 'Đã có lệnh tính giá trong kỳ. Rà soát lại giá thành trước khi bổ sung chi phí chung.'
      : '';
  const work = workOrder(code);
  if (!work || !['Đang sản xuất', 'Hoàn thành'].includes(work.state) || dayKey(day) < work.day)
    return 'Chọn lệnh chưa tính giá có ngày bắt đầu không sau chứng từ.';
  if (costRuns.some((x) => x.work === code && monthKey(x.period) >= monthKey(postingPeriod(day))))
    return 'Lệnh đã được tính giá cho kỳ này hoặc kỳ sau.';
  return '';
}
function inventory(code, date = todayKey()) {
  const events = [];
  const add = (day, qty, value) => {
    if (dayKey(day) <= date) events.push([dayKey(day), qty, value]);
  };
  const item = itemBy(code);
  if (!item) return { qty: 0, value: 0 };
  if (item.group === materialGroup) {
    for (const row of receipts)
      if (row.state === 'Đã ghi sổ') {
        const invoice = billedReceipt(row.code);
        for (const [index, line] of receiptLines(row).entries()) {
          if (catalogMatch('items', line.item)?.code !== code) continue;
          add(row.day, line.qty, receiptLineValue(line));
          if (invoice?.state === 'Đã ghi sổ')
            add(invoice.post || invoice.day, 0, purchaseVariance(row, line, index));
        }
      }
    for (const row of productionIssues)
      if (!row.cancelled && row.item === code) add(row.day, -row.qty, -row.value);
  } else {
    for (const row of finishedReceipts)
      if (!row.cancelled && row.item === code) add(row.day, row.qty, row.value);
    for (const row of salesDeliveries)
      if (row.state === 'Đã ghi sổ')
        for (const line of deliveryLines(row))
          if (productFor(line).code === code) add(row.day, -line.qty, -deliveryLineBaseCost(line));
    for (const row of stockReturns) if (row.item === code) add(row.day, row.qty, row.value);
    for (const row of costAdjustments) if (row.inventory.has(code)) add(row.day, 0, row.inventory.get(code));
  }
  for (const row of materialReturns)
    if (!row.cancelled && row.item === code) add(row.day, row.qty, row.value);
  for (const row of stockChecks) if (!row.cancelled && row.item === code) add(row.day, row.qty, row.value);
  for (const row of kitMovements) if (!row.cancelled && row.item === code) add(row.day, row.qty, row.value);
  return events.reduce(
    (x, [, qty, value]) => ({ qty: Number((x.qty + qty).toFixed(6)), value: x.value + value }),
    { qty: item.openQty || 0, value: item.openValue || 0 },
  );
}
function firstStockOutAfter(code, day) {
  const shipments = salesDeliveries
    .filter((x) => x.state === 'Đã ghi sổ')
    .flatMap((x) =>
      deliveryLines(x).map((line) => ({
        item: productFor(line).code,
        day: x.day,
        code: x.code,
        route: saleUrl('delivery', x.code),
        label: 'Phiếu giao',
      })),
    );
  const production = productionIssues
    .filter((x) => !x.cancelled)
    .map((x) => ({ ...x, route: journalHref('JV-' + x.code), label: 'Phiếu xuất sản xuất' }));
  const counts = stockChecks
    .filter((x) => !x.cancelled)
    .map((x) => ({ ...x, route: journalHref('JV-' + x.code), label: 'Phiếu kiểm kê' }));
  const kits = kitMovements
    .filter((x) => !x.cancelled && x.qty < 0)
    .map((x) => ({ ...x, route: stockDocLink('kit', x.code), label: 'Phiếu đóng bộ' }));
  const transfers = stockTransfers
    .filter((x) => !x.cancelled)
    .map((x) => ({ ...x, route: stockDocLink('transfer', x.code), label: 'Chuyển kho' }));
  return [...shipments, ...production, ...counts, ...kits, ...transfers]
    .filter((x) => x.item === code && dayKey(x.day) > dayKey(day))
    .sort((a, b) => dayKey(a.day).localeCompare(dayKey(b.day)))[0];
}
const stockOutAfter = (code, day) => Boolean(firstStockOutAfter(code, day));
function completionConflicts(outputs, day) {
  return outputs.map((row) => firstStockOutAfter(row.item, day)).filter(Boolean);
}
function showCompletionConflicts(conflicts) {
  const view = $('completion-conflicts');
  if (!view?.dataset?.work) return;
  view.innerHTML = conflicts.length
    ? '<div class="blocking-error" role="status"><strong>Ngày nhập đứng trước chứng từ đã ghi sổ</strong><ul>' +
      conflicts
        .map(
          (x) =>
            '<li>' +
            esc(x.label) +
            ' ' +
            a(x.route, x.code) +
            ' · ' +
            esc(isoDate(dayKey(x.day))) +
            ' · ' +
            esc(x.item) +
            '</li>',
        )
        .join('') +
      '</ul>Kiểm tra chứng từ nêu trên và sắp lại thứ tự nhập thành phẩm, giao hàng.</div>'
    : '';
}
function refreshCompletionConflicts() {
  const view = $('completion-conflicts');
  if (!view?.dataset?.work) return;
  const form = $('dialogForm'),
    work = workOrder(view.dataset.work),
    day = form.elements.day?.value;
  const outputs = work?.outputs.filter((_, i) => Number(form.elements['out' + i]?.value) > 0) || [];
  showCompletionConflicts(validDate(day) ? completionConflicts(outputs, day) : []);
}
const stockValueOut = (balance, qty) =>
  qty === balance.qty ? balance.value : Math.round((balance.value * qty) / balance.qty);
function productionDashboard(period) {
  const wood = catalogSpec.items.rows
    .filter((x) => x.group === materialGroup && x.extra === 'm³' && x.wood)
    .map((x) => inventory(x.code));
  const finished = catalogSpec.items.rows
    .filter((x) => x.group === finishedGroup)
    .map((x) => inventory(x.code));
  const gross = financialData(1, period).rows.find(([name]) => name === 'Lợi nhuận gộp')?.[1] || 0;
  return cards([
    ['Lệnh đang sản xuất', workOrders.filter((x) => x.state === 'Đang sản xuất').length, 'production'],
    [
      'Tồn gỗ',
      Number(wood.reduce((n, x) => n + x.qty, 0).toFixed(6)) +
        ' m³ · ' +
        money(wood.reduce((n, x) => n + x.value, 0)),
      'stock',
    ],
    [
      'Tồn thành phẩm',
      finished.reduce((n, x) => n + x.qty, 0) +
        ' đơn vị · ' +
        money(finished.reduce((n, x) => n + x.value, 0)),
      'stock',
    ],
    ['Cọc đang giữ', money(deposits.reduce((n, x) => n + depositBalance(x), 0)), 'deposits'],
    ['Lãi gộp tháng ' + period, money(gross), 26],
  ]);
}
function productionView() {
  const current = workOrder(new URLSearchParams(location.hash.split('?')[1]).get('work'));
  if (!current) {
    const { rows, toolbar } = searchList(
      'work-orders',
      workOrders,
      'Tìm theo mã lệnh, thành phẩm hoặc đơn bán',
      (x) => [x.code, x.sale, ...x.outputs.flatMap((y) => [y.item, itemBy(y.item)?.name])],
      [
        [
          'status',
          'Tất cả trạng thái',
          columnChoices([
            'Nháp',
            'Đang sản xuất',
            'Hoàn thành',
            'Đã tính giá',
            ...workOrders.map((x) => x.state),
          ]),
          (x) => x.state,
        ],
      ],
    );
    return pad(
      'Lệnh sản xuất',
      b('mfg-new', 'Tạo lệnh', 'primary') +
        note('Thứ tự ghi sổ: báo hoàn thành và nhập kho thành phẩm trước, sau đó lập phiếu giao.') +
        toolbar +
        table(
          ['Lệnh', 'Thành phẩm', 'Ngày bắt đầu', 'Đơn bán', 'Trạng thái'],
          rows.map((x) => [
            a(workUrl(x.code), x.code),
            esc(x.outputs.map((y) => itemBy(y.item).name + ' × ' + y.qty).join(', ')),
            isoDate(x.day),
            x.sale ? a(saleUrl('order', x.sale), x.sale) : '—',
            pill(x.state),
          ]),
        ),
    );
  }
  return (
    pad(
      current.code,
      meta([
        ['Ngày bắt đầu', isoDate(current.day)],
        ['Trạng thái', pill(current.state)],
        ['Đơn bán', current.sale ? a(saleUrl('order', current.sale), current.sale) : '—'],
        ...(warehouseOnly() ? [] : [['Dở dang theo sổ', money(workBalance(current.code, todayKey()))]]),
      ]) +
        table(
          ['Thành phẩm', 'SL kế hoạch', 'SL hoàn thành', 'Trọng số định mức'],
          current.outputs.map((row) => [
            esc(itemBy(row.item).name),
            row.qty,
            row.completed ?? '—',
            row.weight,
          ]),
          [1, 2, 3],
        ) +
        '<div class="actions">' +
        (current.state === 'Nháp'
          ? b('mfg-start|' + current.code, 'Bắt đầu sản xuất', 'primary')
          : current.state === 'Đang sản xuất'
            ? b('mfg-issue|' + current.code, 'Xuất vật tư') +
              b('mfg-bom|' + current.code, 'Xuất theo định mức', 'primary') +
              b('mfg-complete|' + current.code, 'Báo hoàn thành')
            : !warehouseOnly() && current.state === 'Hoàn thành'
              ? a('cost', 'Điều chỉnh giá thành')
              : '') +
        a('production', 'Về danh sách') +
        '</div>',
    ) +
    pad('Định mức và thực xuất', materialUsage(current)) +
    (warehouseOnly()
      ? ''
      : pad(
          'Bút toán theo lệnh',
          postingTable(records.journal.filter((x) => x.lines?.some((line) => line[1] === current.code))),
        ))
  );
}
function newProduction() {
  return openModal(
    'Tạo lệnh sản xuất',
    grid(
      field('Ngày đặt', 'day', sampleDate, 'date'),
      itemField('Thành phẩm 1', 'product', finishedGroup),
      field('SL kế hoạch 1', 'qty', '', 'number'),
      itemField('Thành phẩm 2 (tùy chọn)', 'product2', finishedGroup),
      field('SL kế hoạch 2', 'qty2', '', 'number'),
      optionsField(
        'Đơn bán liên kết',
        'sale',
        salesOrders.filter((x) => x.state !== 'Đã hủy').map((x) => [x.code, x.code + ' · ' + x.party]),
      ),
    ),
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day);
      if (error) return error;
      const outputs = [
        ['product', 'qty'],
        ['product2', 'qty2'],
      ]
        .filter(([key]) => data.get(key))
        .map(([key, qty]) => ({
          item: data.get(key),
          qty: Number(data.get(qty)),
          weight: itemBy(data.get(key))?.weight || 0,
        }));
      if (
        !outputs.length ||
        outputs.some(
          (x) =>
            itemBy(x.item)?.kit ||
            itemBy(x.item)?.group !== finishedGroup ||
            !Number.isSafeInteger(x.qty) ||
            x.qty <= 0,
        ) ||
        new Set(outputs.map((x) => x.item)).size !== outputs.length
      )
        return 'Chọn mã thành phẩm khác nhau và số lượng nguyên dương.';
      if (outputs.length > 1 && outputs.some((x) => !x.weight))
        return 'Khai trọng số định mức cho từng thành phẩm trước khi tạo lệnh nhiều mã.';
      const sale = data.get('sale');
      if (
        sale &&
        !salesOrders.some(
          (x) =>
            x.code === sale &&
            x.state !== 'Đã hủy' &&
            outputs.some((y) => y.item === (x.product || defaultProduct)),
        )
      )
        return 'Lệnh phải có mã thành phẩm của đơn bán.';
      const code = 'LSX-' + day.slice(0, 4) + '-' + String(workOrders.length + 1).padStart(3, '0');
      workOrders.push({ code, day, outputs, sale, state: 'Nháp' });
      route(workUrl(code));
      touchClosing(day);
      return '';
    },
    'Lưu nháp',
  );
}
const normQty = (n) => Number(n.toFixed(6));
function materialPlan(work) {
  const plan = new Map();
  for (const x of work.outputs)
    for (const row of itemBy(x.item).bom || [])
      plan.set(row.item, (plan.get(row.item) || 0) + x.qty * row.qty);
  return plan;
}
function netIssued(work, item, day = '9999-12-31') {
  return normQty(
    productionIssues
      .filter((x) => !x.cancelled && x.work === work.code && x.item === item && x.day <= day)
      .reduce((n, x) => n + x.qty, 0) -
      materialReturns
        .filter((x) => !x.cancelled && x.work === work.code && x.item === item && x.day <= day)
        .reduce((n, x) => n + x.qty, 0),
  );
}
function materialUsage(work) {
  const plan = materialPlan(work);
  const items = [
    ...new Set([
      ...plan.keys(),
      ...productionIssues.filter((x) => !x.cancelled && x.work === work.code).map((x) => x.item),
    ]),
  ];
  return table(
    ['Mã hàng', 'Vật tư', 'ĐVT', 'Định mức', 'Đã xuất ròng', 'Chênh lệch'],
    items.map((code) => {
      const item = itemBy(code),
        target = normQty(plan.get(code) || 0),
        actual = netIssued(work, code);
      return [code, esc(item.name), esc(item.extra), target, actual, normQty(actual - target)];
    }),
    [3, 4, 5],
  );
}
function issueMaterial(work, fromBom = false) {
  if (work?.state !== 'Đang sản xuất') return;
  const plan = materialPlan(work),
    items = [...plan.keys()];
  if (fromBom && !items.length)
    return openModal(
      'Chưa có định mức',
      note('Khai BOM cho thành phẩm trước khi xuất theo định mức.'),
      () => '',
      'Đóng',
    );
  const detail = fromBom
    ? table(
        ['Vật tư', 'ĐVT cơ sở', 'Còn nên xuất', 'Số lượng xuất', 'Kho xuất'],
        items.map((code, i) => {
          const item = itemBy(code),
            remaining = Math.max(0, normQty(plan.get(code) - netIssued(work, code)));
          return [
            esc(item.name),
            esc(item.extra),
            remaining,
            field('SL ' + item.name, 'qty' + i, remaining, 'number'),
            warehouseField('Kho xuất', 'warehouse' + i, materialGroup, item),
          ];
        }),
        [2],
      )
    : grid(
        itemField('Vật tư', 'item', materialGroup),
        warehouseField('Kho xuất', 'warehouse', materialGroup, null, null, 'item'),
        field('Số lượng', 'qty', '', 'number'),
        select('Đơn vị nhập', 'unit', ['ĐVT cơ sở', 'ĐVT phụ']),
      );
  return openModal(
    (fromBom ? 'Xuất theo định mức' : 'Phiếu xuất vật tư') + ' · ' + work.code,
    grid(field('Ngày hạch toán', 'day', sampleDate, 'date')) +
      detail +
      textArea('Lý do nếu vượt định mức', 'reason'),
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day) || workError(work.code, day);
      if (error) return error;
      if (work.state !== 'Đang sản xuất') return 'Lệnh không còn đang sản xuất.';
      const item = itemBy(data.get('item')),
        converted = data.get('unit') === 'ĐVT phụ';
      if (!fromBom && converted && (!item?.alt || !item.factor)) return 'Mã vật tư chưa có quy đổi ĐVT phụ.';
      const rows = fromBom
        ? items.map((code, i) => ({
            item: code,
            warehouse: warehouseFor(data, 'warehouse' + i, itemBy(code))?.code,
            qty: normQty(Number(data.get('qty' + i) || 0)),
          }))
        : [
            {
              item: item?.code,
              warehouse: warehouseFor(data, 'warehouse', item)?.code,
              qty: normQty(Number(data.get('qty')) * (converted ? item.factor : 1)),
            },
          ];
      if (
        rows.some((x) => itemBy(x.item)?.group !== materialGroup || !Number.isFinite(x.qty) || x.qty < 0) ||
        !rows.some((x) => x.qty > 0)
      )
        return 'Chọn vật tư và nhập số lượng dương.';
      const posting = rows.filter((x) => x.qty > 0),
        reason = String(data.get('reason') || '').trim();
      for (const row of posting) {
        const bal = inventory(row.item, day);
        if (!row.warehouse) return 'Chọn kho nguyên liệu đang sử dụng cho từng dòng.';
        const onHand = quantityAt(row.item, row.warehouse, day);
        if (row.qty > onHand)
          return (
            'Kho đã chọn còn ' + onHand + ' ' + itemBy(row.item).extra + ' của ' + itemBy(row.item).name + '.'
          );
        if (stockOutAfter(row.item, day))
          return 'Đã có lần xuất sau ngày này. Chọn ngày mới hơn để giữ giá vốn đã ghi.';
        row.value = stockValueOut(bal, row.qty);
        if (!Number.isSafeInteger(row.value) || row.value <= 0)
          return 'Vật tư chưa có giá trị tồn kho hợp lệ.';
      }
      const exceeded = posting.filter(
        (row) => normQty(netIssued(work, row.item, day) + row.qty) > normQty(plan.get(row.item) || 0),
      );
      if (exceeded.length && !reason)
        return (
          'Vượt định mức ' +
          exceeded.map((x) => itemBy(x.item).name).join(', ') +
          '. Nhập lý do trước khi ghi sổ.'
        );
      const code = 'PX-SX-' + String(new Set(productionIssues.map((x) => x.code)).size + 1).padStart(4, '0');
      const total = posting.reduce((n, x) => n + x.value, 0);
      const lines = [
        debitLine('154', total, work.code),
        ...posting.map((x) => creditLine(stockAccount(materialGroup), x.value, x.item)),
      ];
      writeJournal('JV-' + code, isoDate(day), 'Xuất vật tư sản xuất ' + work.code, lines, {
        source: code,
        sourceRoute: 'mfg-issues',
        sourceManaged: true,
        ...(reason ? { log: reason } : {}),
      });
      for (const [i, row] of posting.entries())
        productionIssues.push({
          ...row,
          code,
          lineId: posting.length === 1 ? code : code + '~' + (i + 1),
          work: work.code,
          day,
        });
      touchClosing(day);
      say('Đã ghi phiếu ' + code);
      return '';
    },
    'Ghi sổ phiếu xuất',
  );
}
function reportCompletion(work) {
  if (!work || work.state !== 'Đang sản xuất') return;
  return openModal(
    'Báo hoàn thành và nhập kho · ' + work.code,
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      ...work.outputs.flatMap((x, i) => [
        field('SL hoàn thành · ' + itemBy(x.item).name, 'out' + i, x.qty, 'number'),
        warehouseField(
          'Kho nhập · ' + esc(itemBy(x.item).name),
          'warehouse' + i,
          finishedGroup,
          itemBy(x.item),
        ),
      ]),
      ...(warehouseOnly()
        ? []
        : [
            select('Căn cứ giá tạm', 'method', [
              'Chi phí 154 đến ngày hoàn thành',
              'Theo BOM',
              'Nhập tổng giá tạm',
            ]),
            field('Tổng giá tạm nhập tay (đ)', 'amount', '', 'number'),
          ]),
    ) +
      note(
        'Báo hoàn thành và nhập kho thành phẩm trước khi lập phiếu giao. Xác nhận ghi Nợ 155 / Có 154 theo ngày hoàn thành. Cuối kỳ ghi chênh lệch giá.',
      ) +
      '<div id="completion-conflicts" data-work="' +
      esc(work.code) +
      '"></div>',
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day) || workError(work.code, day);
      if (error) return error;
      if (work.state !== 'Đang sản xuất') return 'Lệnh đã báo hoàn thành.';
      const counts = work.outputs.map((_, i) => Number(data.get('out' + i)));
      if (
        !counts.some((x) => x > 0) ||
        counts.some((x, i) => !Number.isSafeInteger(x) || x < 0 || x > work.outputs[i].qty)
      )
        return 'Sản lượng hoàn thành phải trong kế hoạch và có ít nhất một mã hoàn thành.';
      const outputs = work.outputs
        .map((row, i) => ({
          ...row,
          qty: counts[i],
          warehouse: warehouseFor(data, 'warehouse' + i, itemBy(row.item))?.code,
        }))
        .filter((row) => row.qty > 0);
      if (outputs.some((row) => !row.warehouse)) return 'Chọn kho thành phẩm đang sử dụng cho từng dòng.';
      const conflicts = completionConflicts(outputs, day);
      if (conflicts.length) {
        showCompletionConflicts(conflicts);
        return (
          'Chưa thể ghi sổ. ' +
          conflicts.map((x) => x.label + ' ' + x.code + ' (' + isoDate(dayKey(x.day)) + ')').join(', ') +
          ' đứng sau ngày nhập.'
        );
      }
      let method = (!warehouseOnly() && data.get('method')) || 'Chi phí 154 đến ngày hoàn thành';
      let values = provisionalValues(work, counts, day, method, Number(data.get('amount')));
      if (!values && warehouseOnly()) {
        method = 'Theo BOM';
        values = provisionalValues(work, counts, day, method, 0);
      }
      if (!values)
        return warehouseOnly()
          ? 'Liên hệ Kế toán để kiểm tra căn cứ giá tạm.'
          : 'Chưa đủ giá tạm. Chọn BOM có giá vật tư hoặc nhập tổng giá tạm hợp lệ.';
      for (const [i, row] of outputs.entries()) {
        const code = 'PN-TP-' + String(finishedReceipts.length + 1).padStart(4, '0'),
          value = values[i];
        writeJournal(
          'JV-' + code,
          isoDate(day),
          'Nhập thành phẩm giá tạm · ' + work.code,
          [debitLine(stockAccount(finishedGroup), value, row.item), creditLine('154', value, work.code)],
          { source: code, sourceRoute: 'mfg-receipts', sourceManaged: true },
        );
        finishedReceipts.push({
          code,
          work: work.code,
          item: row.item,
          day,
          qty: row.qty,
          value,
          warehouse: row.warehouse,
          weight: row.weight,
          method,
        });
      }
      work.outputs.forEach((row, i) => (row.completed = counts[i]));
      work.done = day;
      work.state = 'Hoàn thành';
      touchClosing(day);
      say('Đã nhập thành phẩm theo giá tạm của ' + work.code);
      return '';
    },
    'Báo hoàn thành và ghi phiếu nhập',
  );
  refreshCompletionConflicts();
}
const workBalance = (code, day) =>
  journalLines()
    .filter((x) => x.code.startsWith('154') && x.party === code && dayKey(x.entry.day) <= day)
    .reduce((n, x) => n + x.debit - x.credit, 0);
const periodEnd = (period) => {
  const [m, y] = period.split('/').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
function pendingProduction(period) {
  const end = periodEnd(period);
  const unassigned = journalLines().some(
    (x) =>
      x.code.startsWith('154') &&
      x.debit > 0 &&
      monthOf(x) === period &&
      x.entry.state === 'Đã ghi sổ' &&
      x.party !== commonWork &&
      !workOrder(x.party),
  );
  const pending = workOrders.filter(
    (x) =>
      x.day <= end &&
      x.state !== 'Nháp' &&
      !costRuns.some((run) => run.work === x.code && run.period === period) &&
      ((x.done && x.done <= end && x.state === 'Hoàn thành') || workBalance(x.code, end) > 0),
  );
  return { pending, unassigned };
}
function costWorkspace() {
  const end = periodEnd(closingPeriod),
    { pending, unassigned } = pendingProduction(closingPeriod);
  const runs = costRuns.filter((x) => x.period === closingPeriod);
  return (
    pad(
      'Tính giá thành cuối kỳ · ' + closingPeriod,
      (unassigned ? note('Có phát sinh TK 154 chưa gắn lệnh. Sửa nguồn hạch toán trước khi khóa kỳ.') : '') +
        table(
          ['Lệnh', 'Trạng thái', 'Chi phí cần phân bổ', 'Thao tác'],
          pending.map((x) => [
            a(workUrl(x.code), x.code),
            pill(x.state),
            money(workBalance(x.code, end)),
            b(
              'mfg-cost|' + x.code,
              x.state === 'Hoàn thành' ? 'Điều chỉnh giá thành' : 'Xác nhận dở dang',
              'primary',
            ),
          ]),
          [2],
        ),
    ) +
    pad(
      'Đã tính trong kỳ',
      table(
        ['Lệnh', 'Chi phí', 'Dở dang cuối kỳ', 'Giá tạm', 'Chênh lệch ghi sổ', 'Giải trình', 'Thao tác'],
        runs.map((x) => [
          a(workUrl(x.work), x.work),
          money(x.available),
          money(x.wip),
          money(x.provisional || 0),
          money(x.available - x.wip - (x.provisional || 0)),
          esc(x.reason || '—'),
          b('cost-undo|' + x.work, 'Làm lại', 'link'),
        ]),
        [1, 2, 3, 4],
      ),
    ) +
    a('warehouse-docs?type=finished', 'Mở phiếu nhập thành phẩm')
  );
}
const costAdjustments = [];
function apportion(total, weights) {
  const sum = weights.reduce((n, x) => n + x, 0);
  if (!Number.isSafeInteger(total) || !Number.isFinite(sum) || sum <= 0) return null;
  let cumulative = 0,
    used = 0;
  return weights.map((weight, i) => {
    cumulative += weight;
    const next = i === weights.length - 1 ? total : Math.round((total * cumulative) / sum);
    const share = next - used;
    used = next;
    return share;
  });
}
const deliveryLineKey = (ship, product) => ship.code + '|' + product;
const deliveryLineBaseCost = (line) =>
  line.cost ?? Math.round((line.qty * (productFor(line).openValue || 0)) / (productFor(line).openQty || 1));
const deliveryCostDelta = (adjustment, ship, line) =>
  adjustment.delivery.get(deliveryLineKey(ship, productFor(line).code)) || 0;
const deliveryLineCostAt = (ship, line, day) =>
  deliveryLineBaseCost(line) +
  costAdjustments.filter((a) => a.day <= day).reduce((sum, a) => sum + deliveryCostDelta(a, ship, line), 0);
const deliveryCostAt = (ship, day) =>
  deliveryLines(ship).reduce((sum, line) => sum + deliveryLineCostAt(ship, line, day), 0);
const perOutput = (value, rows) =>
  apportion(
    value,
    rows.map((x) => x.qty * (x.weight || 1)),
  );
function provisionalValues(work, counts, day, method, manual) {
  const outputs = work.outputs.map((x, i) => ({ ...x, qty: counts[i] })).filter((x) => x.qty > 0);
  if (method === 'Theo BOM') {
    const bom = outputs.map((x) => itemBy(x.item).bom || []);
    if (bom.some((x) => !x.length)) return null;
    const values = outputs.map((row, i) =>
      Math.round(
        row.qty *
          bom[i].reduce((n, x) => {
            const bal = inventory(x.item, day);
            return bal.qty && bal.value > 0 ? n + (x.qty * bal.value) / bal.qty : NaN;
          }, 0),
      ),
    );
    return values.every((x) => Number.isSafeInteger(x) && x > 0) ? values : null;
  }
  const total = method === 'Nhập tổng giá tạm' ? manual : workBalance(work.code, day);
  const values = perOutput(total, outputs);
  return values?.every((x) => x > 0) ? values : null;
}
function valuationReplay(receiptDeltas, end) {
  const qty = new Map(),
    delta = new Map(),
    shipped = new Map(),
    returned = new Map(),
    kit = new Map(),
    entries = new Map(),
    events = [];
  const add = (row, type, code) => {
    const seq = records.journal.findIndex((j) => j.code === code || j.source === code);
    if (!row.cancelled && dayKey(row.day) <= end) events.push({ row, type, seq, day: dayKey(row.day) });
  };
  for (const x of catalogSpec.items.rows.filter((x) => x.group === finishedGroup))
    qty.set(x.code, x.openQty || 0);
  for (const row of finishedReceipts) add(row, 'receipt', row.code);
  for (const row of salesDeliveries.filter((x) => x.state === 'Đã ghi sổ'))
    for (const line of deliveryLines(row)) add({ ...line, day: row.day, code: row.code }, 'ship', row.code);
  for (const row of stockReturns) add(row, 'return', row.code);
  for (const row of kitMovements) add(row, 'kit', row.code);
  for (const row of stockChecks.filter((x) => itemBy(x.item)?.group === finishedGroup))
    add(row, 'count', row.code);
  events.sort((a, b) => a.day.localeCompare(b.day) || a.seq - b.seq);
  const adjust = (map, key, n) => map.set(key, (map.get(key) || 0) + n);
  const classify = (code, party, n) => adjust(entries, code + '|' + party, n);
  for (const { type, row } of events) {
    const item = type === 'ship' ? productFor(row).code : row.item;
    const onHand = qty.get(item) || 0,
      value = delta.get(item) || 0;
    if (type === 'receipt') {
      adjust(qty, item, row.qty);
      adjust(delta, item, receiptDeltas.get(row.code) || 0);
    }
    if (type === 'ship') {
      if (onHand < row.qty) return { error: 'Không khớp lịch sử xuất kho của ' + item + '.' };
      const moved = row.qty === onHand ? value : Math.round((value * row.qty) / onHand);
      adjust(qty, item, -row.qty);
      adjust(delta, item, -moved);
      shipped.set(deliveryLineKey(row, item), moved);
    }
    if (type === 'return') {
      const ship = salesDeliveries.find((x) => x.code === row.delivery);
      const line = deliveryLines(ship).find((value) => productFor(value).code === item);
      const key = ship ? deliveryLineKey(ship, item) : '';
      const before = returned.get(key) || 0,
        amount = shipped.get(key) || 0;
      const moved = line
        ? Math.round((amount * (before + row.qty)) / line.qty) - Math.round((amount * before) / line.qty)
        : 0;
      adjust(returned, key, row.qty);
      adjust(qty, item, row.qty);
      adjust(delta, item, moved);
    }
    if (type === 'kit' || type === 'count') {
      if (row.qty < 0) {
        if (onHand < -row.qty) return { error: 'Không khớp lịch sử đóng bộ hoặc kiểm kê của ' + item + '.' };
        const moved = -row.qty === onHand ? value : Math.round((-value * row.qty) / onHand);
        adjust(delta, item, -moved);
        if (type === 'kit') adjust(kit, row.code, moved);
        else if (row.resolution && row.resolution.day <= end) {
          if (row.resolution.account === '154' && moved)
            return {
              error:
                'Kiểm kê đã đưa chênh lệch của ' +
                item +
                ' vào một lệnh khác. Cần xử lý liên lệnh trước khi tính giá.',
            };
          classify(row.resolution.account || '1381', row.code, moved);
        } else classify('1381', row.code, moved);
      } else if (type === 'kit') adjust(delta, item, kit.get(row.code) || 0);
      adjust(qty, item, row.qty);
    }
  }
  for (const [item, value] of delta)
    if (value) {
      if (stockOutAfter(item, end))
        return {
          error:
            'Mã ' +
            item +
            ' đã có giao dịch xuất sau kỳ tính giá. Cần tính lại giá vốn kỳ sau trước khi ghi điều chỉnh.',
        };
      if (inventory(item, end).value + value < 0)
        return { error: 'Điều chỉnh làm giá trị tồn của ' + item + ' bị âm.' };
      classify(stockAccount(finishedGroup), item, value);
    }
  for (const [key, total] of shipped)
    if (total) {
      const [code, product] = key.split('|');
      const ship = salesDeliveries.find((x) => x.code === code);
      const line = deliveryLines(ship).find((row) => productFor(row).code === product);
      const used = total - Math.round((total * (returned.get(key) || 0)) / line.qty);
      const acct = ship.requiresAcceptance && (!ship.accepted || ship.accepted > end) ? '157' : '632';
      if (acct === '157' && ship.accepted && ship.accepted > end)
        return { error: 'Phiếu ' + code + ' đã nghiệm thu ở kỳ sau. Phải xử lý lại giá vốn kỳ sau.' };
      if (stockReturns.some((x) => x.delivery === code && x.day > end))
        return {
          error: 'Phiếu ' + code + ' đã trả hàng ở kỳ sau. Kiểm tra giá hoàn nhập trước khi tính giá.',
        };
      classify(acct, code, used);
    }
  return { entries, inventory: delta, delivery: shipped };
}
const costVarianceLimit = () => Number(stage.settings?.[4]?.costVariance ?? 30);
function costVarianceRows(receipts, actual) {
  const limit = costVarianceLimit();
  return receipts.map((row, i) => {
    const delta = (100 * (actual[i] - row.value)) / row.value;
    return { row, actual: actual[i], delta, alert: Math.abs(delta) > limit };
  });
}
function costVariancePreview(receipts, expected, wip) {
  if (!Number.isSafeInteger(wip) || wip < 0 || wip >= expected) return '';
  const actual = perOutput(expected - wip, receipts);
  if (!actual?.every((x) => x > 0)) return '';
  const rows = costVarianceRows(receipts, actual);
  return (
    (rows.some((x) => x.alert)
      ? '<p class="blocking-error" role="status">Giá thực tế chênh quá ' +
        costVarianceLimit() +
        '% so với giá tạm. Kiểm tra chi phí và nhập lý do trước khi ghi sổ.</p>'
      : '') +
    table(
      ['Mã', 'Giá tạm / ĐV', 'Giá thực tế / ĐV', 'Lệch (%)'],
      rows.map((x) => [
        esc(x.row.item),
        money(x.row.value / x.row.qty),
        money(x.actual / x.row.qty),
        (x.delta > 0 ? '+' : '') + x.delta.toFixed(1) + '%' + (x.alert ? ' · Cần giải trình' : ''),
      ]),
      [1, 2, 3],
    )
  );
}
function calculateProduction(work) {
  if (currentClosing()) return reopenCostWork();
  if (!work) return;
  const period = closingPeriod,
    end = periodEnd(period);
  const receipts = finishedReceipts.filter(
    (x) => !x.cancelled && x.work === work.code && postingPeriod(x.day) === period,
  );
  const ready = work.state === 'Hoàn thành' && work.done <= end && receipts.length > 0;
  const provisional = receipts.reduce((n, x) => n + x.value, 0);
  const expected = workBalance(work.code, end) + provisional;
  const body =
    meta([
      ['Lệnh', work.code],
      ['Chi phí thực tế tập hợp', money(expected)],
      ['Đã nhập kho theo giá tạm', money(provisional)],
      ['Ngày tính giá', isoDate(end)],
    ]) +
    (ready
      ? grid(field('Dở dang cuối kỳ (đ)', 'amount', '0', 'number')) +
        '<div id="cost-variance-preview" data-work="' +
        esc(work.code) +
        '">' +
        costVariancePreview(receipts, expected, 0) +
        '</div>'
      : note('Toàn bộ chi phí của lệnh chưa hoàn thành tiếp tục theo dõi trên TK 154.'));
  return openModal(
    ready ? 'Điều chỉnh giá thành cuối kỳ' : 'Xác nhận dở dang cuối kỳ',
    body + textArea('Căn cứ xác nhận', 'reason'),
    (data) => {
      const error = postingDateError(end);
      if (error) return error;
      if (commonBalance(end) !== 0) return 'Phân bổ hết chi phí sản xuất chung trước khi tính giá.';
      if (
        !pendingProduction(period).pending.includes(work) ||
        workBalance(work.code, end) + provisional !== expected
      )
        return 'Chi phí hoặc trạng thái lệnh đã thay đổi. Mở lại màn tính giá.';
      const reason = String(data.get('reason') || '').trim();
      const wip = ready ? Number(data.get('amount')) : expected;
      if (!Number.isSafeInteger(wip) || wip < 0 || wip > expected || (ready && wip === expected))
        return 'Nhập giá trị dở dang hợp lệ. Thành phẩm hoàn thành cần có giá thực tế.';
      if (!ready && !reason) return 'Nhập căn cứ xác nhận dở dang.';
      if (ready) {
        const actual = perOutput(expected - wip, receipts);
        if (!actual?.every((x) => x > 0)) return 'Chi phí không đủ để tính giá cho mọi mã.';
        const outliers = costVarianceRows(receipts, actual).filter((x) => x.alert);
        if (outliers.length && !reason)
          return (
            'Nhập lý do chênh lệch vượt ' +
            costVarianceLimit() +
            '% của ' +
            outliers.map((x) => x.row.item).join(', ') +
            '.'
          );
        const differences = new Map(receipts.map((x, i) => [x.code, actual[i] - x.value]));
        const split = valuationReplay(differences, end);
        if (split.error) return split.error;
        const total = expected - wip - provisional;
        const lines = [];
        for (const [key, value] of split.entries) {
          const [acct, party] = key.split('|');
          if (value) lines.push(value > 0 ? debitLine(acct, value, party) : creditLine(acct, -value, party));
        }
        if (total)
          lines.push(total > 0 ? creditLine('154', total, work.code) : debitLine('154', -total, work.code));
        if (sum(lines, 2) !== sum(lines, 3))
          return 'Không cân bằng chênh lệch. Kiểm tra lịch sử kho trước khi ghi.';
        const baseCode = 'JV-GT-' + work.code + '-' + period.replace('/', '-');
        const code = journalBy(baseCode) ? baseCode + '-' + records.journal.length : baseCode;
        if (lines.length)
          writeJournal(code, isoDate(end), 'Điều chỉnh giá thành ' + work.code, lines, {
            source: work.code,
            sourceRoute: 'cost',
            sourceManaged: true,
            ...(reason ? { log: reason } : {}),
          });
        costAdjustments.push({
          day: end,
          inventory: split.inventory,
          delivery: split.delivery,
          code,
          seq: lines.length ? records.journal.length - 1 : records.journal.length,
        });
        receipts.forEach((row, i) => (row.actual = actual[i]));
        work.state = 'Đã tính giá';
      }
      costRuns.push({
        work: work.code,
        period,
        available: expected,
        wip,
        provisional,
        reason,
        adjustment: ready ? costAdjustments.at(-1).code : null,
      });
      touchClosing(end);
      say('Đã chốt giá kỳ ' + period + ' cho ' + work.code + '.');
      return '';
    },
    ready ? 'Ghi điều chỉnh giá' : 'Xác nhận dở dang',
  );
}
function productionDocuments(inbound) {
  return warehouseDocuments(inbound ? 'finished' : 'issue');
}
function manufacturingAction(id) {
  const [op, code] = id.split('|');
  const work = workOrder(code);
  if (op === 'mfg-new') return newProduction();
  if (op === 'mfg-start' && work?.state === 'Nháp') {
    const error = postingDateError(work.day);
    if (error) return openModal('Kiểm tra ngày', note(esc(error)), () => '', 'Đóng');
    work.state = 'Đang sản xuất';
    touchClosing(work.day);
    return say('Đã bắt đầu ' + code);
  }
  if (op === 'mfg-issue' || op === 'mfg-bom') return issueMaterial(work, op === 'mfg-bom');
  if (op === 'mfg-complete') return reportCompletion(work);
  if (op === 'mfg-cost') return calculateProduction(work);
}

function refreshCostPreview() {
  const view = $('cost-variance-preview');
  if (!view?.dataset?.work) return;
  const end = periodEnd(closingPeriod),
    code = view.dataset.work;
  const receipts = finishedReceipts.filter(
    (x) => !x.cancelled && x.work === code && postingPeriod(x.day) === closingPeriod,
  );
  const wip = Number(moneyRaw($('dialogForm').elements.amount?.value || '0'));
  view.innerHTML = costVariancePreview(
    receipts,
    workBalance(code, end) + receipts.reduce((n, x) => n + x.value, 0),
    wip,
  );
}
