function refreshSalesDateWarning() {
  const notice = $('sales-date-warning'),
    form = $('entryForm');
  if (!notice?.dataset?.source || !form) return;
  notice.textContent = salesDateAdvisory(
    salesDeliveries.find((x) => x.code === notice.dataset.source),
    form.elements.day?.value,
    form.elements.post?.value,
  );
}
function hydrateEntry() {
  const form = $('entryForm');
  if (!form) return;
  validateFormDates(form);
  refreshSalesDateWarning();
  if (form.dataset.kind === 'journal')
    document.querySelectorAll('#editRows [data-account]').forEach(updateAccountRow);
  if (form.dataset.kind === 'pay') updatePaymentOptions(false);
}
function updateAccountRow(input) {
  const row = input.closest('tr');
  const typed = input.value.trim();
  const account = accounts.find((item) => accountCode(item) === accountCode(typed));
  input.setAttribute(
    'aria-invalid',
    String(Boolean(typed && account && !availableManual(accountCode(account)))),
  );
  const target = row.children[1];
  const key = account ? partyType(accountCode(account)) : '';
  if (target.dataset.catalog !== key) {
    const value = target.querySelector('input,select')?.value;
    target.innerHTML = partyControl(value, key);
    target.dataset.catalog = key;
  }
  const date = $('entryForm').elements.day.value;
  const period = validDate(date) ? postingPeriod(date) : postingPeriod(todayKey());
  const hint = row.querySelector('.account-balance');
  const selectedDate = validDate(date) ? dayKey(date) : todayKey();
  const code = account ? accountCode(account) : '';
  const party = target.querySelector('select')?.value;
  const posted = account
    ? party && key
      ? debtAccountAt(code, party, period, selectedDate)
      : accountAt(code, period, selectedDate)
    : 0;
  hint.textContent = !account
    ? ''
    : !availableManual(code)
      ? 'TK này dùng qua chứng từ nguồn hoặc tài khoản chi tiết.'
      : (party && key ? 'Số dư đối tượng' : 'Số dư đến ' + isoDate(selectedDate)) +
        ' · ' +
        (posted === 0 ? '0 đ' : (posted > 0 ? 'Nợ ' : 'Có ') + money(Math.abs(posted)));
}
function accountAt(code, period, date) {
  const all = journalLines();
  return all
    .filter((line) => line.code === code && monthOf(line) === period && dayKey(line.entry.day) <= date)
    .reduce((n, line) => n + line.debit - line.credit, beginningAmount(code, period, all));
}
function debtAccountAt(code, party, period, date) {
  return (
    partnerBalances(
      code,
      period,
      true,
      journalLines().filter((line) => dayKey(line.entry.day) <= date),
    ).get(party) || 0
  );
}
function updatePaymentOptions(resetParty) {
  const form = $('entryForm');
  const type = form.elements.type.value;
  if (resetParty) {
    const party = form.elements.party;
    party.closest('.party-picker').outerHTML = payPartyField(
      type === 'Chi tiền' ? 'suppliers' : 'customers',
      '',
    );
  }
  const preset = form.elements.invoicePreset;
  if (resetParty && preset) {
    preset.closest('label').outerHTML = paymentSourceField(type);
  }
  const options = paymentOptions(type, form.elements.party.value);
  const list = type === 'Chi tiền' ? records.buy : records.sale;
  const inputs = [...document.querySelectorAll('#editRows [data-invoice]')];
  const used = new Set(inputs.map((input) => input.value).filter(Boolean));
  for (const input of inputs) {
    const row = input.closest('tr'),
      value = input.value;
    const allowed = options.filter(([code]) => code === value || !used.has(code));
    input.outerHTML = rowOptions('Hóa đơn', allowed, value, 'data-invoice');
    const selected = options.some(([code]) => code === value);
    row.children[1].querySelector('input').value = selected
      ? moneyDisplay(remaining(list.find((x) => x.code === value)))
      : '';
    if (!selected) row.children[2].querySelector('input').value = '';
  }
  updateCalc();
}
function hydrate() {
  const cashFilter = $('cash-report-filter');
  if (cashFilter) syncCashFilter(cashFilter);
  if (page === '14') {
    const payload = chartAccounts.map((account) => ({
      ...account,
      defaultUse: Object.keys(defaultAccountRules).some((key) => configuredAccount(key) === account.code),
      balance: Math.abs(postedAmount(account.code, postingPeriod(todayKey()))),
    }));
    $('app').querySelector('iframe').srcdoc = chartHtml
      .replace('__ERP_CHART_DATA__', JSON.stringify(payload).replaceAll('<', '\\u003c'))
      .replace('</head>', '<link rel="stylesheet" href="styles/appearance.css"></head>')
      .replace('<html lang="vi">', '<html lang="vi" data-theme="' + theme + '">');
  }
  if (page === '25')
    for (const control of $('app').querySelectorAll('input[name],select[name],textarea[name]')) {
      const storedValue = stage.settings?.[tab]?.[control.name];
      if (
        control.name !== 'openingMonth' &&
        storedValue !== undefined &&
        (!['closingCycle', 'taxPeriod'].includes(control.name) || accountingCycles.includes(storedValue))
      )
        control.value = storedValue;
      if (!tenantOnly()) {
        if (control.tagName === 'SELECT') control.disabled = true;
        else control.readOnly = true;
      }
    }
  hydrateEntry();
  updateCalc();
}
const paint = render;
render = () => {
  paint();
  hydrate();
};
$('app').addEventListener('click', (e) => {
  const button = e.target.closest('[data-do]');
  if (button) actions(button.dataset.do, button);
});
$('app').addEventListener('input', (e) => {
  if (e.target.id === 'quickSearch') {
    filter = e.target.value;
    render();
  } else if (e.target.closest('#entryForm')) {
    if (e.target.matches('[data-account]')) updateAccountRow(e.target);
    updateCalc();
  }
});
$('app').addEventListener('change', (e) => {
  if (e.target.form?.id === 'cash-report-filter' && e.target.name === 'mode') syncCashFilter(e.target.form);
  if (e.target.matches('[data-date]')) refreshSalesDateWarning();
  const form = e.target.closest('#entryForm');
  if (form?.dataset.kind === 'pay' && e.target.name === 'invoicePreset') {
    const kind = paymentKind(form.elements.type.value);
    const source = openDebt(kind).find((invoice) => invoice.code === e.target.value);
    if (!source) return;
    const draft = draftForInvoice(source.code);
    if (draft) {
      route('7?code=' + encodeURIComponent(draft.code));
      return;
    }
    const key = kind === 'buy' ? 'suppliers' : 'customers';
    const party = catalogMatch(key, source.party);
    if (!party) return;
    form.elements.party.value = party.name;
    form.elements.amount.value = moneyDisplay(remaining(source));
    $('editRows').innerHTML = editRow(
      'pay',
      [source.code, remaining(source), remaining(source)],
      false,
      paymentOptions(form.elements.type.value, party.name),
    );
    updateCalc();
    return;
  }
  if (form?.dataset.kind === 'pay' && ['type', 'party'].includes(e.target.name)) {
    if (form.elements.invoicePreset) form.elements.invoicePreset.value = '';
    updatePaymentOptions(e.target.name === 'type');
    return;
  }
  if (form?.dataset.kind === 'pay' && e.target.matches('[data-invoice]')) {
    updatePaymentOptions(false);
    return;
  }
  if (e.target.matches('[data-opening-account]')) {
    const cell = e.target.closest('tr').children[1];
    const key = partyType(accountCode(e.target.value));
    if (cell.dataset.catalog !== key) {
      cell.innerHTML = partyControl('', key);
      cell.dataset.catalog = key;
    }
  }
  if (form?.dataset.kind === 'journal' && e.target.name === 'day')
    document.querySelectorAll('#editRows [data-account]').forEach(updateAccountRow);
  if (form?.dataset.kind === 'journal' && e.target.getAttribute('aria-label') === 'Đối tượng')
    updateAccountRow(e.target.closest('tr').querySelector('[data-account]'));
  if (page === '17' && e.target.name === 'vatReportDate') {
    if (!validDate(e.target.value) || Number(e.target.value.slice(0, 4)) < 100) {
      e.target.value = vatDate;
      return;
    }
    vatDate = e.target.value;
    render();
  }
  if (e.target.id === 'statusFilter') {
    status = e.target.value;
    render();
  } else if (e.target.id === 'ledger-account') {
    ledgerCode = e.target.value;
    render();
  } else if (page === '26' && e.target.name === 'financialReportDate') {
    if (!validDate(e.target.value)) {
      e.target.value = financialDate;
      return;
    }
    financialDate = e.target.value;
    financialMonth = postingPeriod(financialDate);
    render();
  }
});
function applyListQuery(form) {
  listQueries.set(form.dataset.listQuery, Object.fromEntries(new FormData(form)));
  render();
}
$('app').addEventListener('change', (e) => {
  if (!e.target.matches('select') || !e.target.form?.dataset.listQuery) return;
  const { name, form } = e.target;
  const scope = form.dataset.listQuery;
  applyListQuery(form);
  $('app')
    .querySelector('[data-list-query="' + scope + '"] select[name="' + name + '"]')
    ?.focus();
});
$('app').addEventListener('click', (e) => {
  const form = e.target.closest('[data-clear-list]')?.form;
  if (!form?.dataset.listQuery) return;
  listQueries.set(
    form.dataset.listQuery,
    Object.fromEntries([...new FormData(form).keys()].map((key) => [key, ''])),
  );
  render();
});
function submitAppForm(form) {
  if (form.id === 'cash-report-filter') applyCashFilter(form);
  else if (form.dataset.listQuery) applyListQuery(form);
  else if (form.id === 'entryForm') saveEntry();
  else if (form.id === 'document-filters' && applyDocumentFilters(form)) render();
}
$('app').addEventListener('submit', (event) => {
  event.preventDefault();
  submitAppForm(event.target);
});
$('app').addEventListener('click', (event) => {
  const button = event.target.closest('button[type="submit"]');
  const form = button?.form;
  if (!form) return;
  event.preventDefault();
  if (form.reportValidity()) submitAppForm(form);
});
$('mobile').onclick = () => $('sidebar').classList.toggle('visible');
$('nav').addEventListener('click', (e) => {
  if (e.target.closest('a')) $('sidebar').classList.remove('visible');
});
$('dialog').addEventListener('click', (e) => {
  const localButton = e.target.closest('[data-hours-add],[data-hours-remove]');
  if (localButton) {
    const grid = localButton.closest('[data-wage-hours]');
    const body = grid.querySelector('tbody');
    if (localButton.hasAttribute('data-hours-add'))
      body.insertAdjacentHTML('beforeend', wageHourRow(grid.dataset.wageHours));
    else if (body.rows.length > 1) localButton.closest('tr').remove();
    else for (const input of body.querySelectorAll('select,input')) input.value = '';
    refreshHours(grid);
    return;
  }
  const button = e.target.closest('[data-do]');
  if (!button) return;
  $('dialog').close();
  actions(button.dataset.do, button);
});
window.addEventListener('hashchange', onRoute);
window.addEventListener('message', (e) => {
  if (page !== '14' || e.source !== $('app').querySelector('iframe')?.contentWindow) return;
  if (e.data?.type === 'acc14-update') {
    const { code, name, parent, active, party, reason } = e.data.account || {};
    if (!/^\d+$/.test(code) || !name || typeof active !== 'boolean') return;
    const current = chartAccounts.find((x) => x.code === code);
    if (current) {
      Object.assign(current, { active, reason });
      return;
    }
    if (!chartAccounts.some((x) => x.code === parent && x.active) || !code.startsWith(parent)) return;
    chartAccounts.push({ code, name, parent, active, party, reason });
    accounts.push(code + ' · ' + name);
  }
  if (e.data?.type === 'acc14-ledger' && chartAccounts.some((x) => x.code === String(e.data.code))) {
    ledgerCode = String(e.data.code);
    route(11);
  }
});
