const flowSpecs = {
  assets: {
    columns: ['Mã tài sản', 'Tài sản', 'Nguyên giá mẫu', 'Khấu hao tháng mẫu'],
    seed: ['TS-001', 'Máy cắt CNC', 240000000, 4000000],
    ref: 'TS-001',
    label: 'Tài sản',
    events: [
      ['Ghi tăng TSCĐ', '2111', '331', 240000000],
      ['Trích khấu hao tháng', '154', '2141', 4000000],
    ],
  },
  prepaid: {
    columns: ['Mã khoản mục', 'Khoản mục', 'Giá trị ban đầu', 'Phân bổ tháng mẫu'],
    seed: ['CCDC-001', 'Bộ dụng cụ lắp ráp', 12000000, 1000000],
    ref: 'CCDC-001',
    label: 'Mã khoản phân bổ',
    events: [
      ['Ghi nhận mua CCDC', '242', '331', 12000000],
      ['Phân bổ tháng', '154', '242', 1000000],
    ],
  },
  advances: {
    columns: ['Mã đợt ứng', 'Người nhận', 'Đã ứng mẫu', 'Còn phải quyết toán mẫu'],
    seed: ['TU-001', 'Nguyễn Văn An', 5000000, 5000000],
    ref: 'TU-001 · Nguyễn Văn An',
    label: 'Đợt ứng và người nhận',
    events: [
      ['Chi tạm ứng', '141', '1111', 5000000],
      ['Quyết toán chi được duyệt', '6422', '141', 3500000],
      ['Thu hồi ứng thừa', '1111', '141', 1500000],
      ['Chi bổ sung khi quyết toán vượt', '141', '1111', 0],
      ['Trừ lương phần ứng thừa', '334', '141', 0],
    ],
  },
  funding: {
    columns: ['Mã hồ sơ', 'Bên liên quan', 'Giá trị ban đầu mẫu', 'Dư nợ gốc mẫu'],
    seed: ['VAY-001', 'Ngân hàng A', 120000000, 120000000],
    ref: 'VAY-001 · Ngân hàng A',
    label: 'Hợp đồng vay hoặc người góp vốn',
    events: [
      ['Nhận góp vốn qua ngân hàng', '1121', '411', 50000000],
      ['Nhận tiền vay', '1121', '3411', 120000000],
      ['Trả gốc vay', '3411', '1121', 10000000],
      ['Ghi nhận lãi trả ngay', '635', '1121', 850000],
    ],
  },
};
const profileConfig = {
  assets: {
    label: 'tài sản',
    prefix: 'TS',
    party: 'Tên tài sản',
    columns: ['Nguyên giá hồ sơ', 'Giá trị còn lại'],
    balance: '2111',
    offset: '2141',
  },
  prepaid: {
    label: 'khoản phân bổ',
    prefix: 'CCDC',
    party: 'Tên khoản chi / CCDC',
    columns: ['Giá trị hồ sơ', 'Còn phân bổ'],
    balance: '242',
  },
  advances: {
    label: 'đợt tạm ứng',
    prefix: 'TU',
    party: 'Người nhận',
    columns: ['Hạn mức hồ sơ', 'Còn phải quyết toán'],
    balance: '141',
  },
  funding: {
    label: 'hồ sơ vốn / vay',
    prefix: 'VAY',
    party: 'Bên cho vay / Người góp vốn',
    columns: ['Giá trị hồ sơ', 'Dư nợ gốc / Vốn đã góp'],
    balance: '3411',
    credit: true,
  },
};
const profileStore = Object.fromEntries(
  Object.entries(flowSpecs).map(([key, spec]) => [
    key,
    [
      {
        code: spec.seed[0],
        party: spec.seed[1],
        value: spec.seed[2],
        opening:
          key === 'funding' ? spec.seed[3] : key === 'assets' ? 228000000 : key === 'prepaid' ? 12000000 : 0,
        category: 'Vay',
        monthlyAmount: key === 'assets' ? 4000000 : key === 'prepaid' ? 1000000 : 0,
        day: ['assets', 'prepaid'].includes(key) ? '2026-11-01' : sampleDate,
        sample: true,
      },
    ],
  ]),
);
const profileLink = (key, code) => key + '?profile=' + encodeURIComponent(code);
const profileRows = (key, profile) =>
  records.journal.filter((x) => x.flow === key && x.profile === profile.code);
const hasInitialRecognition = (profile, rows, except) =>
  profile.opening > 0 ||
  rows.some((row) => row !== except && row.workflowEvent === 0 && row.state !== 'Đã hủy');
