const insuranceFunds = [
  ['3383', 'BHXH'],
  ['3384', 'BHYT'],
  ['3385', 'BHTN'],
  ['3382', 'Kinh phí công đoàn'],
];
const insuranceVersions = [
  {
    day: '2026-01-01',
    rates: [
      [17.5, 8],
      [3, 1.5],
      [1, 1],
      [2, 0],
    ],
    union: false,
  },
];
const regionalMinimum = { I: 5310000, II: 4730000, III: 4140000, IV: 3700000 };
const laborAccounts = {
  'Thợ trực tiếp': '154',
  'Quản lý xưởng': '154',
  'Văn phòng': '6422',
  'Bán hàng / giao lắp': '6421',
};
const employees = [
  {
    code: 'NV-001',
    name: 'Lê Minh Tuấn',
    kind: 'Quản lý xưởng',
    region: 'II',
    insured: true,
    basis: 24000000,
  },
];
const wageRuns = [];
const insuranceAt = (day) =>
  insuranceVersions.filter((x) => x.day <= day).sort((a, b) => b.day.localeCompare(a.day))[0];
const insuranceWarning = (x) =>
  x.insured && x.basis < regionalMinimum[x.region]
    ? 'Lương đóng thấp hơn tối thiểu vùng ' + x.region + ' (' + money(regionalMinimum[x.region]) + ').'
    : '';
