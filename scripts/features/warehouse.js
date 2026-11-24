let previousReceiptDetail = false,
  previousStockDetail = false,
  purchaseFilters = {},
  stockFilters = {};
let warehouseKind = '',
  invoiceKind = '',
  invoiceStage = '';
const cancellableWarehouseTypes = new Set(['issue', 'finished', 'count', 'returned', 'transfer', 'kit']);
const docTypes = {
  purchase: 'Nhập mua',
  issue: 'Xuất sản xuất',
  finished: 'Nhập thành phẩm',
  returned: 'Nhập lại vật tư dư',
  count: 'Kiểm kê',
  transfer: 'Chuyển kho',
  kit: 'Đóng bộ',
};
const stockDocLink = (type, code) => 'warehouse-docs?type=' + type + '&doc=' + encodeURIComponent(code);
function warehouseGroups(type, rows) {
  const byCode = new Map();
  for (const row of rows) {
    if (!byCode.has(row.code)) byCode.set(row.code, []);
    byCode.get(row.code).push(row);
  }
  return [...byCode].map(([code, items]) => ({
    type,
    code,
    items,
    day: dayKey(items[0].day),
    state: items[0].state || (items[0].cancelled ? 'Đã hủy' : 'Đã ghi sổ'),
  }));
}
function stockDocuments() {
  return [
    ...warehouseGroups(
      'purchase',
      receipts.flatMap((x) =>
        receiptLines(x).map((line, index) => ({
          ...x,
          ...line,
          item: catalogMatch('items', line.item)?.code,
          sourceRow: x,
          value: receiptLineValue(line) + purchaseVariance(x, line, index),
        })),
      ),
    ),
    ...warehouseGroups('issue', productionIssues),
    ...warehouseGroups('finished', finishedReceipts),
    ...warehouseGroups('returned', materialReturns),
    ...warehouseGroups('count', stockChecks),
    ...warehouseGroups('transfer', stockTransfers),
    ...warehouseGroups('kit', kitMovements),
  ].sort((x, y) => y.day.localeCompare(x.day) || x.code.localeCompare(y.code));
}
function warehouseDocuments(defaultType = '') {
  const params = routeParams(),
    kind = params.get('type') || defaultType || warehouseKind;
  const doc = stockDocuments().find((x) => x.code === params.get('doc'));
  if (doc) return stockDocumentDetail(doc);
  const rows = visibleDocuments(stockDocuments()).filter((x) => !kind || x.type === kind);
  const names = Object.entries(docTypes);
  const states = stateTabs
    .map(
      ([value, label], i) =>
        '<button type="button" role="tab" aria-selected="' +
        (value === status) +
        '" class="' +
        (value === status ? 'active' : '') +
        '" data-do="document-state-' +
        i +
        '">' +
        label +
        '</button>',
    )
    .join('');
  const types =
    '<label class="warehouse-filter-field warehouse-kind"><span>Loại phiếu</span><select name="warehouse-type"><option value="">Tất cả loại phiếu</option>' +
    names
      .map(
        ([v, l]) =>
          '<option value="' + esc(v) + '"' + (kind === v ? ' selected' : '') + '>' + esc(l) + '</option>',
      )
      .join('') +
    '</select></label>';
  const filters =
    '<form id="document-filters" class="warehouse-doc-filters">' +
    '<div class="warehouse-status-tabs tabs" role="tablist" aria-label="Trạng thái chứng từ">' +
    states +
    '</div>' +
    '<div class="warehouse-filter-grid">' +
    '<label class="warehouse-filter-field warehouse-search"><span>Tìm kiếm</span><input type="search" name="search" aria-label="Tìm mã phiếu, mã hàng, tên hàng hoặc kho" placeholder="Mã phiếu, mặt hàng, kho..." value="' +
    esc(filter) +
    '"></label>' +
    types +
    '<div class="warehouse-filter-field"><span>Từ ngày</span>' +
    field('', 'from', dateFrom, 'date') +
    '</div>' +
    '<div class="warehouse-filter-field"><span>Đến ngày</span>' +
    field('', 'to', dateTo, 'date') +
    '</div>' +
    '<div class="warehouse-filter-buttons"><button type="submit" class="primary">Tìm kiếm</button>' +
    (filter || dateFrom || dateTo ? b('document-reset', 'Xóa lọc', 'link') : '') +
    '</div>' +
    '</div></form>';
  return card(
    '<div class="warehouse-doc-head"><div><h2>Danh sách chứng từ kho</h2><p class="muted">Tra cứu phiếu nhập, xuất, kiểm kê và chuyển kho</p></div><div class="warehouse-doc-actions">' +
      b('stock-check-new', '+ Kiểm kê', 'primary') +
      b('transfer-new', '+ Chuyển kho') +
      '</div></div>' +
      filters +
      '<div class="warehouse-doc-list-head"><b>Chứng từ</b><span class="muted">' +
      rows.length +
      ' kết quả</span></div>' +
      table(
        ['Số phiếu', 'Ngày', 'Loại', 'Nguồn', 'Trạng thái'],
        rows.map((x) => [
          a(stockDocLink(x.type, x.code), x.code),
          isoDate(x.day),
          docTypes[x.type],
          x.items[0].work
            ? a(workUrl(x.items[0].work), x.items[0].work)
            : esc(x.items[0].source || x.items[0].issue || '—'),
          pill(x.state),
        ]),
      ),
  );
}
function stockDocumentDetail(doc) {
  const row = doc.items[0],
    canValue = !warehouseOnly();
  const canCancel = canCancelStock(doc);
  const source =
    doc.type === 'purchase'
      ? canValue
        ? a(procurementUrl('receipt', doc.code, 'stock'), 'Xem hồ sơ nhập mua')
        : ''
      : row.issue
        ? a(stockDocLink('issue', row.issue.split('~')[0]), row.issue)
        : row.work
          ? a(workUrl(row.work), row.work)
          : row.adjustment
            ? a('27?type=adjustment', row.adjustment)
            : '';
  return pad(
    doc.code,
    meta([
      ['Loại', docTypes[doc.type]],
      ['Ngày', isoDate(doc.day)],
      ...(doc.type === 'transfer'
        ? [
            ['Kho đi', esc(warehouseName(row.from))],
            ['Kho đến', esc(warehouseName(row.to))],
            ['Lý do', esc(row.reason)],
          ]
        : []),
      ['Quản lý chính', 'Kho'],
      ['Trạng thái', pill(doc.state)],
      ...(row.cancelReason
        ? [
            ['Lý do hủy', esc(row.cancelReason)],
            ['Vai trò hủy', esc(row.cancelRole)],
          ]
        : []),
    ]) +
      source +
      table(
        ['Mã hàng', 'Kho', 'Số lượng', ...(canValue ? ['Giá đơn vị', 'Thành tiền'] : [])],
        doc.items.map((x) => [
          esc(x.item || '—'),
          esc(
            x.from
              ? warehouseName(x.from) + ' → ' + warehouseName(x.to)
              : warehouseName(x.warehouse || seedWarehouses[itemBy(x.item)?.group]),
          ),
          x.qty,
          ...(canValue
            ? [
                x.qty && Number.isFinite(x.value) ? money(Math.abs(x.value / x.qty)) : '—',
                Number.isFinite(x.value) ? money(x.value) : '—',
              ]
            : []),
        ]),
        [1, 2, 3],
      ) +
      '<div class="actions">' +
      (doc.state !== 'Đã ghi sổ'
        ? ''
        : doc.type === 'issue'
          ? doc.items
              .map((x) => b('material-return|' + (x.lineId || x.code), 'Nhập lại ' + x.item, 'link'))
              .join('')
          : doc.type === 'count' && !row.resolution
            ? b('stock-resolve|' + doc.code, 'Duyệt xử lý chênh lệch', 'primary')
            : row.resolution && canValue
              ? journalAnchor(row.resolution.code)
              : '') +
      (canCancel ? b('wd-cancel|' + doc.code, 'Hủy phiếu đã ghi sổ', 'warn') : '') +
      a('warehouse-docs?type=' + encodeURIComponent(doc.type) + '&restore=1', 'Quay lại') +
      '</div>',
  );
}
function canCancelStock(doc) {
  return (
    !warehouseOnly() &&
    doc.state === 'Đã ghi sổ' &&
    cancellableWarehouseTypes.has(doc.type) &&
    !doc.items[0].adjustment
  );
}
function stockSequence(code, row) {
  const entry = records.journal.findIndex(
    (x) => x.state === 'Đã ghi sổ' && (x.source === code || x.code === 'JV-' + code),
  );
  return row.sequence ?? (entry < 0 ? null : entry);
}
function isLaterStock(source, code, day, row) {
  if (day !== source.day) return day > source.day;
  const a = stockSequence(source.code, source.items[0]),
    b = stockSequence(code, row);
  // A standalone transfer takes the next journal index without consuming it.
  if (a === null || b === null) return true;
  if (a === b)
    return source.type === 'transfer' && (row.sequence === undefined || code.localeCompare(source.code) > 0);
  return b > a;
}
const stockReceiptLine = (type, row) => type !== 'transfer' && type !== 'issue' && row.qty > 0;
function stockCancelBlockers(doc) {
  const blockers = [];
  const add = (code, href, label) => {
    if (!blockers.some((x) => x.code === code)) blockers.push({ code, href, label });
  };
  const reviewMovements = ['returned', 'transfer', 'kit'].includes(doc.type);
  const postedStock = reviewMovements
    ? stockDocuments().filter((next) => next.code !== doc.code && next.state === 'Đã ghi sổ')
    : [];
  for (const row of doc.items) {
    if (doc.type === 'issue' || doc.type === 'finished' || doc.type === 'returned') {
      for (const run of costRuns.filter((x) => x.work === row.work && periodEnd(x.period) >= doc.day))
        add(
          run.adjustment && journalBy(run.adjustment) ? run.adjustment : row.work,
          run.adjustment && journalBy(run.adjustment)
            ? journalHref(run.adjustment)
            : closeHref('cost', run.period),
          'Lệnh đã tính giá ' + row.work,
        );
    }
    if (doc.type === 'issue')
      for (const ret of materialReturns.filter((x) => !x.cancelled && x.issue === (row.lineId || row.code)))
        add(ret.code, stockDocLink('returned', ret.code), 'Phiếu nhập lại vật tư');
    if (doc.type === 'finished')
      for (const x of salesDeliveries.filter(
        (x) =>
          x.state === 'Đã ghi sổ' &&
          deliveryLines(x).some((line) => productFor(line).code === row.item) &&
          dayKey(x.day) >= doc.day,
      ))
        add(x.code, saleUrl('delivery', x.code), 'Phiếu giao');
    if (doc.type === 'count' && row.resolution)
      add(row.resolution.code, journalHref(row.resolution.code), 'Bút toán xử lý kiểm kê');
    const later = firstStockOutAfter(row.item, doc.day);
    if (later && later.code !== doc.code) add(later.code, later.route, later.label);
    if (reviewMovements) {
      const receiptLine = stockReceiptLine(doc.type, row);
      for (const next of postedStock) {
        const dependsOnStock = next.items.some(
          (item) =>
            item.item === row.item &&
            (!receiptLine || next.type === 'count' || !stockReceiptLine(next.type, item)),
        );
        if (dependsOnStock && isLaterStock(doc, next.code, next.day, next.items[0]))
          add(next.code, stockDocLink(next.type, next.code), docTypes[next.type]);
      }
      for (const delivery of salesDeliveries.filter(
        (x) => x.state === 'Đã ghi sổ' && deliveryLines(x).some((line) => productFor(line).code === row.item),
      ))
        if (isLaterStock(doc, delivery.code, dayKey(delivery.day), delivery))
          add(delivery.code, saleUrl('delivery', delivery.code), 'Phiếu giao');
      if (doc.type === 'kit' || receiptLine)
        for (const run of costAdjustments.filter(
          (x) =>
            x.day >= doc.day &&
            (x.inventory.has(row.item) ||
              [...x.delivery.keys()].some((key) => key.split('|')[1] === row.item)),
        ))
          add(
            run.code,
            journalBy(run.code) ? journalHref(run.code) : closeHref('cost', postingPeriod(run.day)),
            'Chứng từ tính giá',
          );
    }
  }
  return blockers;
}
function cancelStockDocument(code) {
  const doc = stockDocuments().find((x) => x.code === code);
  if (!doc || !canCancelStock(doc)) return;
  const closingEntry = postingPeriod(doc.day) === closingPeriod ? currentClosing() : null;
  const blocked = stockCancelBlockers(doc);
  if (closingEntry)
    blocked.push({
      code: closingEntry.code,
      href: journalHref(closingEntry.code),
      label: 'Bút toán kết chuyển',
    });
  if (periodLocked(doc.day) || blocked.length) {
    const links = blocked.map((x) => '<li>' + esc(x.label) + ' ' + a(x.href, x.code) + '</li>').join('');
    return openModal(
      'Chưa thể hủy ' + code,
      (periodLocked(doc.day)
        ? note('Kỳ đã khóa. ' + a(closeHref('24', postingPeriod(doc.day)), 'Mở quản lý khóa sổ'))
        : '') + (links ? '<ul>' + links + '</ul>' : ''),
      () => '',
      'Đóng',
    );
  }
  return openModal(
    'Hủy phiếu kho · ' + code,
    textArea('Lý do hủy', 'reason'),
    (data) => {
      const reason = String(data.get('reason') || '').trim();
      if (!reason) return 'Nhập lý do hủy.';
      if (
        warehouseOnly() ||
        periodLocked(doc.day) ||
        stockCancelBlockers(doc).length ||
        doc.items[0].cancelled
      )
        return 'Trạng thái hoặc chứng từ liên quan đã thay đổi. Mở lại phiếu để kiểm tra.';
      if (postingPeriod(doc.day) === closingPeriod && currentClosing())
        return 'Hủy bút toán kết chuyển của kỳ trước khi hủy phiếu kho.';
      for (const row of doc.items) {
        row.cancelled = true;
        row.cancelReason = reason;
        row.cancelRole = roleLabels[demoRole];
      }
      for (const entry of linkedJournal(code))
        if (entry.state === 'Đã ghi sổ') {
          entry.state = 'Đã hủy';
          entry.log = 'Hủy phiếu ' + code + ' · ' + roleLabels[demoRole] + ' · ' + reason;
        }
      const work = workOrder(doc.items[0].work);
      if (doc.type === 'finished' && work) {
        for (const x of work.outputs)
          x.completed = finishedReceipts
            .filter((r) => !r.cancelled && r.work === work.code && r.item === x.item)
            .reduce((n, r) => n + r.qty, 0);
        work.state = 'Đang sản xuất';
        delete work.done;
      }
      touchClosing(doc.day);
      say('Đã hủy ' + code);
      return '';
    },
    'Hủy phiếu',
  );
}
const stockAccountRoot = (group) => (group === materialGroup ? '152' : '155');
const stockAccount = (group) =>
  configuredAccount(group === materialGroup ? 'materialStockAccount' : 'finishedStockAccount');
