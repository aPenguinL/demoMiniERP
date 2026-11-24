const closingPeriod = '11/2026';
const closePeriods = {
  '10/2026': { from: '01/10/2026', to: '31/10/2026', state: 'Đã khóa', updated: '03/11/2026' },
  '11/2026': { from: '01/11/2026', to: '30/11/2026' },
  '12/2026': { from: '01/12/2026', to: '31/12/2026', state: 'Đang mở' },
};
let selectedClosePeriod = closingPeriod;
const isClosePage = (id) =>
  ['allocation', 'cost', '23', 'reconcile', 'close-review', '24'].includes(String(id));
const closeHref = (id, period = selectedClosePeriod) => id + '?period=' + encodeURIComponent(period);
const postingPeriod = (value) => {
  const date = dayKey(value);
  return date.slice(5, 7) + '/' + date.slice(0, 4);
};
const periodLocked = (value) => {
  const period = postingPeriod(value);
  return period === closingPeriod ? stage.period === 'Đã khóa' : closePeriods[period]?.state === 'Đã khóa';
};
function touchClosing(value) {
  if (!value || postingPeriod(value) === closingPeriod) {
    if (stage.closing || stage.reviewed) stage.redo = true;
    stage.closing = false;
    stage.approvedClosing = null;
    stage.closingReview = null;
    stage.reviewed = false;
  }
}
const closeApproved = () =>
  Boolean(stage.closing && currentClosing() && stage.approvedClosing?.code === currentClosing().code);
const closingReview = () =>
  stage.closing && currentClosing() && stage.closingReview?.code === currentClosing().code
    ? stage.closingReview
    : null;
const reviewStatus = () => (closeApproved() ? 'Đã duyệt' : closingReview()?.state || 'Chưa gửi duyệt');
const currentClosing = () => records.journal.find((x) => x.closeEntry && x.state === 'Đã ghi sổ');
function closingChecks() {
  const drafts = [
    ...Object.values(records).flat(),
    ...purchaseOrders,
    ...receipts,
    ...salesOrders,
    ...salesDeliveries,
  ].filter((x) => x.state === 'Nháp' && (x.post ? isoDate(x.post) : x.day).slice(3) === closingPeriod).length;
  const unmatched = bank.filter((x) => x[0].slice(3) === closingPeriod && x[4] === 'Chờ khớp').length;
  const production = pendingProduction(closingPeriod);
  const pool = commonBalance(periodEnd(closingPeriod));
  return [
    ['Chênh lệch đối soát', unresolved() + ' khoản', unresolved() ? 'Chặn' : 'Đạt', 23],
    ['Chứng từ nháp trong kỳ', drafts + ' chứng từ', drafts ? 'Chặn' : 'Đạt', 2],
    (() => {
      const waiting = unreviewedSpecial();
      return [
        'Chứng từ mua chưa duyệt',
        waiting.length ? waiting.map((x) => x.code).join(', ') : 'Đã duyệt đủ',
        waiting.length ? 'Chặn' : 'Đạt',
        waiting.length ? purchaseHref(waiting[0].code) : 'noinvoice',
      ];
    })(),

    ...[
      ['assets', 'Khấu hao TSCĐ'],
      ['prepaid', 'Phân bổ TK 242'],
    ].map(([key, label]) => {
      const pending = pendingMonthly(key, closingPeriod);
      return [
        label,
        pending.length ? pending.map((x) => x.code).join(', ') : 'Đã đủ theo hồ sơ',
        pending.length ? 'Chặn' : 'Đạt',
        pending.length ? profileLink(key, pending[0].code) : key,
      ];
    }),

    ...operationalCloseChecks(),
    ['Giao dịch ngân hàng chưa khớp', unmatched + ' giao dịch', unmatched ? 'Cần rà soát' : 'Đạt', 10],
    [
      'Bút toán kết chuyển',
      currentClosing()?.code || 'Chưa ghi',
      stage.closing ? 'Đạt' : 'Chưa thực hiện',
      'reconcile',
    ],
    ['Duyệt báo cáo kỳ', reviewStatus(), closeApproved() ? 'Đạt' : reviewStatus(), 'close-review'],
  ];
}
const closeBlockers = () => closingChecks().filter((row) => row[2] === 'Chặn');
const unreviewedSpecial = () =>
  records.buy.filter(
    (x) =>
      x.special &&
      x.state === 'Đã ghi sổ' &&
      x.review === 'Chờ duyệt' &&
      postingPeriod(x.post || x.day) === closingPeriod,
  );
