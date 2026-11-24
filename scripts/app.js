function roleDashboard() {
  if (warehouseOnly())
    return (
      cards([
        [
          'Mặt hàng nguyên liệu',
          catalogSpec.items.rows.filter((x) => x.group === materialGroup).length,
          'materials',
        ],
        [
          'Mặt hàng thành phẩm',
          catalogSpec.items.rows.filter((x) => x.group === finishedGroup).length,
          'products',
        ],
        [
          'Chứng từ kho cần xử lý',
          stockDocuments().filter((x) => x.state === 'Nháp').length,
          'warehouse-docs',
        ],
      ]) + pad('Đi đến nghiệp vụ', a('stock', 'Xem tồn kho') + ' · ' + a('warehouse-docs', 'Chứng từ kho'))
    );
  return dashboard();
}

function groupLinks(links) {
  return card(
    '<nav class="workflow-tabs">' +
      links
        .map(
          ([id, label]) =>
            '<a href="#' +
            id +
            '" ' +
            (String(id).split('?')[0] === page ? 'aria-current="page"' : '') +
            '>' +
            esc(label) +
            '</a>',
        )
        .join('') +
      '</nav>',
  );
}
function payrollWorkspace() {
  return (
    groupLinks([
      ['wages', 'Bảng lương'],
      ['employees', 'Hồ sơ nhân viên'],
      [20, 'TNCN'],
      ['payroll-insurance', 'Bảo hiểm'],
    ]) +
    (page === '20'
      ? pitRegister()
      : page === 'payroll-insurance'
        ? insuranceReconciliation()
        : page === 'employees'
          ? employeeView()
          : wageView())
  );
}
function reportWorkspace() {
  return (
    groupLinks([
      [26, 'Báo cáo tài chính'],
      [31, 'Lịch sử xuất'],
    ]) + (page === '31' ? reports() : financial())
  );
}
function debtWorkspace() {
  return receivable();
}
function paymentWorkspace() {
  return list('pay');
}

const views = {
  'test-data': testDataView,
  home: roleDashboard,
  1: roleDashboard,
  2: () => list('journal'),
  3: journalForm,
  4: () => back(2) + detail('journal', activeRecord?.code),
  5: paymentWorkspace,
  6: payForm,
  7: () => back(5) + detail('pay', activeRecord?.code),
  8: debtWorkspace,
  9: () => ledgers(9),
  10: reconciliation,
  11: () => ledgers(11),
  12: () => ledgers(12),
  13: () => ledgers(13),
  14: () => '<iframe title="Danh mục tài khoản chi tiết"></iframe>',
  15: () => dashboard(true),
  16: vatInvoices,
  17: () => taxReturn(false),
  18: () => cit(false),
  19: () => cit(true),
  20: payrollWorkspace,
  21: () => taxReturn(true),
  22: salesWorkspace,
  assets: () => assetWorkspace('assets'),
  prepaid: () => assetWorkspace('prepaid'),
  advances: () => operations('advances'),
  funding: () => operations('funding'),
  wages: payrollWorkspace,
  insurance: insuranceView,
  'payroll-insurance': payrollWorkspace,
  employees: payrollWorkspace,
  production: productionView,
  'mfg-issues': () => productionDocuments(false),
  'mfg-receipts': () => productionDocuments(true),
  bom: productionSettings,
  deposits: depositView,
  noinvoice: noInvoiceView,
  'sales-adjustments': adjustmentsView,
  'stock-check': stockCheckView,
  defective: defectiveView,
  reconcile: closeWorkspace,
  'close-review': closeWorkspace,
  receipts: receiptView,
  stock: stockView,
  'orders-sale': () => saleDocuments('order'),
  deliveries: () => saleDocuments('delivery'),
  'orders-buy': purchaseOrder,
  23: closeWorkspace,
  24: closeWorkspace,
  25: settings,
  26: reportWorkspace,
  27: salesWorkspace,
  28: () => invoice('sale'),
  29: () => list('buy'),
  30: () => invoice('buy'),
  31: reportWorkspace,
  opening,
  cost: closeWorkspace,
  allocation: closeWorkspace,
  'warehouse-docs': warehouseDocuments,
  margin: marginView,
  warranty: warrantyView,
  scrap: scrapView,
};

applyTheme();
seedPurchasing();
onRoute();
