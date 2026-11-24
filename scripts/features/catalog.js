const catalogSpec = {
  items: {
    prefix: 'HH',
    label: 'hàng hóa',
    name: 'Tên hàng',
    extra: 'Đơn vị tính',
    rows: [
      {
        code: 'NLG-0000001',
        name: 'Gỗ Óc chó xẻ sấy',
        extra: 'm³',
        group: 'Vật tư',
        wood: 'Óc chó',
        openQty: 2,
        openValue: 10000000,
        openingBreakdown: [
          { warehouse: 'KHO-NL', qty: 1 },
          { warehouse: 'KHO-BAI', qty: 1 },
        ],
      },
      {
        code: 'NLG-0000002',
        name: 'Gỗ Căm xe xẻ sấy',
        extra: 'm³',
        group: 'Vật tư',
        wood: 'Căm xe',
        warehouse: 'KHO-BAI',
        openWarehouse: 'KHO-BAI',
        openQty: 1,
        openValue: 4000000,
      },
      {
        code: 'VCN-0000004',
        name: 'Ván MDF chống ẩm',
        extra: 'Tấm',
        group: 'Vật tư',
        dimensions: '18 × 1220 × 2440 mm',
        alt: 'Tấm cắt 1/2',
        factor: 0.5,
        openQty: 150,
        openValue: 60000000,
      },
      { code: 'VT-PK', name: 'Bộ phụ kiện', extra: 'Bộ', group: 'Vật tư', openQty: 40, openValue: 2800000 },
      { code: 'VT-SON', name: 'Sơn PU', extra: 'Lít', group: 'Vật tư', openQty: 20, openValue: 1100000 },
      {
        code: 'TP-BAN-MDF',
        name: 'Bàn làm việc ván MDF',
        extra: 'Cái',
        group: 'Thành phẩm',
        dimensions: '1200 × 600 mm',
        color: 'Nâu',
        wood: '',
        rate: '10',
        weight: 2,
        openQty: 18,
        openValue: 10800000,
        bom: [
          { item: 'VCN-0000004', qty: 1 },
          { item: 'VT-PK', qty: 1 },
          { item: 'VT-SON', qty: 0.5 },
        ],
      },
      {
        code: 'TP-GHE-GO',
        name: 'Ghế gỗ',
        extra: 'Cái',
        group: 'Thành phẩm',
        rate: '10',
        weight: 1,
        openQty: 12,
        openValue: 3600000,
        bom: [{ item: 'NLG-0000001', qty: 0.04 }],
      },
      {
        code: 'TP-BO-AN',
        name: 'Bộ bàn ăn 6 ghế',
        extra: 'Bộ',
        group: 'Thành phẩm',
        rate: '10',
        kit: [
          { item: 'TP-BAN-MDF', qty: 1 },
          { item: 'TP-GHE-GO', qty: 6 },
        ],
      },
    ],
  },
  warehouse: {
    prefix: 'KHO',
    label: 'kho',
    name: 'Tên kho',
    rows: [
      { code: 'KHO-NL', name: 'Kho nguyên liệu', group: 'Vật tư', default: true, active: true },
      { code: 'KHO-TP', name: 'Kho thành phẩm', group: 'Thành phẩm', default: true, active: true },
      { code: 'KHO-BAI', name: 'Bãi gỗ xẻ', group: 'Vật tư', default: false, active: true },
    ],
  },
  suppliers: {
    prefix: 'NCC',
    label: 'nhà cung cấp',
    name: 'Tên nhà cung cấp',
    extra: 'Mã số thuế',
    rows: [
      { code: 'NCC-001', name: 'Công ty TNHH Tân Hoàng Phát', extra: '', sellerType: 'Doanh nghiệp' },
      { code: 'NCC-002', name: 'Hộ trồng rừng Minh An', extra: '', sellerType: 'Hộ / cá nhân' },
    ],
  },
  customers: {
    prefix: 'KH',
    label: 'khách hàng',
    name: 'Tên khách hàng',
    extra: 'Mã số thuế',
    rows: [{ code: 'KH-001', name: 'Nội thất An Phú', extra: '', customerType: 'Doanh nghiệp' }],
  },
  lenders: {
    prefix: 'BCV',
    label: 'bên cho vay',
    name: 'Tên bên cho vay',
    extra: 'MST / Số định danh (nếu có)',
    rows: [{ code: 'BCV-001', name: 'Ngân hàng A', extra: '' }],
  },
  contributors: {
    prefix: 'NGV',
    label: 'người góp vốn',
    name: 'Tên người góp vốn',
    extra: 'MST / Số định danh (nếu có)',
    rows: [],
  },
};
const partyPicker = (key, label, name, value = '', config = {}) => {
  const rows = catalogSpec[key].rows,
    matched = catalogMatch(key, value),
    locked = Boolean(config.locked);
  const selectedValue = locked ? value || '' : matched?.name || value || '';
  const options =
    '<option value="">Chọn ' +
    esc(catalogSpec[key].label) +
    '</option>' +
    rows
      .map(
        (row) =>
          '<option value="' +
          esc(row.name) +
          '"' +
          (row.name === selectedValue ? ' selected' : '') +
          '>' +
          esc(row.code + ' · ' + row.name) +
          '</option>',
      )
      .join('');
  return (
    '<div class="party-picker"><label>' +
    label +
    '<select name="' +
    name +
    '" data-party-select="' +
    key +
    '"' +
    (locked ? ' disabled' : '') +
    '>' +
    options +
    '</select></label>' +
    (locked
      ? '<input type="hidden" name="' +
        name +
        '" value="' +
        esc(value) +
        '"><small class="party-source-note">Được lấy từ chứng từ nguồn.</small>'
      : '<button type="button" class="party-add-button" data-party-add="' + key + '">+ Thêm</button>') +
    '</div>'
  );
};
const catalogInput = (key, label, name, value = '') =>
  ['suppliers', 'customers'].includes(key)
    ? partyPicker(key, label, name, value)
    : '<label>' +
      label +
      '<input name="' +
      name +
      '" list="catalog-' +
      key +
      '" value="' +
      esc(value) +
      '"><datalist id="catalog-' +
      key +
      '">' +
      catalogSpec[key].rows
        .filter((row) => key !== 'items' || row.group === materialGroup)
        .map((row) => '<option value="' + esc(row.name) + '"></option>')
        .join('') +
      '</datalist></label>';
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-party-add]');
  if (!button) return;
  const key = button.dataset.partyAdd,
    target = button.closest('.party-picker')?.querySelector('select[data-party-select]');
  if (target) editCatalog(key, '', target);
});
function editCatalog(key, code = '', target = null) {
  const spec = catalogSpec[key];
  if (!spec) return;
  const row = spec.rows.find((x) => x.code === code);
  if (key === 'items') return editItem(row);
  if (key === 'warehouse') return editWarehouse(row);
  const dialog = $('dialog');
  const nested = Boolean(target && dialog.open);
  if (nested) modalReturnState = snapshotModal(target);
  const body = grid(
    field(spec.name, 'name', row?.name || ''),
    field(spec.extra, 'extra', row?.extra || ''),
    ...(key === 'customers'
      ? [select('Loại khách', 'customerType', ['Doanh nghiệp', 'Cá nhân'], row?.customerType)]
      : key === 'suppliers'
        ? [select('Loại người bán', 'sellerType', ['Doanh nghiệp', 'Hộ / cá nhân'], row?.sellerType)]
        : []),
  );
  setModalContent(
    (row ? 'Sửa ' : 'Tạo ') + spec.label,
    body,
    (data) => {
      const name = escToText(data.get('name')),
        extra = escToText(data.get('extra'));
      if (!name) return 'Nhập tên để lưu.';
      const customerType = data.get('customerType'),
        sellerType = data.get('sellerType');
      if (key === 'customers' && customerType === 'Doanh nghiệp' && !validTaxId(extra))
        return 'Nhập MST hợp lệ cho khách doanh nghiệp.';
      if (
        spec.rows.some(
          (x) =>
            x !== row &&
            [x.name, ...(x.aliases || [])].some((old) => normalizedSearch(old) === normalizedSearch(name)),
        )
      )
        return 'Tên này đã có trong danh mục.';
      if (row) {
        if (row.name !== name) row.aliases = [...new Set([...(row.aliases || []), row.name])];
        Object.assign(row, { name, extra, customerType, sellerType });
      } else {
        const next = Math.max(0, ...spec.rows.map((item) => Number(item.code.split('-').at(-1)) || 0)) + 1;
        const code = spec.prefix + '-' + String(next).padStart(3, '0');
        spec.rows.push({ code, name, extra, customerType, sellerType });
        if (nested) pendingPartySelection = { key, name, code };
        else if (target) {
          target.add(new Option(code + ' · ' + name, name));
          target.value = name;
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (!target) say((row ? 'Đã cập nhật ' : 'Đã tạo ') + name + '.');
      return '';
    },
    target ? 'Lưu vào danh mục' : 'Lưu',
  );
  if (!nested) dialog.showModal();
}

const stockReturns = [];
const validTaxId = (value) => /^\d{10}(?:-\d{3})?$/.test(String(value || '').trim());
function customerTaxError(value) {
  const customer = catalogMatch('customers', value);
  if (!customer?.customerType) return 'Xác định loại khách trước khi phát hành.';
  return customer.customerType === 'Doanh nghiệp' && !validTaxId(customer.extra)
    ? 'Khách doanh nghiệp thiếu mã số thuế hợp lệ. Cập nhật danh mục trước khi phát hành.'
    : '';
}
function itemsView(group) {
  const materials = group === materialGroup;
  const items = catalogSpec.items.rows.filter((x) => x.group === group);
  const scope = materials ? 'materials' : 'products';
  const whChoices = catalogSpec.warehouse.rows.filter((x) => x.group === group).map((x) => [x.code, x.name]);
  const savedWarehouse = listQueries.get(scope)?.warehouse || '';
  const selectedWarehouse = whChoices.some(([code]) => code === savedWarehouse) ? savedWarehouse : '';
  const locations = (item) =>
    inventoryByWarehouse(item.code).filter((loc) => loc.qty !== 0 || loc.value !== 0);
  const warehouseCell = (item) => {
    const rows = locations(item).filter(
      (loc) => !selectedWarehouse || loc.warehouse.code === selectedWarehouse,
    );
    if (!rows.length) return '<span class="muted">Chưa có tồn</span>';
    if (selectedWarehouse) return esc(rows[0].warehouse.name);
    if (rows.length === 1) return esc(rows[0].warehouse.name);
    return b('stock-detail|' + item.code, rows.length + ' kho · Xem chi tiết', 'link');
  };
  const quantityCell = (item) => {
    const rows = locations(item).filter(
      (loc) => !selectedWarehouse || loc.warehouse.code === selectedWarehouse,
    );
    return normQty(rows.reduce((sum, row) => sum + row.qty, 0)) + ' ' + esc(item.extra);
  };
  const { rows, toolbar } = searchList(
    scope,
    items,
    'Tìm theo mã hoặc tên hàng',
    (x) => [x.code, x.name, ...(x.aliases || [])],
    [
      [
        'warehouse',
        'Tất cả kho',
        whChoices,
        (x) =>
          selectedWarehouse && locations(x).some((loc) => loc.warehouse.code === selectedWarehouse)
            ? selectedWarehouse
            : '',
      ],
      ['status', 'Tất cả trạng thái', itemStatuses, itemStatus],
      materials
        ? ['wood', 'Tất cả loại gỗ', columnChoices(items.map((x) => x.wood)), (x) => x.wood]
        : ['tax', 'Tất cả thuế suất GTGT', vatRates, (x) => x.rate],
    ],
  );
  const description =
    '<div class="catalog-warehouse-note">' +
    (selectedWarehouse
      ? 'Đang xem số lượng hàng hóa tại kho đã chọn.'
      : 'Mỗi mã hàng hiển thị một dòng. Nếu hàng nằm tại nhiều kho, chọn “Xem chi tiết” để xem phân bổ theo kho.') +
    '</div>';
  return card(
    toolbar +
      description +
      table(
        [
          'Mã',
          'Tên',
          'Kho',
          'ĐVT',
          ...(materials ? ['Loại gỗ'] : ['Thuế suất GTGT']),
          'Số lượng',
          'Trạng thái',
          'Thao tác',
        ],
        rows.map((x) => [
          esc(x.code),
          esc(x.name),
          warehouseCell(x),
          esc(x.extra),
          ...(materials ? [esc(x.wood || '—')] : [esc(vatRates.find(([v]) => v === x.rate)?.[1] || '—')]),
          quantityCell(x),
          pill(x.active === false ? 'Ngừng sử dụng' : 'Đang dùng', x.active === false ? '' : 'good'),
          b('catalog-edit-items|' + x.code, 'Sửa', 'link'),
        ]),
      ),
  );
}
function editItem(row, group = row?.group) {
  if (!group) return;
  const rates = vatRates.map(([v, l]) => [v, l]),
    materials = group === materialGroup;
  const materialFields = [
    field('Loại gỗ', 'wood', row?.wood || ''),
    field('ĐVT phụ', 'alt', row?.alt || ''),
    field('Hệ số về ĐVT cơ sở', 'factor', row?.factor || '', 'number'),
  ];
  const productFields = [
    optionsField(
      'Mã gốc của biến thể (tùy chọn)',
      'variantOf',
      catalogSpec.items.rows
        .filter((x) => x.group === finishedGroup && x !== row && !x.variantOf && !x.kit)
        .map((x) => [x.code, x.code + ' · ' + x.name]),
      row?.variantOf,
    ),
    field('Màu', 'color', row?.color || ''),
    optionsField('Thuế suất GTGT mặc định', 'rate', rates, row?.rate || '10'),
    field('Trọng số định mức', 'weight', row?.weight || '', 'number'),
  ];
  return openModal(
    row ? 'Sửa mã hàng' : materials ? 'Thêm nguyên liệu' : 'Thêm thành phẩm',
    grid(
      field('Tên hàng', 'name', row?.name || ''),
      optionsField('Trạng thái', 'itemStatus', itemStatuses, itemStatus(row || {})),
      field('ĐVT cơ sở', 'extra', row?.extra || ''),
      field('Quy cách / Kích thước', 'dimensions', row?.dimensions || ''),
      ...(materials ? materialFields : productFields),
    ),
    (data) => {
      const name = String(data.get('name') || '').trim(),
        extra = String(data.get('extra') || '').trim();
      const alt = group === materialGroup ? String(data.get('alt') || '').trim() : '',
        factor = alt ? Number(data.get('factor')) : 0;
      const rate = group === finishedGroup ? data.get('rate') : '',
        weight = group === finishedGroup ? Number(data.get('weight')) || 0 : 0;
      if (
        !name ||
        !extra ||
        ![materialGroup, finishedGroup].includes(group) ||
        catalogSpec.items.rows.some(
          (x) =>
            x !== row &&
            [x.name, ...(x.aliases || [])].some((n) => normalizedSearch(n) === normalizedSearch(name)),
        )
      )
        return 'Điền tên riêng, nhóm và đơn vị tính.';
      if (alt && (!Number.isFinite(factor) || factor <= 0)) return 'ĐVT phụ cần hệ số quy đổi lớn hơn 0.';
      if (
        weight < 0 ||
        !Number.isFinite(weight) ||
        (group === finishedGroup && !vatRates.some(([x]) => x === rate))
      )
        return 'Kiểm tra trọng số định mức và thuế suất.';
      const variantOf = group === finishedGroup ? data.get('variantOf') || '' : '';
      if (
        variantOf &&
        (!itemBy(variantOf) || itemBy(variantOf) === row || itemBy(variantOf).variantOf || row?.kit)
      )
        return 'Mã gốc của biến thể không hợp lệ.';
      const item = {
        name,
        extra,
        group,
        active:
          data.get('itemStatus') === 'inactive'
            ? false
            : data.get('itemStatus') === 'active'
              ? true
              : row?.active !== false,
        variantOf,
        dimensions: String(data.get('dimensions') || '').trim(),
        color: String(data.get('color') || '').trim(),
        wood: String(data.get('wood') || '').trim(),
        alt,
        factor,
        rate,
        weight,
      };
      if (row) {
        if (name !== row.name) row.aliases = [...new Set([...(row.aliases || []), row.name])];
        Object.assign(row, item);
      } else
        catalogSpec.items.rows.push({
          ...item,
          code:
            (group === materialGroup ? 'VT-' : 'TP-') +
            String(catalogSpec.items.rows.length + 1).padStart(4, '0'),
        });
      say('Đã lưu mã hàng.');
      return '';
    },
    'Lưu mã hàng',
  );
}
function productionSettings() {
  const kit = routeParams().get('mode') === 'kit';
  return (
    card(
      '<nav class="workflow-tabs" aria-label="Cấu hình sản xuất"><a href="#bom" ' +
        (!kit ? 'aria-current="page"' : '') +
        '>Định mức</a>' +
        '<a href="#bom?mode=kit" ' +
        (kit ? 'aria-current="page"' : '') +
        '>Cấu phần bộ</a></nav>',
    ) + (kit ? kitSettings() : bomView())
  );
}
function kitSettings() {
  const candidates = catalogSpec.items.rows.filter((x) => x.group === finishedGroup && !x.variantOf);
  const { rows, toolbar } = searchList(
    'kit-settings',
    candidates,
    'Tìm theo mã hoặc tên thành phẩm',
    (x) => [x.code, x.name],
    [
      [
        'presence',
        'Tất cả cấu phần',
        [
          ['set', 'Đã khai bộ'],
          ['unset', 'Chưa khai bộ'],
        ],
        (x) => (x.kit?.length ? 'set' : 'unset'),
      ],
    ],
  );
  const components = (x) =>
    x.kit?.map((part) => part.qty + ' × ' + (itemBy(part.item)?.name || part.item)).join(' · ') || '—';
  return pad(
    'Cấu phần bộ',
    toolbar +
      table(
        ['Mã', 'Thành phẩm', 'Cấu phần mỗi bộ', 'Thao tác'],
        rows.map((x) => [
          esc(x.code),
          esc(x.name),
          esc(components(x)),
          !x.kit && kitHasUsage(x)
            ? 'Đang dùng như thành phẩm rời'
            : b('kit-edit|' + x.code, x.kit ? 'Sửa cấu phần' : 'Khai bộ', 'link') || '—',
        ]),
      ),
  );
}
function bomView() {
  const selected = itemBy(new URLSearchParams(location.hash.split('?')[1]).get('item'));
  if (!selected || selected.group !== finishedGroup) {
    const { rows, toolbar } = searchList(
      'bom',
      catalogSpec.items.rows.filter((x) => x.group === finishedGroup),
      'Tìm theo mã hoặc tên thành phẩm',
      (x) => [x.code, x.name],
      [
        [
          'presence',
          'Tất cả định mức',
          [
            ['set', 'Đã có định mức'],
            ['unset', 'Chưa có định mức'],
          ],
          (x) => (x.bom?.length ? 'set' : 'unset'),
        ],
      ],
    );
    return pad(
      'Chọn thành phẩm',
      toolbar +
        table(
          ['Mã', 'Thành phẩm', 'Định mức', ''],
          rows.map((x) => [
            x.code,
            esc(x.name),
            x.bom?.length ? 'Đã có' : 'Chưa có',
            a('bom?item=' + encodeURIComponent(x.code), 'Mở định mức'),
          ]),
        ),
    );
  }
  return pad(
    esc(selected.name),
    '<div class="actions">' +
      a('bom', 'Về danh sách định mức') +
      '</div>' +
      b('bom-edit|' + selected.code, 'Thêm / sửa dòng định mức', 'primary') +
      table(
        ['Mã', 'Vật tư', 'SL trên một thành phẩm', 'ĐVT cơ sở'],
        (selected.bom || []).map((row) => [
          row.item,
          esc(itemBy(row.item).name),
          row.qty,
          esc(itemBy(row.item).extra),
        ]),
        [2],
      ),
  );
}
function editBom(item) {
  if (!item || item.group !== finishedGroup) return;
  return openModal(
    'Định mức · ' + item.name,
    grid(
      itemField('Vật tư', 'item', materialGroup),
      field('SL theo ĐVT cơ sở (0 để xóa)', 'qty', '', 'number'),
    ),
    (data) => {
      const component = itemBy(data.get('item')),
        qty = Number(data.get('qty'));
      if (
        !component ||
        component.group !== materialGroup ||
        !Number.isFinite(qty) ||
        qty < 0 ||
        String(data.get('qty') || '') === ''
      )
        return 'Chọn vật tư và nhập định mức hợp lệ.';
      item.bom = (item.bom || []).filter((x) => x.item !== component.code);
      if (qty > 0) item.bom.push({ item: component.code, qty });
      say('Đã cập nhật định mức.');
      return '';
    },
    'Lưu định mức',
  );
}