function reviewSpecial(x) {
  if (!x || x.review !== 'Chờ duyệt' || !tenantOnly()) return;
  return openModal(
    'Duyệt chứng từ mua · ' + x.code,
    meta([
      ['Loại', x.special === 'noinvoice' ? 'Mua không hóa đơn' : 'Gia công ngoài'],
      ['Đối tác', esc(x.party)],
      ['Số tiền', money(x.amount)],
      ['Người lập', esc(x.createdBy || '—')],
    ]) +
      (x.seller
        ? note('Căn cứ lập bảng kê: ' + esc(x.seller.basis) + ' · Số định danh: ' + esc(x.seller.identity))
        : '') +
      note('Duyệt xác nhận chứng từ đủ căn cứ. Không đủ căn cứ thì hủy chứng từ tại chứng từ nguồn.'),
    () => {
      x.review = 'Đã duyệt';
      x.reviewedBy = roleLabels[demoRole];
      say('Đã duyệt ' + x.code + '.');
      return '';
    },
    'Duyệt',
  );
}
const precheckLabels = new Set([
  'Chứng từ mua chưa duyệt',
  'Chứng từ nháp trong kỳ',
  'Lương kỳ chưa ghi sổ',
  'Khấu hao TSCĐ',
  'Phân bổ TK 242',
  'Kiểm kê chưa xử lý',
]);
const precheckRows = () => closingChecks().filter((row) => precheckLabels.has(row[0]));
const precheckBlockers = () => precheckRows().filter((row) => row[2] === 'Chặn');
function precheckPanel() {
  const blockers = precheckBlockers(),
    rows = precheckRows();
  const list = table(
    ['Kiểm tra', 'Kết quả', 'Mức', 'Thao tác'],
    rows.map(([label, result, state, id]) => [
      label,
      esc(result),
      pill(state, state === 'Đạt' ? 'good' : 'attn'),
      a(id, 'Mở chi tiết'),
    ]),
  );
  if (blockers.length)
    return pad(
      'Tiền kiểm trước khi chốt sổ',
      '<p class="blocking-error" role="status">Còn ' +
        blockers.length +
        ' điều kiện tiền kiểm chưa đạt. Xử lý các mục bên dưới trước khi tiếp tục chốt sổ.</p>' +
        list,
    );
  return pad(
    '',
    '<details><summary>' +
      pill('Tiền kiểm đạt ' + rows.length + '/' + rows.length, 'good') +
      ' Các mục tiền kiểm Phase 1 đã đủ. Bấm để xem chi tiết.</summary>' +
      list +
      '</details>',
  );
}
const precheckGuard = () =>
  precheckBlockers().length
    ? openModal(
        'Tiền kiểm chưa đạt',
        note('Xử lý các mục đang chặn trước khi kết chuyển và khóa sổ.') +
          table(
            ['Kiểm tra', 'Kết quả'],
            precheckBlockers().map(([label, result, , id]) => [a(id, label), esc(result)]),
          ),
        () => '',
        'Đóng',
      )
    : null;
const redoNote = () =>
  stage.redo
    ? '<p class="blocking-error" role="status">Có chứng từ ghi sổ, hủy hoặc đổi ngày vào kỳ sau khi đã đối soát / kết chuyển. Các bước từ Đối soát trở đi chuyển “Cần làm lại”.</p>'
    : '';
function closingChecklist() {
  return (
    (todayKey() < dayKey(closePeriods[closingPeriod].to)
      ? note('Kết chuyển mở từ ngày ' + closePeriods[closingPeriod].to + '. Có thể đối soát trong kỳ.')
      : '') +
    table(
      ['Kiểm tra', 'Kết quả', 'Mức', 'Thao tác'],
      closingChecks().map(([label, result, state, id]) => [
        label,
        esc(result),
        pill(state, state === 'Đạt' ? 'good' : 'attn'),
        a(id, 'Mở chi tiết'),
      ]),
    )
  );
}
function closing() {
  const entry = currentClosing();
  return (
    pad('Kiểm tra trước kết chuyển', closingChecklist()) +
    pad(
      'Bút toán kết chuyển',
      '<div class="actions">' +
        (entry && stage.closing
          ? journalAnchor(entry.code)
          : b('closing', 'Xem trước kết chuyển', 'primary')) +
        (stage.closing ? ' ' + a('close-review', 'Rà soát báo cáo trước khi khóa') : '') +
        '</div>' +
        (entry && !stage.closing
          ? note(
              'Có phát sinh thay đổi sau kết chuyển. Khi xác nhận lại, bản thử sẽ đảo bút toán trước và lưu bút toán mới.',
            )
          : ''),
    ) +
    (records.journal.some((x) => x.closeEntry)
      ? pad(
          'Lịch sử kết chuyển',
          table(
            ['Bút toán', 'Trạng thái', 'Diễn giải'],
            records.journal
              .filter((x) => x.closeEntry)
              .map((x) => [journalAnchor(x.code), pill(x.state), esc(x.log)]),
          ),
        )
      : '')
  );
}
function periodView() {
  return (
    pad('Điều kiện khóa sổ', closingChecklist()) +
    pad(
      'Kỳ kế toán',
      table(
        ['Kỳ', 'Trạng thái', 'Lần cập nhật', 'Thao tác'],
        [
          [
            closingPeriod,
            pill(stage.period, stage.period === 'Đã khóa' ? 'good' : ''),
            stage.periodLog || '—',
            b('lock', stage.period === 'Đã khóa' ? 'Mở lại kỳ' : 'Khóa sổ', 'link'),
          ],
        ],
      ),
    ) +
    pad('Lịch sử khóa sổ', table(['Kỳ', 'Thao tác', 'Người thực hiện', 'Lý do'], stage.history || []))
  );
}

const throughClosing = (value) => dayKey(value) <= '2026-11-30';
function debtAtClose(kind) {
  return records[kind]
    .filter((x) => x.state === 'Đã ghi sổ' && throughClosing(x.post || x.day))
    .reduce((sum, x) => {
      const later = records.pay
        .filter((p) => p.state === 'Đã ghi sổ' && !throughClosing(p.post || p.day))
        .flatMap((p) => p.lines || [])
        .filter((line) => line[0] === x.code);
      const paidLater = later.reduce((n, entry) => n + Number(entry[2]), 0);
      const depositsLater =
        kind === 'sale'
          ? deposits
              .flatMap((d) => d.events)
              .filter((e) => e.invoice === x.code && !throughClosing(e.day))
              .reduce((n, e) => n + e.amount, 0)
          : 0;
      return (
        sum +
        x.amount -
        (x.paid || 0) +
        paidLater +
        depositsLater -
        (kind === 'sale' ? adjustmentAmount(x.code, periodEnd(closingPeriod)) : 0)
      );
    }, 0);
}
function invoiceReceiptVariance(line, invoice, index) {
  const row = (invoice.lines || rowDefinitions.buy.values)[index];
  return row ? Math.round(Number(row[2]) * Number(row[3])) - receiptLineValue(line) : 0;
}
function purchaseVariance(receipt, line, index) {
  const invoice = billedReceipt(receipt.code);
  return invoice?.state === 'Đã ghi sổ' ? invoiceReceiptVariance(line, invoice, index) : 0;
}