const stockLedger = (group) =>
  chartAccounts
    .filter((x) => x.code.startsWith(stockAccountRoot(group)))
    .reduce((n, x) => n + postedAmount(x.code), 0);
const seedWarehouses = { 'Vật tư': 'KHO-NL', 'Thành phẩm': 'KHO-TP' };
const warehouseKinds = { 'Vật tư': 'Kho nguyên liệu', 'Thành phẩm': 'Kho thành phẩm' };
const itemPages = { materials: 'Vật tư', products: 'Thành phẩm' };
const warehouseBy = (id) => catalogMatch('warehouse', id);
const warehouseOptions = (group) =>
  catalogSpec.warehouse.rows
    .filter((w) => w.active && (!group || w.group === group))
    .map((w) => [w.code, w.name]);
const typeDefault = (group) =>
  catalogSpec.warehouse.rows.find((w) => w.group === group && w.default && w.active);
const defaultWarehouse = (item) => validWarehouse(item?.warehouse, item?.group) || typeDefault(item?.group);
function validWarehouse(id, group) {
  const wh = warehouseBy(id);
  return wh?.active && wh.group === group ? wh : null;
}
function warehouseField(label, name, group, item, selected, depends = '') {
  const options = optionsField(
    label,
    name,
    warehouseOptions(group),
    warehouseBy(selected)?.code || defaultWarehouse(item)?.code || typeDefault(group)?.code,
  );
  return depends ? options.replace('<select ', '<select data-item-source="' + depends + '" ') : options;
}
const warehouseFor = (data, field, item) =>
  data.get(field) ? validWarehouse(data.get(field), item?.group) : defaultWarehouse(item);