function insuranceView() {
  return pad(
    'Tỷ lệ theo ngày hiệu lực',
    b('ins-new', 'Thêm phiên bản tỷ lệ', 'primary') +
      table(
        ['Hiệu lực', 'Quỹ', 'TK', 'Doanh nghiệp', 'Người lao động', 'Áp dụng'],
        insuranceVersions.flatMap((cfg) =>
          insuranceFunds.map(([code, label], i) => [
            isoDate(cfg.day),
            label,
            code,
            cfg.rates[i][0] + '%',
            cfg.rates[i][1] + '%',
            i === 3 && !cfg.union ? 'Tắt' : 'Bật',
          ]),
        ),
      ) +
      note(
        'Tính trên lương đóng bảo hiểm đã khai. Cờ KPCĐ điều khiển riêng phần doanh nghiệp. Kiểm tra mức trần và đối tượng áp dụng trước khi dùng số liệu để kê khai.',
      ),
  );
}
function newInsurance() {
  const recent = insuranceAt(todayKey()) || insuranceVersions[0];
  return openModal(
    'Thêm phiên bản tỷ lệ',
    grid(
      field('Hiệu lực từ', 'day', todayKey(), 'date'),
      select('Kinh phí công đoàn', 'union', ['Tắt', 'Bật'], recent.union ? 'Bật' : 'Tắt'),
      ...insuranceFunds
        .slice(0, 3)
        .flatMap(([, label], i) => [
          field(label + ' doanh nghiệp (%)', 'em' + i, recent.rates[i][0], 'number'),
          field(label + ' người lao động (%)', 'ee' + i, recent.rates[i][1], 'number'),
        ]),
      field('KPCĐ doanh nghiệp (%)', 'em3', recent.rates[3][0], 'number'),
    ),
    (data) => {
      const day = data.get('day');
      const rates = insuranceFunds.map((_, i) => [
        Number(data.get('em' + i)),
        i === 3 ? 0 : Number(data.get('ee' + i)),
      ]);
      if (
        insuranceFunds.some(
          (_, i) =>
            !String(data.get('em' + i) ?? '').trim() || (i < 3 && !String(data.get('ee' + i) ?? '').trim()),
        ) ||
        !validDate(day) ||
        insuranceVersions.some((x) => x.day === day) ||
        rates.flat().some((x) => !Number.isFinite(x) || x < 0 || x > 100)
      )
        return 'Nhập ngày hiệu lực chưa có và tỷ lệ từ 0 đến 100%.';
      if (wageRuns.some((x) => x.day >= day))
        return 'Ngày hiệu lực nằm trong khoảng đã ghi lương. Chọn ngày sau đợt đã ghi.';
      insuranceVersions.push({ day, rates, union: data.get('union') === 'Bật' });
      say('Đã lưu tỷ lệ hiệu lực ' + isoDate(day));
      return '';
    },
    'Lưu tỷ lệ',
  );
}
function employeeView() {
  const { rows, toolbar } = searchList(
    'employees',
    employees,
    'Tìm theo mã hoặc họ tên nhân viên',
    (x) => [x.code, x.name],
    [
      ['kind', 'Tất cả loại lao động', columnChoices(employees.map((x) => x.kind)), (x) => x.kind],
      [
        'insured',
        'Tất cả diện đóng bảo hiểm',
        [
          ['yes', 'Thuộc diện đóng'],
          ['no', 'Không thuộc diện đóng'],
        ],
        (x) => (x.insured ? 'yes' : 'no'),
      ],
    ],
  );
  return pad(
    'Hồ sơ nhân viên',
    b('employee-new', 'Thêm nhân viên', 'primary') +
      toolbar +
      table(
        ['Mã', 'Họ tên', 'Loại lao động', 'Vùng', 'Thuộc diện đóng', 'Lương đóng BH', 'Kiểm tra', ''],
        rows.map((x) => [
          x.code,
          esc(x.name),
          x.kind,
          x.region,
          x.insured ? 'Có' : 'Không',
          money(x.basis),
          esc(insuranceWarning(x) || '—'),
          b('employee-edit|' + x.code, 'Sửa', 'link'),
        ]),
        [5],
      ),
  );
}
function editEmployee(x) {
  return openModal(
    x ? 'Sửa hồ sơ nhân viên' : 'Thêm nhân viên',
    grid(
      field('Họ tên', 'name', x?.name || ''),
      select('Loại lao động', 'kind', Object.keys(laborAccounts), x?.kind),
      select('Vùng lương', 'region', Object.keys(regionalMinimum), x?.region),
      select('Thuộc diện đóng bảo hiểm', 'insured', ['Có', 'Không'], x?.insured === false ? 'Không' : 'Có'),
      field('Lương đóng bảo hiểm (đ)', 'amount', x?.basis ?? '', 'number'),
    ),
    (data) => {
      const name = String(data.get('name') || '').trim(),
        kind = data.get('kind'),
        region = data.get('region'),
        insured = data.get('insured') === 'Có',
        basis = insured ? Number(data.get('amount')) : 0;
      if (
        !name ||
        !Object.hasOwn(laborAccounts, kind) ||
        !Object.hasOwn(regionalMinimum, region) ||
        !Number.isSafeInteger(basis) ||
        (insured && basis <= 0)
      )
        return 'Điền hồ sơ, vùng lương và căn cứ đóng hợp lệ.';
      const record = { name, kind, region, insured, basis };
      if (x) Object.assign(x, record);
      else employees.push({ ...record, code: 'NV-' + String(employees.length + 1).padStart(3, '0') });
      say(insuranceWarning(record) || 'Đã lưu hồ sơ nhân viên.');
      return '';
    },
    'Lưu hồ sơ',
  );
}
function wageModel(employee, day, gross, pit, work) {
  const cfg = insuranceAt(day),
    expense = laborAccounts[employee.kind],
    party = employee.code;
  if (employee.kind === 'Quản lý xưởng') work = commonWork;
  if (!cfg) return null;
  const funds = insuranceFunds.map(([code, label], i) => {
    const basis = employee.insured && (i !== 3 || cfg.union) ? employee.basis : 0;
    const [em, ee] = cfg.rates[i];
    return { code, label, em: Math.round((basis * em) / 100), ee: Math.round((basis * ee) / 100) };
  });
  const allocation = Array.isArray(work) ? work : [{ code: work || party, weight: 1 }];
  const expenseLines = (value) => {
    const shares = apportion(
      value,
      allocation.map((x) => x.weight),
    );
    return shares
      ? allocation.flatMap((x, i) => (shares[i] ? [debitLine(expense, shares[i], x.code)] : []))
      : [];
  };
  const lines = [...expenseLines(gross), creditLine('334', gross, party)];
  if (sum(lines, 2) !== gross) return null;
  let net = gross - pit;
  for (const x of funds) {
    if (x.em) {
      lines.push(...expenseLines(x.em), creditLine(x.code, x.em, party));
    }
    if (x.ee) {
      lines.push(debitLine('334', x.ee, party), creditLine(x.code, x.ee, party));
    }
    net -= x.ee;
  }
  if (pit) lines.push(debitLine('334', pit, party), creditLine('3335', pit, party));
  return {
    employee: party,
    name: employee.name,
    day,
    gross,
    pit,
    net,
    work: Array.isArray(work) ? '' : work,
    allocations: Array.isArray(work) ? work : null,
    lines,
    funds,
    rateDay: cfg.day,
  };
}
function bookWage(model, code = 'BL-' + String(wageRuns.length + 1).padStart(4, '0')) {
  wageRuns.push({ ...model, code, paid: 0, state: 'Chờ duyệt', submittedBy: roleLabels[demoRole] });
}
const postedWages = () => wageRuns.filter((x) => x.state === 'Đã ghi sổ');
function wageOffsets(run) {
  if (run.supplement) return 0;
  return records.journal
    .filter(
      (entry) =>
        entry.wageOffset &&
        entry.state === 'Đã ghi sổ' &&
        postingPeriod(entry.day) === postingPeriod(run.day),
    )
    .flatMap((entry) => entry.lines)
    .filter(([account, party, debit]) => accountCode(account) === '334' && party === run.employee)
    .reduce((n, [, , debit]) => n + (Number(debit) || 0), 0);
}
const wageDue = (run) => run.net - run.paid - wageOffsets(run);
const mainWage = (employee, period) =>
  wageRuns.find(
    (x) =>
      x.employee === employee && !x.supplement && x.state === 'Đã ghi sổ' && postingPeriod(x.day) === period,
  );