function workBalanceRows(end) {
  return [
    ...workOrders.map((x) => ({ code: x.code, label: x.state, route: workUrl(x.code) })),
    { code: commonWork, label: commonLabel, route: commonSource },
  ].map((x) => ({ ...x, value: workBalance(x.code, end) }));
}
function reconciliationDetail(account) {
  const end = periodEnd(closingPeriod);
  if (account === '154')
    return (
      table(
        ['Lệnh / Nhóm chi phí', 'Trạng thái', 'Dở dang cuối kỳ'],
        workBalanceRows(end).map((x) => [a(x.route, x.code), esc(x.label), money(x.value)]),
        [2],
      ) +
      note(
        'Chênh lệch có thể gồm số đầu kỳ chưa có chi tiết theo lệnh, hoặc phát sinh 154 gắn mã ngoài danh mục.',
      )
    );
  if (account === '152' || account === '155') {
    const rows = warehouseStockRows(account === '152' ? materialGroup : finishedGroup, end);
    const groups = new Map(rows.map((x) => [x.warehouse.code, x.warehouse]));
    return (
      table(
        ['Mã kho', 'Tên kho', 'Giá trị cuối kỳ'],
        [...groups.values()].map((w) => [
          esc(w.code),
          esc(w.name),
          money(rows.filter((x) => x.warehouse.code === w.code).reduce((sum, x) => sum + x.value, 0)),
        ]),
        [2],
      ) +
      table(
        ['Kho', 'Mã hàng', 'Tên hàng', 'Tồn cuối kỳ', 'Giá trị cuối kỳ'],
        rows
          .filter((x) => x.qty || x.value)
          .map((x) => [esc(x.warehouse.name), esc(x.item.code), esc(x.item.name), x.qty, money(x.value)]),
        [3, 4],
      )
    );
  }
  return '';
}
function reviewRows() {
  const debtSource = (kind) => {
    const sign = kind === 'buy' ? -1 : 1;
    const adjustments = debtJournalRows(kind, closingPeriod).reduce(
      (n, line) => n + sign * (line.debit - line.credit),
      0,
    );
    const advances = records.pay
      .filter(
        (x) =>
          x.state === 'Đã ghi sổ' &&
          throughClosing(x.post || x.day) &&
          !x.deposit &&
          (x.type === 'Chi tiền') === (kind === 'buy'),
      )
      .reduce((n, x) => n + unallocated(x), 0);
    const opening =
      savedOpening && throughClosing(savedOpening.day)
        ? Object.entries(savedOpening.balances)
            .filter(([code]) => partyType(code) === (kind === 'buy' ? 'suppliers' : 'customers'))
            .reduce((n, [, value]) => n + sign * value, 0)
        : 0;
    const unapplied =
      kind === 'sale'
        ? deposits
            .filter((d) => throughClosing(d.day))
            .reduce(
              (n, d) =>
                n +
                d.amount -
                d.events.filter((e) => throughClosing(e.day)).reduce((t, e) => t + e.amount, 0),
              0,
            )
        : 0;
    return debtAtClose(kind) + adjustments - advances + opening - unapplied;
  };
  const unbilled = salesDeliveries
    .filter((row) => {
      const invoice = billedDelivery(row.code);
      return (
        row.recognize &&
        row.state === 'Đã ghi sổ' &&
        throughClosing(row.accepted || row.day) &&
        !(invoice?.state === 'Đã ghi sổ' && throughClosing(invoice.post || invoice.day))
      );
    })
    .reduce((total, row) => total + purchaseTotal(row), 0);
  return [
    {
      label: 'Phải thu khách hàng',
      source: 'Công nợ theo khách hàng',
      account: '131',
      detail: debtSource('sale'),
      ledger: postedAmount('131'),
      route: '8?side=sale',
    },
    {
      label: 'Phải trả nhà cung cấp',
      source: 'Công nợ theo nhà cung cấp',
      account: '331',
      detail: debtSource('buy'),
      ledger: -postedAmount('331'),
      route: '8?side=buy',
    },
    {
      label: 'Giá trị nguyên vật liệu',
      source: 'Sổ chi tiết kho',
      account: '152',
      detail: warehouseStockRows(materialGroup, periodEnd(closingPeriod)).reduce((n, x) => n + x.value, 0),
      ledger: stockLedger(materialGroup),
      route: 'stock',
    },
    {
      label: 'Thành phẩm tồn kho',
      source: 'Sổ kho thành phẩm',
      account: '155',
      detail: warehouseStockRows(finishedGroup, periodEnd(closingPeriod)).reduce((n, x) => n + x.value, 0),
      ledger: stockLedger(finishedGroup),
      route: 'stock?group=products',
    },
    {
      label: 'Thuế GTGT đầu ra',
      source: 'Bảng kê hóa đơn bán',
      account: '33311',
      detail: vatTotals(vatWindow(closingPeriod, false)).output,
      ledger: -postedAmount(
        '33311',
        closingPeriod,
        journalLines().filter((line) => !line.entry.closeEntry),
      ),
      route: 16,
    },
    ...(unbilled || postedAmount('1319')
      ? [
          {
            label: 'Phải thu chưa lập hóa đơn',
            source: 'Phiếu giao hàng',
            account: '1319',
            detail: unbilled,
            ledger: postedAmount('1319'),
            route: 'deliveries',
          },
        ]
      : []),
  ];
}
const reviewNotes = {};
const unresolved = () => reviewRows().filter((item) => item.detail !== item.ledger).length;
const reviewSource = (item) => a(item.route, item.source);
const adjustment = () =>
  linkedJournal(purchase.invoice).find(
    (j) => j.state === 'Đã ghi sổ' && j.lines.some(([account]) => accountCode(account) === '152'),
  );