const warehouseName = (id) => warehouseBy(id)?.name || '—';
function warehouseUsed(w) {
  return (
    catalogSpec.items.rows.some((x) => x.openQty && openingWarehouse(x) === w.code) ||
    stockDocuments().some((d) =>
      d.items.some((x) => [x.warehouse, x.from, x.to].some((id) => warehouseBy(id)?.code === w.code)),
    ) ||
    salesDeliveries.some(
      (x) => (warehouseBy(x.warehouse)?.code || seedWarehouses[finishedGroup]) === w.code,
    ) ||
    stockReturns.some((x) => warehouseBy(x.warehouse)?.code === w.code)
  );
}
function warehouseStockRows(group, day = todayKey()) {
  return catalogSpec.items.rows
    .filter((x) => x.group === group)
    .flatMap((item) => inventoryByWarehouse(item.code, day).map((stock) => ({ item, ...stock })));
}
function warehouseCatalog() {
  const { rows, toolbar } = searchList(
    'warehouses',
    catalogSpec.warehouse.rows,
    'Tìm theo mã hoặc tên kho',
    (w) => [w.code, w.name, ...(w.aliases || [])],
    [
      ['kind', 'Tất cả loại kho', Object.entries(warehouseKinds), (w) => w.group],
      [
        'status',
        'Tất cả trạng thái',
        [
          ['active', 'Đang sử dụng'],
          ['inactive', 'Ngừng sử dụng'],
        ],
        (w) => (w.active ? 'active' : 'inactive'),
      ],
    ],
  );
  return card(
    toolbar +
      table(
        ['Mã', 'Tên kho', 'Loại kho', 'Mặc định của loại', 'Trạng thái', 'Thao tác'],
        rows.map((w) => [
          esc(w.code),
          esc(w.name),
          warehouseKinds[w.group],
          w.default ? 'Có' : '—',
          pill(w.active ? 'Đang sử dụng' : 'Ngừng sử dụng'),
          b('catalog-edit-warehouse|' + w.code, 'Sửa', 'link') +
            (w.active
              ? w.default
                ? ''
                : b('warehouse-stop|' + w.code, 'Ngừng sử dụng', 'link') +
                  (!warehouseUsed(w) ? b('warehouse-remove|' + w.code, 'Xóa', 'warn') : '')
              : b('warehouse-start|' + w.code, 'Sử dụng lại', 'link')),
        ]),
      ),
  );
}
function editWarehouse(w) {
  const fixed = w && warehouseUsed(w);
  return openModal(
    w ? 'Sửa kho' : 'Thêm kho',
    grid(
      field('Tên kho', 'name', w?.name || ''),
      fixed
        ? meta([['Loại kho', warehouseKinds[w.group]]])
        : optionsField('Loại kho (bắt buộc)', 'group', Object.entries(warehouseKinds), w?.group),
      select('Đặt làm kho mặc định của loại', 'default', ['Không', 'Có'], w?.default ? 'Có' : 'Không'),
    ),
    (data) => {
      const name = String(data.get('name') || '').trim(),
        group = w && warehouseUsed(w) ? w.group : data.get('group');
      if (
        !name ||
        !Object.hasOwn(warehouseKinds, group) ||
        catalogSpec.warehouse.rows.some(
          (x) =>
            x !== w &&
            [x.name, ...(x.aliases || [])].some((y) => normalizedSearch(y) === normalizedSearch(name)),
        )
      )
        return 'Nhập tên kho chưa dùng và chọn loại kho.';
      if (w?.default && (group !== w.group || data.get('default') !== 'Có'))
        return 'Đặt kho khác làm mặc định của loại trước.';
      const activate = w?.active ?? true,
        makeDefault = activate && (data.get('default') === 'Có' || !typeDefault(group));
      if (makeDefault)
        for (const other of catalogSpec.warehouse.rows) if (other.group === group) other.default = false;
      if (w) {
        if (w.name !== name) w.aliases = [...new Set([...(w.aliases || []), w.name])];
        Object.assign(w, { name, group, default: makeDefault });
      } else
        catalogSpec.warehouse.rows.push({
          code: 'KHO-' + String(++warehouseSequence).padStart(3, '0'),
          name,
          group,
          default: makeDefault,
          active: true,
        });
      say('Đã lưu kho ' + name);
      return '';
    },
    'Lưu kho',
  );
}
let warehouseSequence = 0;
function warehouseLifecycle(action, code) {
  const w = warehouseBy(code);
  if (!w || warehouseOnly()) return;
  const impact = () =>
    w.default
      ? 'Chọn kho mặc định khác trước.'
      : warehouseStockRows(w.group).some((x) => x.warehouse.code === code && x.qty !== 0)
        ? 'Kho còn tồn. Chuyển hoặc xử lý hết tồn trước.'
        : action === 'remove' && warehouseUsed(w)
          ? 'Kho đã có chứng từ hoặc số dư đầu kỳ. Chỉ có thể ngừng sử dụng.'
          : '';
  const error = action === 'start' ? '' : impact();
  if (error) return openModal('Chưa thể thay đổi kho', note(esc(error)), () => '', 'Đóng');
  return openModal(
    (action === 'start' ? 'Sử dụng lại' : action === 'stop' ? 'Ngừng sử dụng' : 'Xóa') + ' · ' + w.name,
    '',
    () => {
      const reason = action === 'start' ? '' : impact();
      if (reason) return reason;
      if (action === 'remove') catalogSpec.warehouse.rows.splice(catalogSpec.warehouse.rows.indexOf(w), 1);
      else w.active = action === 'start';
      say('Đã cập nhật danh mục kho.');
      return '';
    },
  );
}
const openingWarehouse = (item) => item.openWarehouse || seedWarehouses[item.group];
function inventoryByWarehouse(code, day = todayKey()) {
  const item = itemBy(code);
  if (!item) return [];
  const qty = new Map(
    catalogSpec.warehouse.rows.filter((w) => w.group === item.group).map((w) => [w.code, 0]),
  );
  const add = (id, n) => {
    if (qty.has(id)) qty.set(id, normQty(qty.get(id) + n));
  };
  const fallback = seedWarehouses[item.group];
  const inScope = (x) => !x.cancelled && dayKey(x.day) <= day;
  const move = (row, sign = 1) => add(warehouseBy(row.warehouse)?.code || fallback, sign * row.qty);
  // Phân bổ tồn đầu kỳ theo nhiều kho nếu có; tổng số lượng vẫn bằng tồn đầu kỳ của mã hàng.
  if (Array.isArray(item.openingBreakdown) && item.openingBreakdown.length) {
    for (const opening of item.openingBreakdown) add(opening.warehouse, opening.qty);
  } else add(openingWarehouse(item), item.openQty || 0);
  for (const row of receipts)
    if (row.state === 'Đã ghi sổ' && inScope(row))
      for (const line of receiptLines(row))
        if (catalogMatch('items', line.item)?.code === code)
          move({ ...line, warehouse: line.warehouse || row.warehouse });
  for (const row of finishedReceipts) if (inScope(row) && row.item === code) move(row);
  for (const row of stockReturns) if (inScope(row) && row.item === code) move(row);
  for (const row of materialReturns) if (inScope(row) && row.item === code) move(row);
  for (const row of stockChecks) if (inScope(row) && row.item === code) move(row);
  for (const row of productionIssues) if (inScope(row) && row.item === code) move(row, -1);
  for (const row of salesDeliveries)
    if (row.state === 'Đã ghi sổ' && inScope(row))
      for (const line of deliveryLines(row))
        if (productFor(line).code === code) move({ ...line, warehouse: row.warehouse }, -1);
  for (const row of kitMovements) if (inScope(row) && row.item === code) move(row);
  for (const row of stockTransfers)
    if (inScope(row) && row.item === code) {
      add(row.from, -row.qty);
      add(row.to, row.qty);
    }
  const rows = [...qty].map(([id, qty]) => ({ warehouse: warehouseBy(id), qty, value: 0 }));
  const total = inventory(code, day);
  if (total.qty) {
    const values = apportion(
      total.value,
      rows.map((w) => w.qty),
    );
    if (values) rows.forEach((w, i) => (w.value = values[i]));
  } else if (total.value) rows.find((w) => w.warehouse.code === openingWarehouse(item)).value = total.value;
  return rows;
}
const quantityAt = (code, id, day) =>
  inventoryByWarehouse(code, day).find((x) => x.warehouse.code === id)?.qty || 0;
