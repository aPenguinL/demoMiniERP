const say = (x) => {
  message = x;
  render();
};
function nav() {
  const current =
    page === 'receipts' && routeParams().get('from') === 'stock'
      ? 'warehouse-docs'
      : String(owner[page] || page);
  const active = (id) => (String(id) === current ? 'aria-current="page"' : '');
  const icon = (name) =>
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    icons[name] +
    '</svg>';
  const link = (id, title, iconName) =>
    '<a href="#' +
    id +
    '" ' +
    active(id) +
    '>' +
    (iconName ? icon(iconName) : '') +
    esc(title || registry[id][0]) +
    '</a>';
  const group = ([title, name, ids]) =>
    '<details class="accounting-sub" name="accounting-section" ' +
    (ids.some((id) => String(id) === current) ? 'open' : '') +
    '><summary>' +
    icon(name) +
    esc(title) +
    '</summary>' +
    ids.map((id) => link(id)).join('') +
    '</details>';
  const legacy = ([title, items]) => {
    const available = items.filter(([id]) => allowedRoute(id) && (id !== 'home' || warehouseOnly()));
    return available.length
      ? '<div class="legacy-group">' +
          (title ? '<h2>' + esc(title) + '</h2>' : '') +
          available.map((args) => link(...args)).join('') +
          '</div>'
      : '';
  };
  const accounting = warehouseOnly()
    ? ''
    : '<section id="accountingMenu" class="legacy-group" aria-labelledby="accountingHeading"><h2 id="accountingHeading">Kế toán</h2>' +
      link('home', 'Tổng quan', 'grid') +
      mainAccounting.map(group).join('') +
      '</section>';
  $('nav').innerHTML =
    originalMenu.slice(0, -1).map(legacy).join('') + accounting + legacy(originalMenu.at(-1));
}
function legacyView() {
  if (page === 'home') return dashboard();
  if (Object.hasOwn(itemPages, page)) return itemsView(itemPages[page]);
  if (page === 'warehouse') return warehouseCatalog();
  if (catalogSpec[page]) {
    const spec = catalogSpec[page];
    const customer = page === 'customers';
    const criteria = ['customers', 'suppliers'].includes(page)
      ? [
          [
            'kind',
            customer ? 'Tất cả loại khách' : 'Tất cả loại người bán',
            columnChoices(spec.rows.map((x) => (customer ? x.customerType : x.sellerType))),
            (x) => (customer ? x.customerType : x.sellerType),
          ],
        ]
      : [];
    const { rows, toolbar } = searchList(
      'partners-' + page,
      spec.rows,
      'Tìm theo mã hoặc tên đối tác',
      (x) => [x.code, x.name, x.extra, ...(x.aliases || [])],
      criteria,
    );
    return card(
      toolbar +
        table(
          ['Mã', spec.name, spec.extra, ...(customer ? ['Loại khách'] : []), 'Thao tác'],
          rows.map((x) => [
            x.code,
            esc(x.name),
            esc(x.extra || '—'),
            ...(page === 'customers' ? [esc(x.customerType || '')] : []),
            b('catalog-edit-' + page + '|' + x.code, 'Sửa', 'link'),
          ]),
        ),
    );
  }
  return pad(
    '',
    note('Quản trị người dùng và phân quyền do ERPNext xử lý. Màn này chỉ thể hiện vị trí trong menu mẫu.'),
  );
}
const sourceGuides = {
  1: ['Tổng hợp từ hóa đơn, thanh toán và nhập kho.', [27, 29, 5, 'receipts']],
  8: ['Công nợ phát sinh từ hóa đơn đã ghi sổ và thay đổi khi xác nhận phiếu thu hoặc chi.', [27, 29, 5]],
  9: ['Sổ quỹ lấy số phát sinh từ chứng từ thu, chi và bút toán tiền mặt.', [5, 2]],
  10: ['Nhập sao kê hoặc đối chiếu dòng có sẵn với bút toán ngân hàng.', [5, 2]],
  11: ['Sổ cái hiển thị các bút toán đã ghi. Mở một dòng để kiểm tra chứng từ nguồn.', [2, 29, 27]],
  12: ['Nhật ký tổng hợp bút toán đã ghi từ các phân hệ.', [2]],
  13: ['Bảng cân đối lấy số dư đầu kỳ và phát sinh đã ghi sổ.', [2, 'opening']],
  15: ['Tổng quan thuế lấy số từ bảng kê và tờ khai của kỳ.', [16, 17]],
  16: ['Bảng kê lấy từ hóa đơn đã ghi sổ. Mở mã hóa đơn để xem chứng từ gốc.', [27, 29]],
  17: ['Rà bảng kê, sau đó chốt tờ khai của kỳ.', [16]],
  21: ['Bắt đầu từ bảng lương và danh sách khấu trừ.', [20, 'wages']],
  22: ['Hàng đợi lấy hóa đơn bán đã ghi sổ. Mở hóa đơn hoặc chọn phát hành hàng loạt.', [27]],
  26: ['Báo cáo lấy số từ sổ cái và bảng cân đối theo kỳ.', [11, 13]],
  stock: ['Hàng nhập và giao đã xác nhận tạo phát sinh kho.', ['receipts', 'deliveries']],
  opening: ['Nhập từng dòng số dư tài khoản, kiểm tra tổng Nợ/Có rồi xác nhận.', [14]],
};
function sourceGuide(id) {
  const guide = sourceGuides[id];
  if (!guide) return '';
  const [description, links] = guide;
  return pad(
    '',
    '<div class="summary-row"><span>' +
      description +
      '</span><div class="actions">' +
      links
        .filter(allowedRoute)
        .map((key) => a(key, registry[key][0]))
        .join('') +
      '</div></div>',
  );
}
function pageView() {
  const actions = {
    materials: b('item-new|materials', '+ Thêm nguyên liệu', 'primary'),
    products: b('item-new|products', '+ Thêm thành phẩm', 'primary') + '',
    warehouse: b('catalog-new-warehouse', '+ Thêm kho', 'primary'),
    'orders-sale': b('sales-new', '+ Tạo đơn bán', 'primary'),
    deliveries: b('sales-delivery-picker', '+ Tạo phiếu giao', 'primary'),
    receipts: b('new-receipt', '+ Tạo phiếu nhập kho', 'primary'),
    'orders-buy': b('new-order', '+ Tạo đơn mua', 'primary'),
    2: jump(3, '+ Tạo bút toán'),
    5: b('payment-new', '+ Tạo phiếu thanh toán', 'primary') + b('deposit-picker', 'Đặt cọc theo đơn'),
    9: b('export', 'Xuất sổ quỹ'),
    10: b('import-bank', 'Nhập sao kê', 'primary'),
    11: b('export', 'Xuất sổ cái'),
    12: b('export', 'Xuất nhật ký'),
    13: b('export', 'Xuất F01-DNN'),
    16: b('export', 'Xuất bảng kê'),
    20: a('wages', 'Mở bảng lương'),
    22: b('issue-batch', 'Phát hành hàng loạt', 'primary'),
    26:
      b('print-accounting', 'In / Lưu PDF') + ([0, 1, 4].includes(tab) ? b('financial-csv', 'Tải CSV') : ''),
    27: b('new-sale', '+ Hóa đơn thành phẩm', 'primary'),
    29:
      b('new-buy', '+ Tạo hóa đơn mua', 'primary') +
      b('buy-service', 'Gia công ngoài') +
      b('buy-noinvoice', 'Mua không hóa đơn'),
  };
  return (
    '<div class="heading"><div><div class="crumb">' +
    breadcrumb() +
    (phase2(page) ? ' <span class="badge">Giai đoạn 2</span>' : '') +
    '</div><h1>' +
    (isClosePage(page)
      ? 'Chốt sổ cuối kỳ'
      : ['assets', 'prepaid'].includes(page)
        ? 'Tài sản & phân bổ'
        : registry[page][0]) +
    '</h1></div><div class="actions">' +
    (actions[page] ||
      (Object.hasOwn(catalogSpec, page)
        ? b('catalog-new-' + page, '+ Tạo ' + catalogSpec[page].label, 'primary')
        : '')) +
    '</div></div><div class="message" role="' +
    (message === deniedRouteMessage ? 'alert' : 'status') +
    '">' +
    esc(message) +
    '</div>' +
    (warehouseOnly() ? '' : sourceGuide(page)) +
    (views[page] ? views[page]() : legacyView())
  );
}
function render() {
  const focused = document.activeElement?.id;
  const profileRole = demoRole === 'tenant' ? 'Quản trị viên' : roleLabels[demoRole];
  $('profile-role').textContent = profileRole;
  $('profile-trigger').setAttribute('aria-label', 'tanpham, ' + profileRole + '. Đổi vai trò xem thử');
  $('role-' + demoRole).checked = true;
  const cursor = focused === 'quickSearch' ? document.activeElement.selectionStart : null;
  $('app').innerHTML = pageView();
  if (cursor !== null && $('quickSearch')) {
    $('quickSearch').focus();
    $('quickSearch').setSelectionRange(cursor, cursor);
  }
}
function onRoute() {
  if ($('dialog').open) $('dialog').close();
  let [target, context = ''] = location.hash.slice(1).split('?');
  let params = new URLSearchParams(context);
  if (target === 'items') {
    target = 'materials';
    params = new URLSearchParams();
    replaceHash(target);
  }
  const oldType = legacyWarehouseTypes[target];
  if (
    oldType ||
    (target === 'receipts' && params.has('ref') && !['buy', 'stock'].includes(params.get('from')))
  ) {
    const code = params.get('doc') || params.get('ref');
    params = new URLSearchParams({ type: oldType || 'purchase' });
    if (code) params.set('doc', code);
    target = 'warehouse-docs';
    replaceHash(target + '?' + params);
  }
  const denied = Object.hasOwn(registry, target) && !allowedRoute(target);
  if (denied) replaceHash('home');
  if (page === 'receipts' && !previousReceiptDetail) purchaseFilters = { filter, status, dateFrom, dateTo };
  if (page === 'warehouse-docs' && !previousStockDetail) stockFilters = { filter, status, dateFrom, dateTo };
  previousReceiptDetail = params.has('ref');
  previousStockDetail = params.has('doc');
  page = Object.hasOwn(registry, target) && allowedRoute(target) && target !== '1' ? target : 'home';
  const editKind = { 3: 'journal', 6: 'pay', 28: 'sale', 30: 'buy' }[page];
  editingEntry =
    editKind && params.has('edit')
      ? records[editKind].find((x) => x.code === params.get('edit') && x.state === 'Nháp') || null
      : null;
  if (editKind && params.has('edit') && !editingEntry) {
    route(targets[editKind] + '?code=' + encodeURIComponent(params.get('edit')));
    return;
  }
  if (page === '26' && /^(0[1-9]|1[0-2])\/\d{4}$/.test(params.get('period') || '')) {
    financialMonth = params.get('period');
    financialDate = dayKey('01/' + financialMonth);
  }
  if (isClosePage(page) && /^(0[1-9]|1[0-2])\/[1-9]\d{3}$/.test(params.get('period') || ''))
    selectedClosePeriod = params.get('period');
  tab =
    page === 'stock' && params.get('group') === 'products'
      ? 1
      : page === '8'
        ? params.get('tab') === 'deposits'
          ? 3
          : params.get('side') === 'buy'
            ? 1
            : 0
        : 0;
  if (page === '25' && params.get('tab') === 'insurance') tab = 0;
  debtFilter = page === '8' && ['late', 'current'].includes(params.get('due')) ? params.get('due') : 'all';
  if (page === '8' && debtFilter !== 'all') {
    const scope = tab === 1 ? 'debt-buy' : 'debt-sale';
    listQueries.set(scope, { ...listQueries.get(scope), due: debtFilter });
  }
  if (page === 'stock' && params.has('warehouse')) {
    const scope = tab === 1 ? 'stock-products' : 'stock-materials';
    listQueries.set(scope, { ...listQueries.get(scope), warehouse: params.get('warehouse') });
  }
  if (page === '11' && accounts.some((x) => accountCode(x) === params.get('account')))
    ledgerCode = params.get('account');
  if (page === '9' && /^(0[1-9]|1[0-2])\/\d{4}$/.test(params.get('period') || ''))
    cashRange = { month: params.get('period') };
  if (['11', '12', '13'].includes(page) && /^(0[1-9]|1[0-2])\/\d{4}$/.test(params.get('period') || ''))
    ledgerMonth = params.get('period');
  ledgerDocument = page === '11' ? params.get('entry') || '' : '';
  const detailKind = { 4: 'journal', 7: 'pay', 28: 'sale', 30: 'buy' }[page];
  if (detailKind && params.has('code')) {
    const code = params.get('code');
    const entry = records[detailKind].find((x) => x.code === code);
    activeRecord = { ...entry, kind: detailKind, code };
  }
  const defaults = { filter: '', status: '', dateFrom: '', dateTo: '' };
  const reset = params.has('restore')
    ? {
        ...defaults,
        ...(page === 'receipts' ? purchaseFilters : page === 'warehouse-docs' ? stockFilters : {}),
      }
    : defaults;
  ({ filter, status, dateFrom, dateTo } = reset);
  message = denied
    ? deniedRouteMessage
    : orderSaveFeedback?.target === location.hash.slice(1)
      ? orderSaveFeedback.feedback
      : '';
  orderSaveFeedback = null;
  nav();
  render();
  $('sidebar').classList.remove('visible');
  window.scrollTo(0, 0);
}
const catalog = (title, idList) =>
  pad(title, '<div class="diagram">' + idList.map((id) => a(id, registry[id][0])).join('') + '</div>');