function wageAdvance() {
  return openModal(
    'Tạm ứng lương giữa kỳ',
    grid(
      optionsField(
        'Nhân viên',
        'employee',
        employees.map((x) => [x.code, x.code + ' · ' + x.name]),
      ),
      field('Ngày thanh toán', 'day', sampleDate, 'date'),
      field('Số tiền (đ)', 'amount', '', 'number'),
      select('Tài khoản tiền', 'cash', [accounts[0], accounts[1]]),
      field('Mã giao dịch ngân hàng', 'ref'),
    ) +
      note(
        'Ghi Nợ 334 / Có 111, 112 theo nhân viên. Khi lập bảng lương kỳ này, số đã ứng tự trừ vào “Còn phải trả”.',
      ),
    (data) => {
      const day = data.get('day'),
        amount = Number(data.get('amount')),
        cash = accountCode(data.get('cash')),
        employee = employees.find((x) => x.code === data.get('employee'));
      const error = postingDateError(day);
      if (error) return error;
      if (!employee) return 'Chọn nhân viên.';
      if (!Number.isSafeInteger(amount) || amount <= 0 || !['1111', '1121'].includes(cash))
        return 'Kiểm tra số tiền và tài khoản tiền.';
      if (cash === '1121' && !String(data.get('ref') || '').trim()) return 'Nhập mã giao dịch.';
      const lines = [debitLine('334', amount, employee.code), creditLine(cash, amount, employee.code)];
      const cashError = cashProjection(lines, day).error;
      if (cashError) return cashError;
      writeJournal(
        'JV-UL-' + String(records.journal.length + 1).padStart(4, '0'),
        isoDate(day),
        'Tạm ứng lương · ' + employee.name,
        lines,
        { wageOffset: 'Tạm ứng lương', source: employee.code, sourceRoute: 'wages', sourceManaged: true },
      );
      touchClosing(day);
      say('Đã chi tạm ứng lương ' + money(amount) + ' cho ' + employee.name + '.');
      return '';
    },
    'Ghi tạm ứng',
  );
}
function wageDeduction(run) {
  if (!run || run.state !== 'Đã ghi sổ') return;
  const kinds = {
    'Bồi thường thiệt hại · Có 1388': '1388',
    'Đoàn phí công đoàn · Có 3382': '3382',
    'Khoản phải trừ khác · Có 3388': '3388',
  };
  return openModal(
    'Khoản trừ lương · ' + run.code,
    meta([
      ['Nhân viên', esc(run.name)],
      ['Còn phải trả', money(wageDue(run))],
    ]) +
      grid(
        select('Loại khoản trừ', 'kind', Object.keys(kinds)),
        field('Ngày hạch toán', 'day', sampleDate, 'date'),
        field('Số tiền (đ)', 'amount', '', 'number'),
        field('Nội dung', 'memo'),
      ),
    (data) => {
      const day = data.get('day'),
        amount = Number(data.get('amount')),
        code = kinds[data.get('kind')];
      const error = postingDateError(day);
      if (error) return error;
      if (!code) return 'Chọn loại khoản trừ.';
      if (postingPeriod(day) !== postingPeriod(run.day))
        return 'Khoản trừ phải cùng kỳ lương ' + postingPeriod(run.day) + '.';
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > wageDue(run))
        return 'Số tiền phải dương và không vượt số còn phải trả.';
      if (!String(data.get('memo') || '').trim()) return 'Nhập nội dung khoản trừ.';
      writeJournal(
        'JV-TL-' + String(records.journal.length + 1).padStart(4, '0'),
        isoDate(day),
        'Trừ lương · ' + run.name + ' · ' + String(data.get('memo')).trim(),
        [debitLine('334', amount, run.employee), creditLine(code, amount, run.employee)],
        { wageOffset: data.get('kind'), source: run.code, sourceRoute: 'wages', sourceManaged: true },
      );
      touchClosing(day);
      say('Đã ghi khoản trừ ' + money(amount) + '.');
      return '';
    },
    'Ghi khoản trừ',
  );
}
function postWage(run) {
  writeJournal('JV-' + run.code, isoDate(run.day), 'Lương và các khoản trích · ' + run.name, run.lines, {
    source: run.code,
    sourceRoute: 'wages',
    sourceManaged: true,
    commonType: run.work === commonWork ? 'Cố định' : undefined,
  });
  run.state = 'Đã ghi sổ';
  touchClosing(run.day);
}
function wageReview(op, run) {
  if (!run) return;
  if (op === 'submit') {
    if (run.state !== 'Nháp') return;
    run.state = 'Chờ duyệt';
    run.reason = '';
    return say('Đã gửi duyệt ' + run.code + '.');
  }
  if (op === 'delete') {
    if (run.state === 'Đã ghi sổ') return;
    return ask(
      'Xóa phiếu lương nháp',
      note(esc(run.code) + ' · ' + esc(run.name)),
      () => {
        wageRuns.splice(wageRuns.indexOf(run), 1);
        say('Đã xóa ' + run.code + '.');
      },
      'Xóa nháp',
    );
  }
  if (!tenantOnly() || run.state !== 'Chờ duyệt') return;
  const reject = op === 'reject';
  return openModal(
    (reject ? 'Từ chối phiếu lương ' : 'Duyệt phiếu lương ') + run.code,
    meta([
      ['Nhân viên / Tổ', esc(run.name + (run.team ? ' · ' + run.team : ''))],
      ['Lương gộp', money(run.gross)],
      ['TNCN', money(run.pit)],
      ['Thực lĩnh', money(run.net)],
      ['Người lập', esc(run.submittedBy || '—')],
    ]) + (reject ? textArea('Lý do từ chối', 'reason') : postingPreview(run.lines, run.day)),
    (data) => {
      if (reject) {
        const reason = String(data.get('reason') || '').trim();
        if (!reason) return 'Nhập lý do từ chối.';
        run.state = 'Nháp';
        run.reason = reason;
        say('Đã trả ' + run.code + ' về Nháp.');
        return '';
      }
      const error = postingDateError(run.day);
      if (error) return error;
      postWage(run);
      say('Đã duyệt và ghi sổ ' + run.code + '.');
      return '';
    },
    reject ? 'Từ chối' : 'Duyệt và ghi sổ',
  );
}
function remitPayroll() {
  const kinds = {
    'Bảo hiểm (BHXH, BHYT, BHTN)': ['3383', '3384', '3385'],
    'Kinh phí công đoàn': ['3382'],
    'Thuế TNCN': ['3335'],
  };
  return openModal(
    'Nộp bảo hiểm / thuế TNCN',
    grid(
      select('Khoản nộp', 'kind', Object.keys(kinds)),
      field('Ngày thanh toán', 'day', sampleDate, 'date'),
      field('Mã giao dịch ngân hàng', 'ref'),
    ) +
      note(
        'Số nộp bằng số dư Có của tài khoản tại ngày nộp. Bảo hiểm đối chiếu thông báo trước khi nộp; thuế TNCN nộp theo tờ khai 05/KK-TNCN đã chốt.',
      ),
    (data) => {
      const day = data.get('day'),
        codes = kinds[data.get('kind')];
      const error = postingDateError(day);
      if (error) return error;
      if (!codes) return 'Chọn khoản nộp.';
      if (!String(data.get('ref') || '').trim()) return 'Nhập mã giao dịch.';
      const due = codes
        .map((code) => [code, Math.max(0, -postedAmount(code, postingPeriod(day)))])
        .filter(([, n]) => n > 0);
      if (!due.length) return 'Không còn số phải nộp cho khoản này.';
      if (data.get('kind') === 'Thuế TNCN' && stage.pit !== 'Đã chốt' && stage.pit !== 'Đã nộp')
        return 'Chốt tờ khai 05/KK-TNCN trước khi nộp thuế TNCN.';
      const total = due.reduce((n, [, v]) => n + v, 0);
      const lines = [...due.map(([code, v]) => debitLine(code, v)), creditLine('1121', total)];
      writeJournal(
        'JV-NOP-' + String(records.journal.length + 1).padStart(4, '0'),
        isoDate(day),
        'Nộp ' + data.get('kind').toLowerCase() + ' · ' + String(data.get('ref')).trim(),
        lines,
        { source: 'Bảng lương', sourceRoute: 'wages', sourceManaged: true },
      );
      touchClosing(day);
      say('Đã ghi phiếu chi nộp ' + money(total) + '.');
      return '';
    },
    'Ghi phiếu chi',
  );
}
function wageView() {
  const { rows, toolbar } = searchList(
    'wages',
    wageRuns,
    'Tìm theo mã phiếu, nhân viên hoặc tổ',
    (x) => [x.code, x.employee, x.name, x.team, x.work],
    [
      [
        'period',
        'Tất cả kỳ lương',
        columnChoices(wageRuns.map((x) => postingPeriod(x.day))),
        (x) => postingPeriod(x.day),
      ],
      [
        'payment',
        'Tất cả trạng thái trả lương',
        [
          ['unpaid', 'Còn phải trả'],
          ['paid', 'Đã trả đủ'],
        ],
        (x) => (wageDue(x) > 0 ? 'unpaid' : 'paid'),
      ],
    ],
  );
  const wageActions = (x) =>
    x.state === 'Chờ duyệt'
      ? tenantOnly()
        ? b('wage-approve|' + x.code, 'Duyệt', 'link') + b('wage-reject|' + x.code, 'Từ chối', 'link')
        : 'Chờ Quản trị tenant duyệt'
      : x.state === 'Nháp'
        ? b('wage-submit|' + x.code, 'Gửi duyệt lại', 'link') + b('wage-delete|' + x.code, 'Xóa', 'link')
        : wageDue(x) > 0
          ? b('wage-pay|' + x.code, 'Trả lương', 'link') + b('wage-deduct|' + x.code, 'Khoản trừ', 'link')
          : '—';
  return (
    pad(
      'Bảng lương và các khoản trích',
      '<div class="actions">' +
        b('wage-new', 'Lập bảng lương', 'primary') +
        b('wage-batch', 'Lương hàng loạt / lương khoán') +
        b('wage-advance', 'Tạm ứng lương giữa kỳ') +
        b('wage-remit', 'Nộp bảo hiểm / thuế TNCN') +
        a('employees', 'Hồ sơ nhân viên') +
        a('insurance', 'Tỷ lệ bảo hiểm') +
        '</div>' +
        note(
          'Phiếu lương: Nháp → Chờ duyệt → Đã ghi sổ. Chỉ phiếu đã duyệt mới ghi sổ, được trả lương và lên tờ khai TNCN. Còn phải trả = thực lĩnh − đã trả − tạm ứng lương − khoản trừ (gồm trừ lương từ hồ sơ tạm ứng) của cùng kỳ.',
        ) +
        toolbar +
        table(
          ['Phiếu', 'Nhân viên / Tổ', 'Ngày', 'Lệnh', 'Lương gộp', 'TNCN', 'Còn phải trả', 'Trạng thái', ''],
          rows.map((x) => [
            x.state === 'Đã ghi sổ' ? journalAnchor('JV-' + x.code) : esc(x.code),
            esc(x.name + (x.team ? ' · ' + x.team : '')),
            isoDate(x.day),
            x.allocations
              ? x.allocations.map((r) => a(workUrl(r.code), r.code)).join(' · ')
              : x.work === commonWork
                ? a(commonSource, commonLabel)
                : x.work
                  ? a(workUrl(x.work), x.work)
                  : '—',
            money(x.gross),
            money(x.pit),
            money(wageDue(x)) +
              (wageOffsets(x)
                ? '<small class="muted"> đã ứng / trừ ' + money(wageOffsets(x)) + '</small>'
                : ''),
            pill(x.state, x.state === 'Đã ghi sổ' ? 'good' : 'attn') +
              (x.reason ? '<small class="muted"> ' + esc(x.reason) + '</small>' : ''),
            wageActions(x),
          ]),
          [4, 5, 6],
        ),
    ) +
    pad(
      'Chi tiết trích theo quỹ',
      table(
        ['Phiếu', 'Quỹ', 'TK', 'Doanh nghiệp', 'Người lao động', 'Hiệu lực'],
        rows
          .filter((x) => x.state === 'Đã ghi sổ')
          .flatMap((x) =>
            x.funds.map((f) => [x.code, f.label, f.code, money(f.em), money(f.ee), isoDate(x.rateDay)]),
          ),
        [3, 4],
      ),
    )
  );
}
function newWage() {
  return openModal(
    'Lập bảng lương',
    grid(
      optionsField(
        'Nhân viên',
        'employee',
        employees.map((x) => [x.code, x.code + ' · ' + x.name]),
      ),
      select('Loại phiếu', 'wagekind', ['Lương chính', 'Bổ sung (truy lĩnh / điều chỉnh)'], 'Lương chính'),
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      field('Lương gộp (đ)', 'amount', '', 'number'),
      field('Thuế TNCN đã xác định (đ)', 'paid', '0', 'number'),
    ) +
      '<div id="wage-direct-work" hidden>' +
      workField() +
      '</div><p id="wage-cost-destination" class="note" role="status"></p>',
    (data) => {
      const day = data.get('day'),
        employee = employees.find((x) => x.code === data.get('employee'));
      const error = postingDateError(day);
      if (error) return error;
      if (!employee) return 'Chọn nhân viên.';
      const supplement = data.get('wagekind') !== 'Lương chính';
      const main = supplement ? mainWage(employee.code, postingPeriod(day)) : null;
      if (supplement && !main)
        return 'Phiếu bổ sung cần phiếu lương chính đã ghi sổ của nhân viên trong cùng kỳ.';
      if (
        !supplement &&
        wageRuns.some(
          (x) => x.employee === employee.code && !x.supplement && postingPeriod(x.day) === postingPeriod(day),
        )
      )
        return 'Nhân viên đã có bảng lương chính trong kỳ này. Chọn loại Bổ sung nếu là truy lĩnh hoặc điều chỉnh.';
      const gross = Number(data.get('amount')),
        pit = Number(data.get('paid')),
        work =
          employee.kind === 'Quản lý xưởng'
            ? commonWork
            : employee.kind === 'Thợ trực tiếp'
              ? data.get('work')
              : '';
      if (!Number.isSafeInteger(gross) || gross <= 0 || !Number.isSafeInteger(pit) || pit < 0)
        return 'Kiểm tra tổng lương và TNCN.';
      if (laborAccounts[employee.kind] === '154') {
        const error = workError(work, day);
        if (error) return error;
      }
      const model = wageModel(supplement ? { ...employee, insured: false } : employee, day, gross, pit, work);
      if (!model || model.net < 0) return 'Kiểm tra phiên bản tỷ lệ và lương thực lĩnh.';
      if (supplement) {
        model.supplement = main.code;
        model.name = employee.name + ' · bổ sung ' + main.code;
      }
      bookWage(model);
      say(insuranceWarning(employee) || 'Đã lưu và gửi duyệt bảng lương. Quản trị tenant duyệt để ghi sổ.');
      return '';
    },
    'Lưu và gửi duyệt',
  );
}
function wagePayment(run) {
  if (!run) return;
  return openModal(
    'Thanh toán lương · ' + run.code,
    grid(
      field('Ngày thanh toán', 'day', sampleDate, 'date'),
      field('Số tiền (đ)', 'amount', wageDue(run), 'number'),
      select('Tài khoản tiền', 'cash', [accounts[0], accounts[1]]),
      field('Mã giao dịch ngân hàng', 'ref'),
    ),
    (data) => {
      const day = data.get('day'),
        amount = Number(data.get('amount')),
        cash = accountCode(data.get('cash'));
      const error = postingDateError(day);
      if (error) return error;
      if (
        day < run.day ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > wageDue(run) ||
        !['1111', '1121'].includes(cash)
      )
        return 'Kiểm tra ngày, tiền và số còn phải trả.';
      if (cash === '1121' && !String(data.get('ref') || '').trim()) return 'Nhập mã giao dịch.';
      const lines = [debitLine('334', amount, run.employee), creditLine(cash, amount, run.employee)];
      const cashError = cashProjection(lines, day).error;
      if (cashError) return cashError;
      writeJournal(
        'JV-' + run.code + '-TT-' + records.journal.length,
        isoDate(day),
        'Thanh toán lương · ' + run.name,
        lines,
        { source: run.code, sourceRoute: 'wages', sourceManaged: true },
      );
      run.paid += amount;
      touchClosing(day);
      say('Đã thanh toán ' + money(amount));
      return '';
    },
    'Ghi thanh toán',
  );
}

