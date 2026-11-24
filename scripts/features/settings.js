const accountingCycles = ['Theo tháng', 'Theo quý', 'Theo năm'];
const defaultAccountRules = {
  cash: ['Tiền mặt trên phiếu thu/chi', '1111'],
  income: ['Doanh thu bán thành phẩm', '5112'],
  receivable: ['Phải thu khách hàng', '131', /^131(?!9)/],
  payable: ['Phải trả nhà cung cấp', '331', /^331(?!9)/],
  materialStockAccount: ['Nhập / xuất kho nguyên liệu', '152'],
  finishedStockAccount: ['Nhập / xuất kho thành phẩm', '155'],
  bank: ['Tiền gửi trên phiếu thu/chi', '1121'],
  bankFee: ['Chi phí khi ghi sổ phí ngân hàng', '6422'],
  bankInterest: ['Doanh thu khi ghi sổ lãi ngân hàng', '515'],
};
function defaultAccountChoices(key) {
  const [, base, group] = defaultAccountRules[key];
  return chartAccounts
    .filter(
      (account) =>
        account.active &&
        (group ? group.test(account.code) : account.code.startsWith(base)) &&
        (account.code === base ||
          !chartAccounts.some((child) => child.parent === account.code && child.active)),
    )
    .map(({ code, name }) => [code, code + ' · ' + name]);
}
function configuredAccount(key) {
  const base = defaultAccountRules[key][1];
  const stored = accountCode(stage.settings?.[1]?.[key] || '');
  return defaultAccountChoices(key).some(([code]) => code === stored) ? stored : base;
}
function defaultAccountRows() {
  const stored = stage.settings?.[1] || {};
  const optional = ['bank', 'bankFee', 'bankInterest'];
  return Object.keys(defaultAccountRules).filter(
    (key) => stored[key] !== null && (!optional.includes(key) || Boolean(stored[key])),
  );
}
function defaultAccountsView() {
  const rows = defaultAccountRows();
  const actions =
    tenantOnly() && rows.length < Object.keys(defaultAccountRules).length
      ? b('default-account-add', '+ Thêm thiết lập', 'primary')
      : '';
  return (
    '<div class="actions">' +
    a(14, 'Mở danh mục tài khoản') +
    actions +
    '</div>' +
    (tenantOnly()
      ? '<p class="muted">Có thể thêm lại thiết lập đã xóa. Nghiệp vụ chưa thiết lập dùng tài khoản chuẩn của hệ thống.</p>'
      : '') +
    table(
      ['Nghiệp vụ', 'Tài khoản mặc định', 'Thao tác'],
      rows.map((key) => {
        const code = configuredAccount(key);
        const account = chartAccounts.find((item) => item.code === code);
        return [
          esc(defaultAccountRules[key][0]),
          esc(code + (account ? ' · ' + account.name : '')),
          tenantOnly()
            ? b('default-account-edit|' + key, 'Sửa', 'link') +
              b('default-account-remove|' + key, 'Xóa', 'link')
            : '—',
        ];
      }),
    )
  );
}
function setDefaultAccount(key, value) {
  stage.settings ??= {};
  stage.settings[1] ??= {};
  stage.settings[1][key] = value;
  say(value ? 'Đã lưu tài khoản mặc định.' : 'Đã xóa thiết lập. Nghiệp vụ dùng tài khoản chuẩn.');
}
function editDefaultAccount(key) {
  const available = Object.keys(defaultAccountRules).filter((item) => !defaultAccountRows().includes(item));
  const adding = !key;
  if (adding && !available.length) return;
  const withFullLabel = (fieldHtml) =>
    fieldHtml.replace('</label>', '<small class="default-account-selected"></small></label>');
  const operation = adding
    ? withFullLabel(
        optionsField(
          'Nghiệp vụ',
          'defaultRule',
          available.map((item) => [item, defaultAccountRules[item][0]]),
        ),
      )
    : '<div class="default-account-operation"><span>Nghiệp vụ</span><p>' +
      esc(defaultAccountRules[key][0]) +
      '</p></div>';
  const accountField = withFullLabel(
    optionsField(
      'Tài khoản',
      'defaultAccount',
      key ? defaultAccountChoices(key) : [],
      key ? configuredAccount(key) : '',
    ),
  );
  const body = '<div class="formGrid default-account-fields">' + operation + accountField + '</div>';
  openModal(
    adding ? 'Thêm thiết lập tài khoản' : 'Sửa tài khoản mặc định',
    body,
    (data) => {
      const rule = key || data.get('defaultRule'),
        code = data.get('defaultAccount');
      if (
        (adding && !available.includes(rule)) ||
        !Object.hasOwn(defaultAccountRules, rule) ||
        !defaultAccountChoices(rule).some(([value]) => value === code)
      )
        return 'Chọn nghiệp vụ và tài khoản đang sử dụng trong nhóm phù hợp.';
      setDefaultAccount(rule, code);
      return '';
    },
    'Lưu thiết lập',
  );
  const { defaultRule, defaultAccount } = $('dialogForm').elements;
  const showFullLabel = (control) => {
    const label = control.value ? control.selectedOptions[0].textContent : '';
    control.title = label;
    control.nextElementSibling.textContent = label;
  };
  defaultAccount.addEventListener('change', () => showFullLabel(defaultAccount));
  showFullLabel(defaultAccount);
  if (adding)
    defaultRule.addEventListener('change', () => {
      const rule = defaultRule.value;
      const choices = available.includes(rule) ? defaultAccountChoices(rule) : [];
      defaultAccount.replaceChildren(
        new Option('Chọn', ''),
        ...choices.map(([code, label]) => new Option(label, code)),
      );
      if (choices.length) defaultAccount.value = configuredAccount(rule);
      showFullLabel(defaultRule);
      showFullLabel(defaultAccount);
    });
}
function settings() {
  return card(
    tabs(['Đơn vị & kỳ kế toán', 'Tài khoản mặc định', 'Thuế suất', 'HĐĐT VNPT'], tab) +
      '<div class="pad">' +
      (!tenantOnly() ? note('Bạn có quyền xem cấu hình. Quản trị tenant thực hiện thay đổi.') : '') +
      [
        '<div class="configuration-grid">' +
          field('Tên đơn vị', 'company', 'Mini ERP Xưởng gỗ') +
          field('Mã số thuế', 'taxId', '') +
          select('Kỳ kê khai GTGT', 'taxPeriod', accountingCycles) +
          '<label>Chế độ kế toán<input name="accountingRegime" list="accounting-regime-options" value="Thông tư 133"><datalist id="accounting-regime-options"><option value="Thông tư 133"></option></datalist></label>' +
          select('Chu kỳ chốt sổ', 'closingCycle', accountingCycles) +
          (tenantOnly()
            ? field('Kỳ khởi tạo dữ liệu', 'openingMonth', configuredOpeningDay(), 'date')
            : '<div class="system-field">Kỳ khởi tạo dữ liệu<div class="system-value">' +
              esc(postingPeriod(configuredOpeningDay())) +
              '</div></div>') +
          '</div>' +
          '<div style="padding-top:14px">' +
          note(
            'Quản trị tenant có thể lưu các mục thiết lập này. Bản mẫu chốt sổ theo tháng. Chọn một ngày trong tháng cần khởi tạo. Hệ thống dùng ngày 01 của tháng đó làm ngày số dư đầu kỳ.',
          ) +
          '</div>',
        defaultAccountsView(),
        table(
          ['Nhóm thuế', 'Thuế suất mẫu', 'Hiệu lực', 'Trạng thái'],
          stage.rates || [['GTGT', '10%', '01/01/2026', pill('Bản mẫu')]],
        ) +
          '<p style="margin-top:10px">' +
          b('tax-rate', '+ Thêm mức thuế') +
          '</p>',
        meta([
          ['Nhà cung cấp', 'VNPT'],
          ['Môi trường', 'Mô phỏng'],
          ['Thông tin kết nối', 'Do máy chủ quản lý'],
        ]) + b('check-provider', 'Kiểm tra kết nối'),
        '',
      ][tab] +
      (tab === 1
        ? ''
        : '<div class="actions right" style="margin-top:12px">' +
          b('save-settings', 'Lưu cấu hình', 'primary') +
          '</div>') +
      '</div>',
  );
}
function reports() {
  const { rows, toolbar } = searchList(
    'exports',
    exportsLog,
    'Tìm mã yêu cầu hoặc tên báo cáo',
    (x) => [x[0], x[1]],
    [
      ['format', 'Tất cả định dạng', columnChoices(exportsLog.map((x) => x[2])), (x) => x[2]],
      ['status', 'Tất cả trạng thái', columnChoices(exportsLog.map((x) => x[4])), (x) => x[4]],
    ],
  );
  return (
    pad(
      'Yêu cầu báo cáo mới',
      grid(
        select('Loại báo cáo', 'report', [
          'Tồn kho',
          'Sổ cái',
          'Bảng cân đối tài khoản',
          'Báo cáo tài chính',
        ]),
        select('Định dạng', 'format', ['Excel (.xlsx)', 'PDF']),
        select('Kỳ', 'period', ['11/2026', 'Năm 2026']),
      ) +
        '<div class="actions right" style="margin-top:12px">' +
        b('export', 'Tạo yêu cầu xuất', 'primary') +
        '</div>',
    ) +
    card(
      '<div class="pad"><h2>Báo cáo đã yêu cầu</h2></div>' +
        toolbar +
        table(
          ['Mã yêu cầu', 'Báo cáo', 'Định dạng', 'Yêu cầu lúc', 'Trạng thái', 'Thao tác'],
          rows.map((x) => [
            ...x.slice(0, 4).map(esc),
            pill(x[4], 'good'),
            b('download-' + exportsLog.indexOf(x), 'Xem yêu cầu', 'link'),
          ]),
        ),
    )
  );
}
function opening() {
  const day = savedOpening?.day || configuredOpeningDay();
  const rows =
    savedOpening?.rows ||
    Object.entries(journalOpening).map(([code, value]) =>
      purchaseLine(code, '', Math.max(0, value), Math.max(0, -value)),
    );
  return editWrap(
    'opening',
    pad(
      'Khởi tạo số dư đầu kỳ',
      '<div class="configuration-grid"><div class="system-field">Kỳ khởi tạo · lấy từ thiết lập<div class="system-value">Tháng ' +
        postingPeriod(day) +
        '</div></div><div class="system-field">Ngày số dư đầu kỳ · tự xác định<div class="system-value">' +
        isoDate(day) +
        '</div><small>Không nhập lại ngày ở từng dòng số dư.</small></div><div class="system-field">Cần đổi kỳ khởi tạo?<div>' +
        a(25, 'Xem cấu hình kế toán') +
        '</div><small>Thiết lập kỳ khởi tạo trước khi xác nhận số dư đầu kỳ.</small></div></div><input type="hidden" name="day" value="' +
        esc(day) +
        '">' +
        note(
          'Số dư đầu kỳ phải xác nhận trước chứng từ đầu tiên; công nợ 131/331 theo dõi đối tượng và hóa đơn. Khi kỳ đầu tiên đã khóa, số dư đầu kỳ khóa theo.',
        ) +
        note(
          savedOpening
            ? 'Đã xác nhận số dư cho kỳ ' +
                openingPeriod() +
                '. Kiểm tra tại Sổ cái hoặc Bảng cân đối tài khoản.'
            : 'Nhập số dư theo sổ đã chốt và đối chiếu vốn góp TK 411 với hồ sơ vốn. Số dư mẫu gồm 12.000.000 đ lợi nhuận năm trước ở TK 4211. Hệ thống chỉ xác nhận khi tổng Nợ bằng tổng Có.',
        ),
    ) +
      editor('opening', 'Số dư theo tài khoản', rows) +
      formEnd('Xác nhận số dư'),
  );
}
function cost() {
  return costWorkspace();
}
