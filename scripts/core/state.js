const registry = {
  1: ['Tổng quan kế toán', 'Kế toán'],
  2: ['Bút toán', 'Kế toán'],
  3: ['Tạo / sửa bút toán', 'Kế toán'],
  4: ['Chi tiết bút toán', 'Kế toán'],
  5: ['Thanh toán', 'Tiền & công nợ'],
  6: ['Tạo / sửa phiếu thu, chi', 'Tiền & công nợ'],
  7: ['Chi tiết phiếu thanh toán', 'Tiền & công nợ'],
  8: ['Công nợ', 'Tiền & công nợ'],
  9: ['Sổ quỹ tiền mặt', 'Tiền & công nợ'],
  10: ['Đối chiếu ngân hàng', 'Tiền & công nợ'],
  11: ['Sổ cái', 'Sổ sách'],
  12: ['Nhật ký chung', 'Sổ sách'],
  13: ['Bảng cân đối tài khoản', 'Sổ sách'],
  14: ['Hệ thống tài khoản', 'Kế toán'],
  15: ['Tổng quan thuế', 'Thuế'],
  16: ['Bảng kê hóa đơn GTGT', 'Thuế'],
  17: ['Tờ khai GTGT (01/GTGT)', 'Thuế'],
  18: ['Tạm tính thuế TNDN', 'Thuế'],
  19: ['Quyết toán thuế TNDN', 'Thuế'],
  20: ['Khấu trừ thuế TNCN', 'Thuế'],
  21: ['Tờ khai TNCN (05/KK-TNCN)', 'Thuế'],
  22: ['Hóa đơn điện tử VNPT', 'Thuế'],
  23: ['Chốt sổ cuối kỳ', 'Cuối kỳ'],
  24: ['Khóa sổ kỳ', 'Cuối kỳ'],
  25: ['Cấu hình kế toán & thuế', 'Hệ thống'],
  26: ['Báo cáo tài chính', 'Sổ sách'],
  27: ['Hóa đơn bán', 'Bán hàng'],
  28: ['Tạo / xem hóa đơn bán', 'Bán hàng'],
  29: ['Hóa đơn mua', 'Mua hàng'],
  30: ['Tạo / xem hóa đơn mua', 'Mua hàng'],
  31: ['Lịch sử xuất báo cáo', 'Hệ thống'],
  assets: ['Tài sản cố định & khấu hao', 'Tài sản & chi phí'],
  prepaid: ['CCDC & chi phí trả trước', 'Tài sản & chi phí'],
  advances: ['Tạm ứng nhân viên', 'Tiền & ngân hàng'],
  funding: ['Vốn góp & khoản vay', 'Tổng hợp'],
  wages: ['Bảng lương', 'Lương & nhân sự'],
  'close-review': ['Rà soát báo cáo', 'Cuối kỳ'],
  reconcile: ['Đối soát cuối kỳ', 'Cuối kỳ'],
  opening: ['Số dư đầu kỳ', 'Kế toán'],
  cost: ['Tính giá thành cuối kỳ', 'Cuối kỳ'],
  allocation: ['Phân bổ chi phí chung', 'Cuối kỳ'],
  margin: ['Lãi gộp theo đơn và lệnh', 'Sổ sách'],
  warranty: ['Bảo hành', 'Bán hàng'],
  scrap: ['Bán phế liệu', 'Sản xuất'],
  production: ['Lệnh sản xuất', 'Sản xuất'],
  'mfg-issues': ['Xuất vật tư sản xuất', 'Sản xuất'],
  'mfg-receipts': ['Nhập kho thành phẩm', 'Sản xuất'],
  insurance: ['Tỷ lệ bảo hiểm', 'Thiết lập'],
  employees: ['Hồ sơ nhân viên', 'Tài sản & chi phí'],
  bom: ['Cấu hình sản xuất', 'Sản xuất'],
  deposits: ['Đặt cọc theo đơn bán', 'Bán hàng'],
  noinvoice: ['Bảng kê mua không hóa đơn', 'Thuế'],
  'sales-adjustments': ['Hóa đơn điều chỉnh', 'Bán hàng'],
  'stock-check': ['Kiểm kê kho', 'Kho'],
  defective: ['Kho hàng lỗi', 'Kho'],
};
const originalMenu = [
  ['', [['home', 'Tổng quan', 'grid']]],
  [
    'Danh mục',
    [
      ['materials', 'Nguyên liệu', 'box'],
      ['products', 'Thành phẩm', 'box'],
      ['warehouse', 'Kho', 'box'],
      ['suppliers', 'Nhà cung cấp', 'people'],
      ['customers', 'Khách hàng', 'person'],
      ['lenders', 'Bên cho vay', 'people'],
      ['contributors', 'Người góp vốn', 'person'],
    ],
  ],
  [
    'Mua hàng',
    [
      ['orders-buy', 'Đơn mua', 'doc'],
      ['receipts', 'Phiếu nhập kho', 'doc'],
      [29, 'Hóa đơn mua', 'doc'],
    ],
  ],
  [
    'Bán hàng',
    [
      ['orders-sale', 'Đơn bán', 'doc'],
      ['deliveries', 'Phiếu giao hàng', 'doc'],
      [27, 'Hóa đơn bán', 'doc'],
      ['warranty', 'Bảo hành', 'doc'],
    ],
  ],

  [
    'Kho',
    [
      ['stock', 'Tồn kho', 'grid'],
      ['warehouse-docs', 'Chứng từ kho', 'doc'],
    ],
  ],
  ['Hệ thống', [['users', 'Người dùng', 'person']]],
];
const mainAccounting = [
  ['Tiền & công nợ', 'money', [5, 8, 9, 10, 'funding']],

  ['Tài sản', 'box', ['assets', 'prepaid']],
  ['Thuế', 'doc', [16, 17, 'noinvoice', 18, 19]],
  ['Sổ sách & báo cáo', 'doc', [2, 11, 12, 13, 26]],
  ['Cuối kỳ', 'clock', [23]],
  ['Thiết lập', 'box', [14, 'opening', 25]],
];
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5m-9 5v9"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m1-15a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 5v2"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2"/>',
  doc: '<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 0v5h5M8 12h8m-8 4h6"/>',
  money: '<path d="M12 2v20m5-16H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 5v7h7"/>',
};
for (const [group, items] of originalMenu)
  for (const [id, label] of items) if (!registry[id]) registry[id] = [label, group || 'Mini ERP'];