function reconcileClose() {
  const rows = reviewRows().map((item, i) => {
    const diff = item.detail - item.ledger,
      resolution = item.account === '152' ? adjustment() : null;
    return [
      b('review-account-' + i, item.label, 'link'),
      reviewSource(item),
      b('ledger-' + item.account, item.account, 'link'),
      money(item.detail),
      money(item.ledger),
      money(diff),
      pill(
        diff
          ? reviewNotes[item.account] || resolution
            ? 'Chờ xử lý'
            : 'Có chênh lệch'
          : resolution
            ? 'Đã xử lý'
            : 'Khớp',
        diff ? 'attn' : 'good',
      ),
    ];
  });
  return (
    pad(
      'Đối soát trước khi kết chuyển',
      '<div class="summary-row">' +
        pill(
          unresolved() ? unresolved() + ' khoản cần xử lý' : 'Các nguồn đã khớp',
          unresolved() ? 'attn' : 'good',
        ) +
        b('refresh-reconcile', 'Đối soát lại') +
        '</div>',
    ) +
    card(
      table(
        ['Khoản mục', 'Nguồn chi tiết', 'TK sổ cái', 'Số chi tiết', 'Số sổ cái', 'Chênh lệch', 'Trạng thái'],
        rows,
        [3, 4, 5],
      ),
    ) +
    pad(
      'Ghi chú và chứng từ xử lý',
      table(
        ['Tài khoản', 'Ghi chú', 'Bút toán điều chỉnh'],
        Object.entries(reviewNotes).map(([code, noteText]) => [
          code,
          esc(noteText),
          code === '152' && adjustment() ? journalAnchor(adjustment().code) : '—',
        ]),
      ),
    )
  );
}
function closingReport() {
  const entry = currentClosing();
  if (!entry || !stage.closing)
    return pad(
      '',
      note('Hoàn tất kết chuyển để mở số liệu báo cáo của kỳ.') + a('reconcile', 'Mở Kết chuyển'),
    );
  const rows = journalLines().filter((line) => monthOf(line) === closingPeriod && !line.entry.closeEntry);
  const netOf = (prefix) =>
    rows.filter((x) => x.code.startsWith(prefix)).reduce((n, x) => n + x.credit - x.debit, 0);
  const result = rows.filter((x) => /^[5678]/.test(x.code)).reduce((n, x) => n + x.credit - x.debit, 0);
  const approved = closeApproved();
  return pad(
    'Tóm tắt báo cáo kỳ · Mô phỏng',
    meta([
      ['Doanh thu bán hàng', money(netOf('511'))],
      ['Giá vốn', money(-netOf('632'))],
      ['Kết quả theo sổ mẫu', money(result)],
      ['Bút toán kết chuyển', journalAnchor(entry.code)],
      ['Trạng thái', pill(reviewStatus(), approved ? 'good' : 'attn')],
    ]) +
      (approved
        ? note('Ghi chú duyệt: ' + esc(stage.approvedClosing.note))
        : closingReview()?.state === 'Từ chối'
          ? note('Lý do từ chối: ' + esc(closingReview().reason))
          : '') +
      '<div class="actions">' +
      a(26, 'Xem màn báo cáo tài chính') +
      (!approved && stage.period !== 'Đã khóa'
        ? closingReview()?.state === 'Chờ duyệt'
          ? b('close-approve', 'Duyệt báo cáo kỳ', 'primary') + b('close-reject', 'Từ chối duyệt', 'warn')
          : b('close-submit', closingReview()?.state === 'Từ chối' ? 'Gửi duyệt lại' : 'Gửi duyệt', 'primary')
        : '') +
      (approved ? a(24, 'Sang Khóa sổ') : '') +
      '</div>',
  );
}
function handleClosingReview(action) {
  if (
    selectedClosePeriod !== closingPeriod ||
    stage.period === 'Đã khóa' ||
    !stage.closing ||
    closeApproved()
  )
    return;
  const code = currentClosing()?.code;
  if (!code) return;
  if (action === 'close-submit') {
    if (closingReview()?.state === 'Chờ duyệt') return;
    if (closeBlockers().length)
      return openModal('Kỳ chưa đủ điều kiện', closingChecklist(), () => '', 'Đóng');
    stage.closingReview = { code, state: 'Chờ duyệt', submittedBy: roleLabels[demoRole] };
    say('Đã gửi báo cáo kỳ ' + closingPeriod + ' để Quản trị tenant duyệt.');
    return;
  }
  if (!tenantOnly() || closingReview()?.state !== 'Chờ duyệt') return;
  const review = closingReview(),
    reject = action === 'close-reject';
  return openModal(
    (reject ? 'Từ chối duyệt kỳ ' : 'Duyệt báo cáo kỳ ') + closingPeriod,
    note('Bút toán kết chuyển ' + esc(code) + ' · Người gửi: ' + esc(review.submittedBy)) +
      textArea(reject ? 'Lý do từ chối' : 'Ghi chú rà soát', 'reason'),
    (data) => {
      const reason = String(data.get('reason') || '').trim();
      if (!reason) return reject ? 'Nhập lý do từ chối.' : 'Nhập ghi chú rà soát.';
      if (
        !tenantOnly() ||
        selectedClosePeriod !== closingPeriod ||
        stage.period === 'Đã khóa' ||
        closingReview() !== review ||
        review.state !== 'Chờ duyệt' ||
        (!reject && closeBlockers().length)
      )
        return 'Trạng thái hoặc số liệu đã thay đổi. Kiểm tra lại kỳ.';
      if (reject) stage.closingReview = { ...review, state: 'Từ chối', reason };
      else {
        stage.approvedClosing = { code, note: reason };
        stage.closingReview = { ...review, state: 'Đã duyệt' };
      }
      say((reject ? 'Đã từ chối báo cáo kỳ ' : 'Đã duyệt báo cáo kỳ ') + closingPeriod + '.');
      return '';
    },
    reject ? 'Xác nhận từ chối' : 'Xác nhận duyệt',
  );
}
function closeWorkspace() {
  const step = ['23', 'reconcile', 'close-review', '24'].indexOf(page);
  const period = closePeriods[selectedClosePeriod];
  const active = selectedClosePeriod === closingPeriod;
  const status = active ? stage.period : period?.state || 'Chưa có dữ liệu chốt sổ';
  const pending = active ? unresolved() : 0;
  const gated = active && precheckBlockers().length > 0;
  const redo = active && stage.redo;
  const parts = [
    [
      '23',
      'Đối soát' +
        (pending
          ? ' · ' + pending + ' còn lệch'
          : active
            ? stage.reviewed
              ? ' · Đạt'
              : redo
                ? ' · Cần làm lại'
                : ' · Chưa thực hiện'
            : ''),
    ],
    ['reconcile', 'Kết chuyển' + (active ? (stage.closing ? ' · Đạt' : redo ? ' · Cần làm lại' : '') : '')],
    ['close-review', 'Duyệt báo cáo'],
    ['24', 'Khóa sổ'],
  ];
  const links = parts
    .map(
      ([id, label], i) =>
        '<a href="#' +
        closeHref(id) +
        '" ' +
        (i === step ? 'aria-current="page"' : '') +
        '>' +
        label +
        '</a>',
    )
    .join('');
  const selector =
    '<div class="report-month-control">' +
    monthPickerButton('close', 'Kỳ kế toán', selectedClosePeriod) +
    '</div>';
  const rangeStart = period?.from || '01/' + selectedClosePeriod;
  const rangeEnd = period?.to || isoDate(periodEnd(selectedClosePeriod));
  const header =
    '<div class="close-period-summary">' +
    '<div>' +
    selector +
    '<small class="ux-helper">Kế toán chọn kỳ cần xem hoặc xử lý.</small></div>' +
    '<div class="system-field">Thời gian kỳ<div class="system-value">' +
    rangeStart +
    ' – ' +
    rangeEnd +
    '</div></div>' +
    '<div class="period-state"><span class="muted">Trạng thái kỳ · tự cập nhật</span><br>' +
    pill(status, status === 'Đã khóa' ? 'good' : period ? 'attn' : '') +
    '</div></div>';
  const empty = period?.updated
    ? 'Kỳ này đã khóa ngày ' +
      period.updated +
      '. Chỉ mở lại được kỳ khóa gần nhất; muốn sửa kỳ cũ hơn phải mở lần lượt từ kỳ mới nhất. Bản xem thử chỉ hiển thị trạng thái lịch sử.'
    : period
      ? 'Quy trình chốt sổ trong bản thử chỉ hỗ trợ kỳ 11/2026.'
      : 'Kỳ này chưa có dữ liệu chốt sổ trong bản mẫu.';
  return (
    pad(
      '',
      header +
        note(
          'Kỳ kế toán chọn để xem/đối soát; thời gian, trạng thái và quyền khóa do hệ thống kiểm soát. Bản mẫu chỉ thao tác chốt kỳ 11/2026.',
        ),
    ) +
    card('<nav class="workflow-tabs" aria-label="Các bước chốt sổ">' + links + '</nav>') +
    (active
      ? precheckPanel() + redoNote() + [reconcileClose, closing, closingReport, periodView][step]()
      : pad(
          '',
          note(empty + ' ' + a(closeHref(page, closingPeriod), 'Chuyển sang tháng 11/2026 để thử thao tác.')),
        ))
  );
}