const insuranceNotices = new Map();
const noticeFunds = () => insuranceFunds.slice(0, 3);
function insuranceTotals(period) {
  return noticeFunds().map(([code]) =>
    postedWages()
      .filter((x) => postingPeriod(x.day) === period)
      .flatMap((x) => x.funds)
      .filter((x) => x.code === code)
      .reduce((n, x) => n + x.em + x.ee, 0),
  );
}
function insuranceReconciliation() {
  const actual = insuranceTotals(closingPeriod);
  const expected = insuranceNotices.get(closingPeriod);
  return pad(
    'Đối chiếu thông báo bảo hiểm · ' + closingPeriod,
    b('ins-notice', 'Nhập số theo thông báo') +
      note(
        'Đối chiếu 3 quỹ trên thông báo của cơ quan BHXH. Kinh phí công đoàn nộp cho công đoàn nên không đối chiếu ở đây.',
      ) +
      table(
        ['Quỹ', 'Đã trích', 'Thông báo', 'Chênh lệch'],
        noticeFunds().map(([, name], i) => [
          name,
          money(actual[i]),
          expected ? money(expected[i]) : '—',
          expected ? money(actual[i] - expected[i]) : '—',
        ]),
        [1, 2, 3],
      ),
  );
}
function insuranceNotice() {
  if (periodLocked(periodEnd(closingPeriod)))
    return openModal('Kỳ đã khóa', note('Mở lại kỳ để cập nhật số đối chiếu.'), () => '', 'Đóng');
  return openModal(
    'Thông báo bảo hiểm · ' + closingPeriod,
    grid(
      ...noticeFunds().map(
        ([, label], i) =>
          '<label>' +
          label +
          moneyInput(insuranceNotices.get(closingPeriod)?.[i] ?? '', 'name="notice' + i + '"') +
          '</label>',
      ),
    ),
    (data) => {
      if (periodLocked(periodEnd(closingPeriod))) return 'Kỳ đã khóa.';
      const raw = noticeFunds().map((_, i) => data.get('notice' + i));
      const values = raw.map(Number);
      if (raw.some((x) => x === null || x === '') || values.some((x) => !Number.isSafeInteger(x) || x < 0))
        return 'Nhập số theo thông báo của từng quỹ, gồm cả số 0.';
      insuranceNotices.set(closingPeriod, values);
      touchClosing();
      say('Đã cập nhật số đối chiếu bảo hiểm.');
      return '';
    },
    'Lưu đối chiếu',
  );
}