function profileBalance(key, profile, entries = profileRows(key, profile)) {
  const config = profileConfig[key];
  const equity = key === 'funding' && profile.category === 'Góp vốn';
  const code = equity ? '411' : config.balance;
  const relevant = entries.filter((entry) => entry.state === 'Đã ghi sổ').flatMap((entry) => entry.lines);
  const balance = relevant.reduce((n, [account, , debit, credit]) => {
    const current = accountCode(account);
    if (current === code) return n + (config.credit ? credit - debit : debit - credit);
    return current === config.offset ? n + debit - credit : n;
  }, profile.opening);
  return balance;
}
const fundingPartyKey = (category) => (category === 'Góp vốn' ? 'contributors' : 'lenders');
const fundingPartyName = (profile) =>
  catalogMatch(fundingPartyKey(profile.category), profile.partyCode || profile.party)?.name || profile.party;
function fundingPartyPicker(category) {
  const key = fundingPartyKey(category);
  return partyPicker(key, category === 'Góp vốn' ? 'Người góp vốn' : 'Bên cho vay', 'party');
}
$('dialogForm').addEventListener('change', (event) => {
  if (event.target.name === 'category' && $('funding-party-field')) {
    $('funding-party-field').innerHTML = fundingPartyPicker(event.target.value);
  }
});
function newProfile(key) {
  const config = profileConfig[key];
  if (!config) return;
  const isFunding = key === 'funding';
  const monthlyProfile = monthlyFlows.includes(key);
  return openModal(
    'Tạo ' + config.label,
    '<div class="formGrid' +
      (monthlyProfile ? ' monthly-profile-fields' : '') +
      '">' +
      [
        ...(isFunding
          ? [
              select('Loại hồ sơ', 'category', ['Vay', 'Góp vốn']),
              '<div id="funding-party-field">' + fundingPartyPicker('Vay') + '</div>',
            ]
          : [field(config.party, 'party')]),
        field('Ngày hồ sơ', 'day', sampleDate, 'date'),
        field('Giá trị dự kiến (đ)', 'value', '', 'number'),
        ...(monthlyProfile
          ? [
              field(
                key === 'assets' ? 'Khấu hao mỗi tháng (đ)' : 'Phân bổ mỗi tháng (đ)',
                'monthly',
                '',
                'number',
              ),
            ]
          : []),
      ].join('') +
      '</div>',
    (data) => {
      const party = escToText(data.get('party')),
        day = String(data.get('day') || ''),
        value = Number(data.get('value'));
      if (!party || !day || !Number.isSafeInteger(value) || value <= 0)
        return 'Nhập bên liên quan, ngày và giá trị lớn hơn 0.';
      const category = isFunding ? String(data.get('category')) : '';
      const partner = isFunding ? catalogMatch(fundingPartyKey(category), party) : null;
      if (isFunding && (!['Vay', 'Góp vốn'].includes(category) || !partner))
        return 'Chọn bên cho vay hoặc người góp vốn từ danh mục tương ứng.';
      const code =
        (category === 'Góp vốn' ? 'VG' : config.prefix) +
        '-' +
        String(1 + profileStore[key].length).padStart(3, '0');
      const monthlyAmount = Number(data.get('monthly')) || 0;
      if (
        ['assets', 'prepaid'].includes(key) &&
        (!Number.isSafeInteger(monthlyAmount) || monthlyAmount <= 0 || monthlyAmount > value)
      )
        return 'Nhập mức tháng lớn hơn 0 và không vượt giá trị hồ sơ.';
      profileStore[key].push({
        code,
        party: partner?.name || party,
        ...(partner ? { partyCode: partner.code } : {}),
        day,
        value,
        opening: 0,
        category,
        monthlyAmount,
      });
      route(profileLink(key, code));
      return '';
    },
    'Tạo hồ sơ',
  );
}
function operations(id) {
  const spec = flowSpecs[id],
    config = profileConfig[id];
  const selected = new URLSearchParams(location.hash.split('?')[1] || '').get('profile');
  const profile = profileStore[id].find((x) => x.code === selected);
  const partyName = (row) => (id === 'funding' ? fundingPartyName(row) : row.party);
  const create = b('profile-new-' + id, '+ Tạo ' + config.label, 'primary');
  const titleWithCreate = (title) =>
    '<div class="asset-list-heading"><h2>' + esc(title) + '</h2>' + create + '</div>';
  const isAssetProfile = monthlyFlows.includes(id);
  if (!profile) {
    const profiles = profileStore[id];
    const criteria =
      id === 'funding'
        ? [['kind', 'Tất cả loại hồ sơ', columnChoices(profiles.map((x) => x.category)), (x) => x.category]]
        : [
            [
              'balance',
              'Tất cả số dư',
              [
                ['active', 'Còn số dư'],
                ['zero', 'Hết số dư'],
              ],
              (x) => (profileBalance(id, x) !== 0 ? 'active' : 'zero'),
            ],
          ];
    const { rows, toolbar } = searchList(
      'profiles-' + id,
      profiles,
      'Tìm theo mã hoặc tên hồ sơ',
      (x) => [x.code, partyName(x), x.party, x.category],
      criteria,
    );
    const title = 'Danh sách ' + config.label;
    const header = isAssetProfile ? titleWithCreate(title) : '';
    return pad(
      header ? '' : title,
      (header || '<div class="actions">' + create + '</div>') +
        note('Mở mã hồ sơ để lập nghiệp vụ và xem các bút toán đã tạo.') +
        toolbar +
        table(
          ['Mã hồ sơ', config.party, ...config.columns, 'Trạng thái'],
          rows.map((x) => [
            a(profileLink(id, x.code), x.code),
            esc(partyName(x)),
            money(x.value),
            money(profileBalance(id, x)),
            pill(x.sample ? 'Hồ sơ mẫu' : 'Đã tạo'),
          ]),
          [2, 3],
        ),
    );
  }
  const rows = profileRows(id, profile);
  const events = spec.events
    .map(([label], index) => ({ label, index }))
    .filter(({ index }) => id !== 'funding' || (profile.category === 'Góp vốn' ? index === 0 : index > 0))
    .filter(({ index }) => !isAssetProfile || index !== 0 || !hasInitialRecognition(profile, rows));
  return (
    pad(
      isAssetProfile ? '' : profile.code,
      (isAssetProfile ? titleWithCreate(profile.code) : '') +
        meta([
          [config.party, esc(partyName(profile))],
          ['Ngày hồ sơ', isoDate(profile.day)],
          ['Giá trị hồ sơ', money(profile.value)],
          ...(profile.monthlyAmount ? [['Mức mỗi tháng', money(profile.monthlyAmount)]] : []),
          [config.columns[1], money(profileBalance(id, profile))],
        ]) +
        '<div class="actions">' +
        a(id, 'Về danh sách') +
        (isAssetProfile ? '' : create) +
        '</div>',
    ) +
    pad('Lập nghiệp vụ', note('Số dư cập nhật sau khi bút toán được xác nhận ghi sổ.')) +
    pad(
      '',
      '<div class="actions">' +
        events.map(({ label, index }) => b('workflow-' + id + '-' + index, label, 'primary')).join('') +
        '</div>',
    ) +
    card(
      '<div class="pad"><h2>Bút toán liên quan</h2></div>' +
        table(
          ['Mã bút toán', 'Ngày hạch toán', 'Diễn giải', 'Số tiền', 'Trạng thái'],
          rows.map((x) => [
            recordLink('journal', x.code),
            esc(x.day),
            esc(partyName(x)),
            money(x.amount),
            pill(x.state, x.state === 'Đã ghi sổ' ? 'good' : ''),
          ]),
          [3],
        ),
    ) +
    ''
  );
}
const monthlyFlows = ['assets', 'prepaid'];
function monthlyDue(key, profile, period) {
  if (!profile.monthlyAmount || monthKey(postingPeriod(profile.day)) > monthKey(period)) return 0;
  const prior = profileRows(key, profile).filter(
    (x) =>
      monthKey(postingPeriod(x.day)) < monthKey(period) ||
      (postingPeriod(x.day) === period && x.workflowEvent === 0),
  );
  return Math.min(profile.monthlyAmount, Math.max(0, profileBalance(key, profile, prior)));
}
function pendingMonthly(key, period) {
  return profileStore[key].filter((profile) => {
    const due = monthlyDue(key, profile, period);
    const booked = profileRows(key, profile)
      .filter((x) => x.workflowEvent === 1 && x.state === 'Đã ghi sổ' && postingPeriod(x.day) === period)
      .reduce((n, x) => n + x.amount, 0);
    return due !== booked;
  });
}
function profilePostingError(entry, op) {
  if (!entry.profile) return '';
  const profile = profileStore[entry.flow]?.find((x) => x.code === entry.profile);
  if (!profile) return 'Không tìm thấy hồ sơ nguồn.';
  const old = profileRows(entry.flow, profile);
  if (op === 'post' && dayKey(entry.day) < profile.day) return 'Ngày hạch toán không được trước ngày hồ sơ.';
  if (
    monthlyFlows.includes(entry.flow) &&
    entry.workflowEvent === 0 &&
    op === 'post' &&
    hasInitialRecognition(profile, old, entry)
  )
    return 'Hồ sơ đã có nghiệp vụ ghi nhận ban đầu. Kiểm tra bút toán liên quan.';
  if (monthlyFlows.includes(entry.flow) && entry.workflowEvent === 1 && op === 'post') {
    const period = postingPeriod(entry.day);
    if (
      old.some(
        (x) =>
          x !== entry && x.state === 'Đã ghi sổ' && x.workflowEvent === 1 && postingPeriod(x.day) === period,
      )
    )
      return 'Hồ sơ đã ghi kỳ này.';
    if (entry.amount !== monthlyDue(entry.flow, profile, period))
      return 'Số tiền phải bằng mức cần thực hiện của kỳ theo hồ sơ. Hủy nháp và lập lại nếu kỳ đã thay đổi.';
  }
  if (
    monthlyFlows.includes(entry.flow) &&
    entry.workflowEvent === 0 &&
    op === 'cancel' &&
    old.some((x) => x.workflowEvent === 1 && x.state === 'Đã ghi sổ')
  )
    return 'Xử lý các kỳ đã khấu hao hoặc phân bổ trước khi hủy ghi tăng.';
  const candidate = old.map((x) =>
    x === entry ? { ...x, state: op === 'post' ? 'Đã ghi sổ' : 'Đã hủy' } : x,
  );
  if (profileBalance(entry.flow, profile, candidate) < 0)
    return 'Số tiền vượt số dư đã ghi sổ của hồ sơ. Kiểm tra nghiệp vụ liên quan.';
  return '';
}
function workflowDraft(id, index) {
  const spec = flowSpecs[id],
    event = spec?.events[index];
  if (!event) return;
  const selected = new URLSearchParams(location.hash.split('?')[1] || '').get('profile');
  const profile = profileStore[id].find((x) => x.code === selected);
  if (!profile) return;
  if (id === 'funding' && (profile.category === 'Góp vốn') !== (index === 0)) return;
  if (monthlyFlows.includes(id) && index === 0 && hasInitialRecognition(profile, profileRows(id, profile)))
    return openModal('Hồ sơ đã ghi nhận', note('Mở bút toán liên quan để kiểm tra.'), () => '', 'Đóng');
  const [label, debit, credit, defaultAmount] = event;
  const recurring = monthlyFlows.includes(id) && index === 1;
  const usePool = recurring && debit === '154';
  const dateField = field('Ngày hạch toán', 'day', sampleDate, 'date');
  const amountField = recurring
    ? '<div class="monthly-workflow-amount"><b>' +
      (id === 'assets' ? 'Mức khấu hao tháng' : 'Mức phân bổ tháng') +
      '</b>' +
      note(money(profile.monthlyAmount)) +
      '</div>'
    : field('Số tiền (đ)', 'amount', profile.sample ? defaultAmount : '', 'number');
  const account = (code) => accounts.find((value) => accountCode(value) === code) || code;
  const settle = id === 'advances' && index === 1;
  const settleAccounts = [
    '6422 · Chi phí quản lý doanh nghiệp',
    '6421 · Chi phí bán hàng',
    '152 · Nguyên liệu, vật liệu',
    '154 · Chi phí SXKD dở dang',
  ];
  const settleFields = settle
    ? [
        select('Tài khoản chi phí / vật tư', 'debit', settleAccounts, settleAccounts[0]),
        field('Thuế GTGT được khấu trừ (đ)', 'plus', '0', 'number'),
        workField(),
      ]
    : [];
  const settleNote = settle
    ? note(
        'Chọn lệnh chỉ khi ghi vào 154. Có hóa đơn GTGT thì nhập tiền thuế để ghi Nợ 1331; Có 141 bằng tiền hàng cộng thuế.',
      )
    : '';
  const salaryCut = id === 'advances' && index === 4;
  const salaryNote = salaryCut
    ? [
        optionsField(
          'Nhân viên bị trừ lương',
          'employee',
          employees.map((x) => [x.code, x.code + ' · ' + x.name]),
        ),
      ]
    : [];
  const salaryText = salaryCut
    ? note(
        'Ghi Nợ 334 / Có 141 theo nhân viên. Sau khi ghi sổ, khoản này tự trừ vào “Còn phải trả” của phiếu lương chính cùng kỳ.',
      )
    : '';
  openModal(
    label,
    meta([
      ['Hồ sơ', esc(profile.code + ' · ' + profile.party)],
      ['Nợ', settle ? 'Theo tài khoản chọn bên dưới' : esc(account(debit))],
      ['Có', esc(account(credit))],
    ]) +
      (recurring || id === 'funding'
        ? '<div class="formGrid workflow-date-amount">' + dateField + amountField + '</div>'
        : grid(
            dateField,
            amountField,
            ...settleFields,
            ...salaryNote,
            ...(!settle && debit === '154' ? [workField()] : []),
            ...(credit === '331' ? [payPartyField('suppliers', '')] : []),
          )) +
      (usePool && id === 'assets' ? note(commonLabel) : '') +
      settleNote +
      salaryText,
    (data) => {
      const day = String(data.get('day') || '');
      const dateError = postingDateError(day);
      if (dateError) return dateError;
      const period = postingPeriod(day);
      const amount = recurring ? monthlyDue(id, profile, period) : Number(data.get('amount'));
      if (
        recurring &&
        profileRows(id, profile).some(
          (x) => x.workflowEvent === 1 && x.state !== 'Đã hủy' && postingPeriod(x.day) === period,
        )
      )
        return 'Hồ sơ đã có chứng từ tháng này.';
      if (recurring && !amount)
        return 'Hồ sơ không có số phải thực hiện trong tháng đã chọn. Kiểm tra ngày ghi tăng và số còn lại.';
      if (!day || !Number.isSafeInteger(amount) || amount <= 0)
        return 'Nhập ngày và số tiền nguyên VND lớn hơn 0.';
      if (day < profile.day) return 'Ngày hạch toán không được trước ngày hồ sơ.';
      const debitCode = settle ? accountCode(String(data.get('debit') || '')) : debit;
      if (settle && !settleAccounts.some((x) => accountCode(x) === debitCode))
        return 'Chọn tài khoản chi phí hoặc vật tư.';
      const tax = settle ? Number(data.get('plus') || 0) : 0;
      if (!Number.isSafeInteger(tax) || tax < 0) return 'Kiểm tra tiền thuế GTGT.';
      const work = usePool ? commonWork : debitCode === '154' ? data.get('work') : null;
      if (debitCode === '154') {
        const error = workError(work, day);
        if (error) return error;
      }
      const cutEmployee = salaryCut ? employees.find((x) => x.code === data.get('employee')) : null;
      if (salaryCut && !cutEmployee) return 'Chọn nhân viên bị trừ lương.';
      const supplier = credit === '331' ? catalogMatch('suppliers', data.get('party')) : null;
      if (credit === '331' && !supplier) return 'Chọn nhà cung cấp từ danh mục để theo dõi phải trả.';
      const x = writeJournal(
        'JV-' + day.slice(0, 4) + '-' + String(100 + records.journal.length).padStart(5, '0'),
        isoDate(day),
        label + ' · ' + profile.party,
        [
          debitLine(debitCode, amount, cutEmployee?.code || work || profile.code),
          ...(tax ? [debitLine('1331', tax, profile.code)] : []),
          creditLine(credit, amount + tax, supplier?.code || profile.code),
        ],
        {
          ...(cutEmployee ? { wageOffset: 'Trừ lương từ tạm ứng' } : {}),
          flow: id,
          workflowEvent: index,
          profile: profile.code,
          source: profile.code,
          sourceRoute: profileLink(id, profile.code),
          commonType: usePool && id === 'assets' ? 'Cố định' : undefined,
          state: 'Nháp',
          log: 'Tạo từ ' + registry[id][0],
        },
      );
      route(journalHref(x.code));
      return '';
    },
    'Lưu bút toán nháp',
  );
}

function assetWorkspace(type) {
  const entries = [
    ['assets', 'Tài sản cố định & khấu hao'],
    ['prepaid', 'CCDC & chi phí trả trước'],
  ];
  const tabs = entries
    .map(
      ([id, label]) =>
        '<a href="#' + id + '" ' + (id === type ? 'aria-current="page"' : '') + '>' + esc(label) + '</a>',
    )
    .join('');
  return (
    card('<nav class="workflow-tabs" aria-label="Tài sản và phân bổ">' + tabs + '</nav>') + operations(type)
  );
}