function operationalCloseChecks() {
  const end = periodEnd(closingPeriod);
  const awaits = salesDeliveries.filter(
    (x) =>
      x.state === 'Đã ghi sổ' &&
      x.requiresAcceptance &&
      dayKey(x.day) <= end &&
      (!x.accepted || x.accepted > end),
  );
  const unresolvedChecks = stockChecks.filter(
    (x) => !x.cancelled && x.day <= end && (!x.resolution || x.resolution.day > end),
  );
  const missingTax = [...records.sale, ...scrapSales].filter(
    (x) => x.state === 'Đã ghi sổ' && throughClosing(x.post || x.day) && customerTaxError(x.party),
  );
  const pendingAdjustments = saleAdjustments.filter((x) => x.day <= end && x.state === 'Chờ phát hành');
  const pendingInvoice = uninvoicedDeliveries(end, true);
  const deliveredUnbilled = uninvoicedDeliveries(end, false);
  const missingWood = receipts.filter(
    (x) => x.state === 'Đã ghi sổ' && dayKey(x.day) <= end && woodWarning(x),
  );
  return [
    [
      'Đã nghiệm thu nhưng chưa lập hóa đơn',
      pendingInvoice.map((x) => x.code).join(', ') || 'Đã đủ',
      pendingInvoice.length ? 'Chặn' : 'Đạt',
      'deliveries',
    ],
    [
      'Phiếu giao chưa lập hóa đơn',
      deliveredUnbilled.map((x) => x.code).join(', ') || 'Đã đủ',
      deliveredUnbilled.length ? 'Cần rà soát' : 'Đạt',
      deliveredUnbilled.length ? saleUrl('delivery', deliveredUnbilled[0].code) : 'deliveries',
    ],
    [
      'Hồ sơ nguồn gốc gỗ',
      missingWood.map((x) => x.code).join(', ') || 'Đã đủ',
      missingWood.length ? 'Cần rà soát' : 'Đạt',
      'receipts',
    ],
    [
      'Hàng gửi chờ nghiệm thu · TK 157',
      awaits.length +
        ' phiếu · ' +
        awaits.filter((x) => x.acceptanceDue && x.acceptanceDue < end).length +
        ' quá hạn',
      awaits.length ? 'Cần rà soát' : 'Đạt',
      'deliveries',
    ],
    [
      'Khách hàng thiếu MST / loại khách',
      missingTax.length + ' hóa đơn',
      missingTax.length ? 'Cần rà soát' : 'Đạt',
      'customers',
    ],
    [
      'Kiểm kê chưa xử lý',
      unresolvedChecks.length + ' phiếu',
      unresolvedChecks.length ? 'Chặn' : 'Đạt',
      'stock-check',
    ],
    [
      'Hóa đơn điều chỉnh chờ phát hành',
      pendingAdjustments.length + ' hóa đơn',
      pendingAdjustments.length ? 'Chặn' : 'Đạt',
      '27?type=adjustment',
    ],
    [
      'Bảng kê mua không hóa đơn',
      records.buy.filter(
        (x) => x.state === 'Đã ghi sổ' && x.special === 'noinvoice' && throughClosing(x.post || x.day),
      ).length + ' chứng từ đã lên bảng kê',
      'Đạt',
      'noinvoice',
    ],
  ];
}