function wageBatch() {
  const eligible = employees.slice();
  return openModal(
    'Bảng lương hàng loạt theo tổ',
    grid(field('Tổ / Nhóm', 'team'), field('Ngày hạch toán', 'day', sampleDate, 'date')) +
      note(
        'Mỗi nhân viên nhập lương gộp hoặc sản lượng × đơn giá khoán. Chọn lệnh và khai giờ công cho thợ trực tiếp.',
      ) +
      '<label>Nhập CSV chấm công<input id="timesheet-file" type="file" accept=".csv,.tsv,text/csv"></label>' +
      note('Cột CSV: ma_nhan_vien, ma_lenh, so_gio. Tệp chỉ điền giờ vào lưới.') +
      '<p id="timesheet-status" class="note" role="status"></p>' +
      table(
        ['Nhân viên', 'Lương gộp', 'Sản lượng khoán', 'Đơn giá khoán', 'TNCN', 'Phân bổ giờ công'],
        eligible.map((x, i) => [
          esc(x.code + ' · ' + x.name + ' · ' + x.kind),
          moneyInput('', 'name="gross' + i + '" aria-label="Lương gộp ' + x.code + '"'),
          field('Sản lượng', 'pieces' + i, '', 'number'),
          moneyInput('', 'name="rate' + i + '" aria-label="Đơn giá khoán ' + x.code + '"'),
          moneyInput('', 'name="tax' + i + '" aria-label="TNCN ' + x.code + '"'),
          x.kind === 'Thợ trực tiếp' ? wageHourGrid(i, x) : '—',
        ]),
      ),
    (data) => {
      const day = data.get('day'),
        team = String(data.get('team') || '').trim(),
        err = postingDateError(day);
      if (err) return err;
      if (!team) return 'Nhập tên tổ hoặc nhóm.';
      const models = [];
      for (const [i, employee] of eligible.entries()) {
        const raw = data.get('gross' + i),
          pieces = data.get('pieces' + i),
          rate = data.get('rate' + i),
          rawTax = data.get('tax' + i);
        if (!raw && !pieces && !rate && !rawTax) {
          if (data.getAll('allocWork' + i).some(Boolean) || data.getAll('allocHours' + i).some(Boolean))
            return employee.code + ': đã nhập giờ công, hãy nhập số lương hoặc sản lượng khoán.';
          continue;
        }
        if (raw && (pieces || rate)) return employee.code + ': chỉ nhập một cách tính lương.';
        const gross = raw ? Number(raw) : Math.round(Number(pieces) * Number(rate)),
          pit = Number(rawTax) || 0;
        if (!Number.isSafeInteger(gross) || gross <= 0 || !Number.isSafeInteger(pit) || pit < 0)
          return employee.code + ': kiểm tra số lương và TNCN.';
        if (wageRuns.some((x) => x.employee === employee.code && postingPeriod(x.day) === postingPeriod(day)))
          return employee.code + ': đã có lương kỳ này.';
        const shares = employee.kind === 'Thợ trực tiếp' ? readWageHours(data, i) : null;
        if (
          employee.kind === 'Thợ trực tiếp' &&
          (!shares || shares.some((x) => x.code === commonWork || workError(x.code, day)))
        )
          return employee.code + ': chọn lệnh còn nhận chi phí, nhập số giờ dương và tránh chọn trùng lệnh.';
        const model = wageModel(employee, day, gross, pit, shares || '');
        if (!model || model.net < 0) return employee.code + ': kiểm tra tỷ lệ và lương thực lĩnh.';
        models.push({ ...model, team });
      }
      if (!models.length) return 'Nhập ít nhất một dòng lương.';
      for (const model of models) bookWage(model);
      say(
        'Đã gửi duyệt lương ' + models.length + ' nhân viên · ' + team + '. Quản trị tenant duyệt để ghi sổ.',
      );
      return '';
    },
    'Lưu và gửi duyệt',
  );
}