const owner = {
  1: 'home',
  3: 2,
  4: 2,
  6: 5,
  7: 5,
  15: 16,
  20: 'wages',
  22: 27,
  28: 27,
  30: 29,
  31: 26,
  'close-review': 23,
  reconcile: 23,
  24: 23,
  allocation: 23,
  cost: 23,
  insurance: 25,
  deposits: 8,
  scrap: 27,
  'sales-adjustments': 27,
  'mfg-issues': 'warehouse-docs',
  'mfg-receipts': 'warehouse-docs',
  'stock-check': 'warehouse-docs',
  defective: 'warehouse-docs',
};
registry['payroll-insurance'] = ['Bảo hiểm', 'Lương & nhân sự'];
const roleLabels = { tenant: 'Quản trị tenant', accounting: 'Kế toán', warehouse: 'Nhân viên kho' };
let demoRole = 'tenant';
const warehouseOnly = () => demoRole === 'warehouse';
const tenantOnly = () => demoRole === 'tenant';
const warehouseRoutes = new Set([
  'home',
  'materials',
  'products',
  'warehouse',
  'warehouse-docs',
  'stock',
  'receipts',
  'stock-check',
  'defective',
]);
const phase2Routes = new Set([
  'production',
  'bom',
  'mfg-issues',
  'mfg-receipts',
  'wages',
  'employees',
  'payroll-insurance',
  'insurance',
  'advances',
  'margin',
  'allocation',
  'cost',
  20,
  21,
]);
const allowedRoute = (id) =>
  !phase2Routes.has(id) &&
  !phase2Routes.has(String(id)) &&
  (warehouseOnly() ? warehouseRoutes.has(String(id)) : String(id) !== 'users' || tenantOnly());