const commonWork = 'CP-SXC';
const commonSource = 'allocation';
const commonBalance = (day) => workBalance(commonWork, day);
const commonLabel = 'Chi phí sản xuất chung chờ phân bổ';
function commonCharge() {
  if (currentClosing()) return reopenCostWork();
  return openModal(
    'Chi phí sản xuất chung',
    grid(
      field('Ngày hạch toán', 'day', sampleDate, 'date'),
      field('Nội dung (điện, khấu hao hoặc chi phí xưởng)', 'description'),
      select('Loại chi phí', 'commonType', ['', 'Cố định', 'Biến đổi']),
      field('Số tiền (đ)', 'amount', '', 'number'),
      select('Tài khoản Có', 'credit', ['1111', '1121', '331']),
      payPartyField('suppliers', ''),
      field('Mã giao dịch ngân hàng', 'ref'),
    ),
    (data) => {
      const day = data.get('day'),
        err = postingDateError(day) || workError(commonWork, day);
      if (err) return err;
      const commonType = data.get('commonType');
      if (!['Cố định', 'Biến đổi'].includes(commonType)) return 'Chọn loại chi phí chung.';
      const credit = data.get('credit'),
        amount = Number(data.get('amount')),
        description = String(data.get('description') || '').trim(),
        vendor = data.get('party');
      if (
        !['1111', '1121', '331'].includes(credit) ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !description
      )
        return 'Kiểm tra nội dung, tài khoản Có và số tiền.';
      if (credit === '331' && !catalogMatch('suppliers', vendor)) return 'Chọn nhà cung cấp.';
      if (credit === '1121' && !String(data.get('ref') || '').trim()) return 'Nhập mã giao dịch ngân hàng.';
      const lines = [
        debitLine('154', amount, commonWork),
        creditLine(credit, amount, credit === '331' ? vendor : commonWork),
      ];
      const projection = cashProjection(lines, day);
      if (projection.error) return projection.error;
      const code = 'JV-SXC-' + String(records.journal.length + 1).padStart(4, '0');
      writeJournal(code, isoDate(day), description, lines, {
        sourceRoute: commonSource,
        commonType,
        log: String(data.get('ref') || ''),
      });
      touchClosing(day);
      say('Đã ghi chi phí chung.');
      return '';
    },
    'Ghi chi phí chung',
  );
}
function commonAllocation() {
  if (currentClosing()) return reopenCostWork();
  const period = closingPeriod,
    end = periodEnd(period),
    available = commonBalance(end);
  const eligible = workOrders.filter(
    (x) =>
      ['Đang sản xuất', 'Hoàn thành'].includes(x.state) &&
      x.day <= end &&
      !costRuns.some((r) => r.period === period && r.work === x.code),
  );
  if (available <= 0 || !eligible.length)
    return openModal(
      'Chưa thể phân bổ',
      note('Cần có chi phí chung dương và ít nhất một lệnh chưa tính giá.'),
      () => '',
      'Đóng',
    );
  const materialWeight = (x) =>
    Math.max(
      0,
      productionIssues
        .filter((i) => !i.cancelled && i.work === x.code && postingPeriod(i.day) === period)
        .reduce((n, i) => n + i.value, 0) -
        materialReturns
          .filter((i) => !i.cancelled && i.work === x.code && postingPeriod(i.day) === period)
          .reduce((n, i) => n + i.value, 0),
    );
  return openModal(
    'Phân bổ chi phí chung · ' + period,
    meta([['Chờ phân bổ', money(available)]]) +
      grid(select('Tiêu thức', 'basis', ['Chi phí NVL', 'Giờ công', 'Giờ máy'])) +
      table(
        ['Lệnh', 'NVL thực xuất ròng trong kỳ', 'Giờ công / giờ máy'],
        eligible.map((x, i) => [
          x.code,
          money(materialWeight(x)),
          field('Giờ của ' + x.code, 'hours' + i, '', 'number'),
        ]),
        [1],
      ) +
      textArea('Căn cứ phân bổ', 'reason'),
    (data) => {
      const error = postingDateError(end);
      if (error) return error;
      if (
        commonBalance(end) !== available ||
        eligible.some((x) => costRuns.some((r) => r.period === period && r.work === x.code))
      )
        return 'Số liệu đã thay đổi. Mở lại phân bổ.';
      const basis = data.get('basis'),
        reason = String(data.get('reason') || '').trim();
      const weights = eligible.map((x, i) =>
        basis === 'Chi phí NVL' ? materialWeight(x) : Number(data.get('hours' + i)) || 0,
      );
      if (
        !reason ||
        !['Chi phí NVL', 'Giờ công', 'Giờ máy'].includes(basis) ||
        weights.some((x) => x < 0 || !Number.isFinite(x))
      )
        return 'Nhập tiêu thức và căn cứ phân bổ hợp lệ.';
      const shares = apportion(available, weights);
      if (!shares) return 'Nhập số giờ hoặc ghi xuất vật tư để có trọng số lớn hơn 0.';
      const lines = [
        ...shares.flatMap((share, i) => (share ? [debitLine('154', share, eligible[i].code)] : [])),
        creditLine('154', available, commonWork),
      ];
      const code = 'JV-PB-SXC-' + String(records.journal.length + 1).padStart(4, '0');
      const fixedUsed = commonFixedBalance(end);
      writeJournal(code, isoDate(end), 'Phân bổ chi phí chung · ' + basis, lines, {
        sourceRoute: commonSource,
        sourceManaged: true,
        commonFixedUsed: fixedUsed,
        log: reason,
      });
      touchClosing(end);
      say('Đã phân bổ ' + money(available));
      return '';
    },
    'Ghi phân bổ',
  );
}
function allocationView() {
  const end = periodEnd(closingPeriod);
  return (
    pad(
      commonLabel,
      meta([
        ['Kỳ', closingPeriod],
        ['Chờ phân bổ', money(commonBalance(end))],
        ['Cố định chờ xử lý', money(commonFixedBalance(end))],
      ]) +
        '<div class="actions">' +
        (currentClosing()
          ? b('close-reopen-work', 'Làm lại bước trước')
          : b('common-charge', 'Ghi chi phí chung')) +
        b('common-allocate', 'Phân bổ cuối kỳ', 'primary') +
        (latestAllocation() ? b('allocation-undo', 'Làm lại phân bổ', 'link') : '') +
        (commonFixedBalance(end) > 0 ? b('common-expense', 'Ghi phần cố định không phân bổ vào 632') : '') +
        '</div>',
    ) +
    pad(
      'Bút toán chi phí chung',
      postingTable(
        records.journal.filter((x) =>
          x.lines?.some((line) => accountCode(line[0]) === '154' && line[1] === commonWork),
        ),
      ),
    )
  );
}