function wageHourRow(index, code = '', hours = '') {
  const choices = workOrders
    .filter((x) => ['Đang sản xuất', 'Hoàn thành'].includes(x.state))
    .map((x) => [x.code, x.code + ' · ' + x.state]);
  return (
    '<tr><td>' +
    optionsField('Lệnh', 'allocWork' + index, choices, code) +
    '</td><td>' +
    field('Số giờ', 'allocHours' + index, hours, 'number') +
    '</td>' +
    '<td><button type="button" data-hours-remove aria-label="Xóa dòng giờ công">×</button></td></tr>'
  );
}
function wageHourGrid(index, employee) {
  return (
    '<div data-wage-hours="' +
    index +
    '" data-employee="' +
    esc(employee.code) +
    '"><table><thead><tr><th>Lệnh</th><th>Số giờ</th><th></th></tr></thead>' +
    '<tbody>' +
    wageHourRow(index) +
    '</tbody></table><p>Tổng giờ <strong data-hours-total aria-live="polite">0</strong></p>' +
    '<button type="button" data-hours-add>Thêm lệnh</button></div>'
  );
}
function readWageHours(data, index) {
  const codes = data.getAll('allocWork' + index),
    hours = data.getAll('allocHours' + index);
  if (codes.length !== hours.length) return null;
  const used = codes
    .map((code, i) => ({ code, raw: hours[i], weight: Number(hours[i]) }))
    .filter((x) => x.code || x.raw !== '');
  if (!used.length || new Set(used.map((x) => x.code)).size !== used.length) return null;
  if (used.some((x) => !x.code || !Number.isFinite(x.weight) || x.weight <= 0)) return null;
  return used.map(({ code, weight }) => ({ code, weight }));
}
function refreshHours(grid) {
  const sum = [...grid.querySelectorAll('input[name^="allocHours"]')].reduce(
    (n, x) => n + (Number(x.value) > 0 ? Number(x.value) : 0),
    0,
  );
  grid.querySelector('[data-hours-total]').textContent = String(Number(sum.toFixed(4)));
}
function parseWageTimesheet(text) {
  const lines = String(text)
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length) return { error: 'Tệp chấm công trống.' };
  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const read = (line) =>
    line.split(sep).map((x) =>
      x
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .trim(),
    );
  const heading = read(lines[0]).map((x) => normalizedSearch(x).replace(/[^a-z0-9]/g, ''));
  if (heading.join('|') !== 'manhanvien|malenh|sogio' || lines.length < 2)
    return { error: 'Cần ba cột mã nhân viên, mã lệnh, số giờ và ít nhất một dòng.' };
  const validWorkers = new Set(employees.filter((x) => x.kind === 'Thợ trực tiếp').map((x) => x.code));
  const validOrders = new Set(
    workOrders.filter((x) => ['Đang sản xuất', 'Hoàn thành'].includes(x.state)).map((x) => x.code),
  );
  const grouped = new Map();
  for (const [i, line] of lines.slice(1).entries()) {
    const values = read(line),
      [worker, code, raw] = values;
    const hours = Number((raw || '').replace(',', '.'));
    if (
      values.length !== 3 ||
      !validWorkers.has(worker) ||
      !validOrders.has(code) ||
      !Number.isFinite(hours) ||
      hours <= 0
    )
      return { error: 'Dòng ' + (i + 2) + ' có mã nhân viên, mã lệnh hoặc số giờ không hợp lệ.' };
    if (!grouped.has(worker)) grouped.set(worker, new Map());
    const previous = grouped.get(worker).get(code) || 0;
    grouped.get(worker).set(code, Number((previous + hours).toFixed(4)));
  }
  return { grouped };
}
async function importWageHours(input) {
  const file = input.files?.[0],
    status = $('timesheet-status');
  if (!file || !status) return;
  let parsed;
  try {
    parsed = parseWageTimesheet(await file.text());
  } catch {
    parsed = { error: 'Không đọc được tệp chấm công.' };
  }
  if (!input.isConnected || $('timesheet-status') !== status) return;
  if (parsed.error) {
    status.textContent = parsed.error;
    input.value = '';
    return;
  }
  for (const grid of $('dialogForm').querySelectorAll('[data-wage-hours]')) {
    const hours = parsed.grouped.get(grid.dataset.employee);
    if (!hours) continue;
    grid.querySelector('tbody').innerHTML = [...hours]
      .map(([code, qty]) => wageHourRow(grid.dataset.wageHours, code, qty))
      .join('');
    refreshHours(grid);
  }
  status.textContent =
    'Đã điền giờ công của ' + parsed.grouped.size + ' nhân viên. Rà soát lưới trước khi ghi lương.';
  input.value = '';
}