// Tất cả kho: 1 dòng / mã hàng; lọc kho cụ thể: chỉ số liệu của kho được chọn.
function stockByWarehouse() {
  const group = tab === 1 ? finishedGroup : materialGroup;
  const requested = routeParams().get('warehouse') || '';
  const selected = warehouseBy(requested)?.group === group ? requested : '';
  const scope = tab === 1 ? 'stock-products' : 'stock-materials';
  const saved = listQueries.get(scope) || {};
  const currentWarehouse = catalogSpec.warehouse.rows.some(
    (w) => w.group === group && w.code === saved.warehouse,
  )
    ? saved.warehouse
    : saved.warehouse === ''
      ? ''
      : selected;
  const perWarehouse = Boolean(currentWarehouse);
  const source = warehouseStockRows(group);
  const displayRows = perWarehouse
    ? source.filter((x) => x.warehouse.code === currentWarehouse).map((x) => ({ ...x, warehouseCount: 1 }))
    : catalogSpec.items.rows
        .filter((x) => x.group === group)
        .map((item) => {
          const locations = source.filter((x) => x.item.code === item.code);
          const qty = normQty(locations.reduce((sum, x) => sum + x.qty, 0));
          const amount = locations.reduce((sum, x) => sum + x.value, 0);
          return {
            item,
            qty,
            value: amount,
            warehouseCount: locations.filter((x) => x.qty !== 0 || x.value !== 0).length,
          };
        });
  const { rows, toolbar } = searchList(
    scope,
    displayRows,
    'Tìm theo mã hoặc tên hàng',
    (x) => [x.item.code, x.item.name, ...(x.item.aliases || [])],
    [
      [
        'warehouse',
        'Tất cả kho',
        catalogSpec.warehouse.rows.filter((w) => w.group === group).map((w) => [w.code, w.name]),
        () => currentWarehouse,
      ],
      [
        'balance',
        'Tất cả mức tồn',
        [
          ['in', 'Có tồn'],
          ['out', 'Hết tồn'],
        ],
        (x) => (x.qty > 0 ? 'in' : 'out'),
      ],
    ],
    { warehouse: selected, balance: 'in' },
  );
  const showValue = !warehouseOnly();
  const cols = [
    'Mã',
    'Tên',
    perWarehouse ? 'Kho' : 'Số kho',
    'ĐVT',
    'Tồn',
    ...(showValue ? ['Giá trị', 'Bình quân'] : []),
    ...(!perWarehouse ? ['Chi tiết'] : []),
  ];
  const body = rows.map((x) => [
    esc(x.item.code),
    !perWarehouse ? b('stock-detail|' + x.item.code, x.item.name, 'link') : esc(x.item.name),
    perWarehouse ? esc(x.warehouse.name) : x.warehouseCount,
    esc(x.item.extra),
    x.qty,
    ...(showValue ? [money(x.value), x.qty ? money(x.value / x.qty) : '—'] : []),
    ...(!perWarehouse ? [b('stock-detail|' + x.item.code, 'Xem theo kho', 'link')] : []),
  ]);
  return card(
    tabs(['Nguyên liệu', 'Thành phẩm'], tab) +
      toolbar +
      '<div class="stock-view-note">' +
      (perWarehouse
        ? 'Đang xem số lượng và giá trị tại một kho.'
        : 'Đang tổng hợp theo mã hàng trên tất cả kho. Chọn tên hàng để xem phân bổ từng kho.') +
      '</div>' +
      table(cols, body, [2, 4, ...(showValue ? [5, 6] : [])]),
  );
}
function stockDetail(code) {
  const item = itemBy(code);
  if (!item) return;
  const rows = inventoryByWarehouse(code).filter((x) => x.qty !== 0 || x.value !== 0);
  const totalQty = normQty(rows.reduce((s, x) => s + x.qty, 0));
  const totalValue = rows.reduce((s, x) => s + x.value, 0);
  const showValue = !warehouseOnly();
  const data = rows.map((x) => [
    esc(x.warehouse.name),
    x.qty + ' ' + esc(item.extra),
    ...(showValue ? [money(x.value), x.qty ? money(x.value / x.qty) : '—'] : []),
  ]);
  data.push([
    '<b>Tổng cộng</b>',
    '<b>' + totalQty + ' ' + esc(item.extra) + '</b>',
    ...(showValue
      ? ['<b>' + money(totalValue) + '</b>', '<b>' + (totalQty ? money(totalValue / totalQty) : '—') + '</b>']
      : []),
  ]);
  const content =
    '<div class="stock-detail-heading"><strong>' +
    esc(item.name) +
    '</strong><small>Mã: ' +
    esc(item.code) +
    '</small></div>' +
    '<p class="muted">Số liệu tồn kho theo từng kho. Các kho không có tồn không được liệt kê.</p>' +
    table(['Kho', 'Số lượng', ...(showValue ? ['Giá trị tồn', 'Đơn giá bình quân'] : [])], data, [
      1,
      ...(showValue ? [2, 3] : []),
    ]);
  openModal('Chi tiết tồn kho theo kho', content, () => '', 'Đóng');
}