function commonFixedBalance(day) {
  return records.journal
    .filter((x) => x.state === 'Đã ghi sổ' && dayKey(x.day) <= day)
    .reduce(
      (n, x) =>
        n +
        (x.commonType === 'Cố định'
          ? x.lines
              .filter(([account, party]) => accountCode(account) === '154' && party === commonWork)
              .reduce((total, line) => total + Number(line[2]), 0)
          : 0) -
        (x.commonFixedUsed || 0),
      0,
    );
}
function commonStepEmpty() {
  const start = dayKey(closePeriods[closingPeriod].from),
    end = periodEnd(closingPeriod);
  return (
    !commonBalance(end) &&
    !journalLines().some(
      (x) =>
        x.code === '154' &&
        x.party === commonWork &&
        dayKey(x.entry.day) >= start &&
        dayKey(x.entry.day) <= end,
    )
  );
}
function costStepEmpty() {
  const end = periodEnd(closingPeriod),
    start = dayKey(closePeriods[closingPeriod].from);
  return (
    !costRuns.some((x) => x.period === closingPeriod) &&
    !workOrders.some(
      (x) =>
        x.day <= end &&
        (workBalance(x.code, end) !== 0 ||
          (x.done >= start && x.done <= end) ||
          journalLines().some(
            (l) =>
              l.code === '154' &&
              l.party === x.code &&
              dayKey(l.entry.day) >= start &&
              dayKey(l.entry.day) <= end,
          )),
    )
  );
}
function reopenCostWork() {
  const previous = currentClosing();
  if (!previous || periodLocked(periodEnd(closingPeriod))) return;
  return openModal(
    'Hủy kết chuyển để làm lại bước trước',
    note(
      a(journalHref(previous.code), previous.code) +
        ' đã ghi. Sau khi hủy, đối soát, kết chuyển và duyệt phải làm lại.',
    ) + textArea('Lý do', 'reason'),
    (data) => {
      const reason = String(data.get('reason') || '').trim();
      if (!reason) return 'Nhập lý do hủy kết chuyển.';
      if (periodLocked(periodEnd(closingPeriod)) || currentClosing() !== previous)
        return 'Trạng thái kỳ đã thay đổi.';
      previous.state = 'Đã hủy';
      previous.log = 'Hủy kết chuyển để làm lại · ' + reason;
      touchClosing();
      say('Đã hủy kết chuyển. Thực hiện lại bước đang mở.');
      return '';
    },
    'Hủy kết chuyển',
  );
}
function undoCostRun(code) {
  const index = costRuns.findIndex((x) => x.period === closingPeriod && x.work === code);
  const run = costRuns[index],
    work = workOrder(code),
    end = periodEnd(closingPeriod);
  if (!run || !work || periodLocked(end)) return;
  if (currentClosing()) return reopenCostWork();
  if (index !== costRuns.length - 1)
    return openModal(
      'Làm lại theo thứ tự ngược',
      note('Hủy lần tính giá ghi sau trước khi làm lại ' + esc(code) + '.'),
      () => '',
      'Đóng',
    );
  return openModal(
    'Làm lại giá thành · ' + code,
    textArea('Lý do', 'reason'),
    (data) => {
      const reason = String(data.get('reason') || '').trim();
      if (!reason) return 'Nhập lý do làm lại.';
      if (currentClosing() || periodLocked(end) || costRuns.at(-1) !== run)
        return 'Kỳ hoặc thứ tự tính giá đã thay đổi.';
      const later = work.outputs.map((x) => firstStockOutAfter(x.item, end)).filter(Boolean);
      if (later.length) return 'Có phiếu xuất sau ngày tính giá. Xử lý chứng từ phát sinh trước.';
      if (run.adjustment) {
        const at = costAdjustments.findIndex((x) => x.code === run.adjustment);
        if (at >= 0) costAdjustments.splice(at, 1);
        const entry = journalBy(run.adjustment);
        if (entry) {
          entry.state = 'Đã hủy';
          entry.log = 'Làm lại giá thành · ' + reason;
        }
        finishedReceipts
          .filter((x) => x.work === code && postingPeriod(x.day) === closingPeriod)
          .forEach((x) => delete x.actual);
        work.state = 'Hoàn thành';
      }
      costRuns.pop();
      touchClosing(end);
      say('Đã hủy lần tính giá. Có thể thực hiện lại.');
      return '';
    },
    'Hủy lần tính giá',
  );
}
const latestAllocation = () =>
  records.journal.findLast(
    (x) =>
      x.state === 'Đã ghi sổ' && x.code.startsWith('JV-PB-SXC-') && postingPeriod(x.day) === closingPeriod,
  );