const protectedActions = new Set([
  'lock',
  'close-approve',
  'close-reject',
  'common-expense',
  'ins-new',
  'save-settings',
  'tax-rate',
  'check-provider',
]);
function allowedAction(id) {
  if (/^(mfg-|production-|kit-assemble|wage-|payroll-|ins-|advance-)/.test(id)) return false;
  if (
    !tenantOnly() &&
    (protectedActions.has(id) || id.startsWith('stock-resolve|') || id.startsWith('default-account-'))
  )
    return false;
  return (
    !warehouseOnly() ||
    /^(tab-|mfg-(new|start|issue|bom|complete)|material-return\||stock-check-new$|stock-detail\||transfer-new$|kit-assemble$|wd-filter|wd-stock-filter)/.test(
      id,
    )
  );
}
function breadcrumb() {
  const fromStock = page === 'receipts' && routeParams().get('from') === 'stock';
  const id = fromStock ? 'warehouse-docs' : String(owner[page] || page);
  const accounting = mainAccounting.find(([, , ids]) => ids.some((x) => String(x) === id));
  const original = originalMenu.find(([, items]) => items.some(([x]) => String(x) === id));
  const leaf = registry[id]?.[0] || registry[page][0];
  return [
    ...(accounting
      ? ['Kế toán', accounting[0]]
      : id === 'home' && !warehouseOnly()
        ? ['Kế toán']
        : original?.[0]
          ? [original[0]]
          : []),
    leaf,
    ...(id !== page && !fromStock ? [registry[page][0]] : []),
    ...(routeParams().get('ref') || routeParams().get('doc')
      ? [routeParams().get('ref') || routeParams().get('doc')]
      : []),
  ]
    .map(esc)
    .join(' / ');
}
const routeParams = () => new URLSearchParams(location.hash.split('?')[1] || '');
const legacyWarehouseTypes = {
  'mfg-issues': 'issue',
  'mfg-receipts': 'finished',
  'stock-check': 'count',
  defective: 'transfer',
};
const deniedRouteMessage = 'Bạn không có quyền xem màn này. Liên hệ Quản trị tenant.';
function replaceHash(path) {
  if (typeof history !== 'undefined') history.replaceState(null, '', '#' + path);
}
const phase2 = (id) => Number(id) >= 18 && Number(id) <= 21;
const accounts = [
  '1111 · Tiền Việt Nam',
  '1121 · Tiền gửi ngân hàng',
  '131 · Phải thu khách hàng',
  '1319 · Phải thu chưa lập hóa đơn (mẫu)',
  '1331 · Thuế GTGT được khấu trừ',
  '152 · Nguyên liệu, vật liệu',
  '154 · Chi phí SXKD dở dang',
  '155 · Thành phẩm',
  '331 · Phải trả người bán',
  '3319 · Hàng nhận chờ hóa đơn (mẫu)',
  '33311 · Thuế GTGT đầu ra',
  '5112 · Doanh thu thành phẩm',
  '632 · Giá vốn hàng bán',
  '6422 · Chi phí quản lý doanh nghiệp',
  '911 · Xác định kết quả kinh doanh',
  '4212 · Lợi nhuận sau thuế chưa phân phối năm nay',
  '411 · Vốn đầu tư của chủ sở hữu',
  '141 · Tạm ứng',
  '153 · Công cụ, dụng cụ',
  '2111 · TSCĐ hữu hình',
  '2141 · Hao mòn TSCĐ hữu hình',
  '242 · Chi phí trả trước',
  '334 · Phải trả người lao động',
  '3383 · Bảo hiểm xã hội',
  '3335 · Thuế TNCN',
  '3411 · Các khoản đi vay',
  '635 · Chi phí tài chính',
  '6421 · Chi phí bán hàng',
  '515 · Doanh thu hoạt động tài chính',
  '711 · Thu nhập khác',
  '811 · Chi phí khác',
  '3334 · Thuế thu nhập doanh nghiệp',
  '821 · Chi phí thuế thu nhập doanh nghiệp',
  '1388 · Phải thu khác',
  '3388 · Phải trả khác',
  '1381 · Tài sản thiếu chờ xử lý',
  '4211 · Lợi nhuận sau thuế chưa phân phối năm trước',
  '3381 · Tài sản thừa chờ xử lý',
  '3382 · Kinh phí công đoàn',
  '3384 · Bảo hiểm y tế',
  '3385 · Bảo hiểm thất nghiệp',
  '157 · Hàng gửi đi bán',
  '352 · Dự phòng phải trả',
];
const records = {
  journal: [
    {
      code: 'JV-2026-00012',
      day: '19/11/2026',
      party: 'Chi phí điện văn phòng',
      amount: 860000,
      state: 'Đã ghi sổ',
      lines: [
        ['6422 · Chi phí quản lý doanh nghiệp', '', '860000', '0'],
        ['1111 · Tiền Việt Nam', '', '0', '860000'],
      ],
    },
  ],
  pay: [
    {
      code: 'PT-2026-00008',
      day: '19/11/2026',
      party: 'Nội thất An Phú',
      amount: 6000000,
      state: 'Đã ghi sổ',
      type: 'Thu tiền',
      cash: accounts[1],
      ref: 'FT26111901',
      lines: [['SINV-2026-00065', 13200000, 6000000]],
    },
  ],
  sale: [
    {
      code: 'SINV-2026-00065',
      day: '18/11/2026',
      party: 'Nội thất An Phú',
      amount: 13200000,
      state: 'Đã ghi sổ',
      source: 'DN-2026-00003',
      paid: 6000000,
      einv: 'Chờ phát hành',
    },
  ],
  buy: [
    {
      code: 'PINV-2026-00089',
      day: '17/11/2026',
      post: '2026-11-17',
      ref: '0000873',
      due: '2026-11-18',
      party: 'Công ty TNHH Tân Hoàng Phát',
      amount: 8800000,
      state: 'Đã ghi sổ',
      source: 'GRN-2026-00001',
      paid: 0,
    },
  ],
};
const exportsLog = [['EXP-001', 'Tồn kho', 'Excel (.xlsx)', '18/11/2026', 'Có thể tải']];
const bank = [
  ['19/11/2026', 'FT26111901', 'Nội thất An Phú', 6000000, 'Chờ khớp'],
  ['19/11/2026', 'BANK-FEE-01', 'Phí duy trì tài khoản', -22000, 'Chờ khớp'],
];
const stage = { period: 'Đang mở', closing: false, vat: 'Nháp', pit: 'Nháp', opening: false };
let ledgerCode = '1111',
  ledgerMonth = '11/2026',
  ledgerDocument = '',
  financialDate = '2026-11-01',
  financialMonth = '11/2026';
let editingEntry = null,
  savedOpening = null;
let page = '1',
  tab = 0,
  activeRecord = null,
  filter = '',
  status = '',
  dateFrom = '',
  dateTo = '',
  message = '',
  modalHandler;
let modalReturnState = null,
  pendingPartySelection = null,
  orderSaveFeedback = null;
const route = (id) => {
  location.hash = String(id);
};
function setModalContent(title, body, fn, label = 'Xác nhận', blocked = false) {
  $('dialogTitle').textContent = title;
  $('dialogBody').innerHTML = body + '<p id="modalErr" class="err" role="alert"></p>';
  $('dialogButton').textContent = label;
  $('dialogButton').disabled = blocked;
  modalHandler = fn;
  validateFormDates($('dialogForm'));
}