function transferStock() {
  return openModal(
    'Chuyển kho',
    grid(
      field('Ngày', 'day', sampleDate, 'date'),
      optionsField(
        'Mã hàng',
        'item',
        catalogSpec.items.rows.map((x) => [x.code, x.code + ' · ' + x.name]),
      ),
      optionsField('Kho đi', 'from', []),
      optionsField('Kho đến', 'to', []),
      field('Số lượng', 'qty', '', 'number'),
    ) + textArea('Lý do', 'reason'),
    (data) => {
      const day = data.get('day'),
        error = postingDateError(day);
      if (error) return error;
      const item = itemBy(data.get('item')),
        from = warehouseFor(data, 'from', item),
        to = validWarehouse(data.get('to'), item?.group);
      const qty = Number(data.get('qty')),
        reason = String(data.get('reason') || '').trim();
      if (
        !item ||
        !from ||
        !to ||
        from === to ||
        !reason ||
        !Number.isFinite(qty) ||
        qty <= 0 ||
        normQty(qty) !== qty ||
        (item.group === finishedGroup && !Number.isInteger(qty))
      )
        return 'Chọn mã hàng, hai kho khác nhau cùng loại, số lượng và lý do.';
      if (qty > quantityAt(item.code, from.code, day)) return 'Số lượng chuyển vượt tồn kho đi.';
      if (stockOutAfter(item.code, day)) return 'Có chứng từ xuất hoặc kiểm kê sau ngày chuyển của mã hàng.';
      const code = 'CK-' + String(stockTransfers.length + 1).padStart(4, '0');
      stockTransfers.push({
        code,
        day,
        item: item.code,
        qty,
        from: from.code,
        to: to.code,
        reason,
        sequence: records.journal.length,
      });
      touchClosing(day);
      say('Đã ghi phiếu ' + code + '.');
      return '';
    },
    'Ghi chuyển kho',
  );
}
function updateWarehouseFields(form, target) {
  const put = (control, choices, current) => {
    if (!control) return;
    control.replaceChildren(new Option('Chọn', ''), ...choices.map(([id, label]) => new Option(label, id)));
    control.value = current || '';
  };
  for (const control of form.querySelectorAll('select[data-item-source]')) {
    if (control.dataset.itemSource !== target.name) continue;
    const item = itemBy(target.value);
    put(control, item ? warehouseOptions(item.group) : [], defaultWarehouse(item)?.code);
  }
  const itemControl = form.elements.namedItem('item'),
    from = form.elements.namedItem('from'),
    to = form.elements.namedItem('to');
  if (itemControl && from && to && ['item', 'from'].includes(target.name)) {
    const item = itemBy(itemControl.value),
      options = item ? warehouseOptions(item.group) : [];
    if (target.name === 'item') put(from, options, defaultWarehouse(item)?.code);
    put(
      to,
      options.filter(([id]) => id !== from.value),
      '',
    );
  }
  const warehouse = form.elements.namedItem('warehouse');
  if (itemControl && warehouse?.dataset.countWarehouse && target.name === 'warehouse') {
    const group = warehouseBy(target.value)?.group;
    const items = catalogSpec.items.rows.filter((x) => x.group === group);
    put(
      itemControl,
      items.map((x) => [x.code, x.code + ' · ' + x.name]),
      '',
    );
  }
}