function undoAllocation() {
  const entry = latestAllocation();
  if (!entry || periodLocked(periodEnd(closingPeriod))) return;
  if (currentClosing()) return reopenCostWork();
  const dependencies = costRuns.filter((x) => x.period === closingPeriod);
  if (dependencies.length)
    return openModal(
      'Cần làm lại giá thành trước',
      note(a(closeHref('cost'), 'Mở bước tính giá thành')),
      () => '',
      'Đóng',
    );
  return openModal(
    'Làm lại phân bổ · ' + entry.code,
    textArea('Lý do', 'reason'),
    (data) => {
      const reason = String(data.get('reason') || '').trim();
      if (!reason) return 'Nhập lý do làm lại.';
      if (periodLocked(periodEnd(closingPeriod)) || latestAllocation() !== entry || currentClosing())
        return 'Trạng thái kỳ đã thay đổi.';
      entry.state = 'Đã hủy';
      entry.log = 'Làm lại phân bổ · ' + reason;
      touchClosing();
      say('Đã hủy phân bổ. Có thể thực hiện lại.');
      return '';
    },
    'Hủy phân bổ',
  );
}
function expenseCommon() {
  if (!tenantOnly()) return;
  if (currentClosing()) return reopenCostWork();
  const end = periodEnd(closingPeriod),
    fixed = commonFixedBalance(end),
    limit = Math.min(fixed, commonBalance(end));
  if (limit <= 0) return;
  return openModal(
    'Chi phí cố định không phân bổ',
    note(
      'Chỉ ghi phần cố định không phân bổ theo công suất bình thường. Phần cố định đang chờ xử lý: ' +
        money(limit),
    ) +
      grid(field('Số tiền (đ)', 'amount', limit, 'number')) +
      textArea('Căn cứ và lý do', 'reason'),
    (data) => {
      const error = postingDateError(end);
      if (error) return error;
      const reason = String(data.get('reason') || '').trim(),
        amount = Number(data.get('amount'));
      if (
        !tenantOnly() ||
        currentClosing() ||
        !reason ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > Math.min(commonFixedBalance(end), commonBalance(end))
      )
        return 'Nhập lý do và số tiền hợp lệ trong phần chi phí cố định còn lại.';
      const code = 'JV-SXC-632-' + String(records.journal.length + 1).padStart(4, '0');
      writeJournal(
        code,
        isoDate(end),
        'Chi phí cố định không phân bổ',
        [debitLine('632', amount), creditLine('154', amount, commonWork)],
        { sourceRoute: commonSource, sourceManaged: true, log: reason, commonFixedUsed: amount },
      );
      touchClosing(end);
      say('Đã ghi phần chi phí cố định không phân bổ.');
      return '';
    },
    'Ghi vào 632',
  );
}
