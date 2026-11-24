const searchableSelects = [
  '[data-party-select]',
  '.line-item',
  '[data-item-source]',
  '[data-invoice]',
  '#ledger-account',
  ...[
    'party',
    'item',
    'product',
    'line',
    'variantOf',
    'kit',
    'warehouse',
    'from',
    'to',
    'work',
    'allocWork',
    'employee',
    'invoice',
    'invoicePreset',
    'receiptOrder',
    'order',
    'sale',
    'deposit',
    'record',
    'account',
    'credit',
    'debit',
    'cash',
    'source',
    'supplier',
    'customer',
    'material',
    'finished',
    'receivable',
    'payable',
    'income',
  ].map((name) => '[name="' + name + '"]'),
  '[aria-label="Đối tượng"]',
  '[aria-label="Tài khoản"]',
]
  .map((selector) => 'select' + selector)
  .join(',');
let selectSearch = null;
function searchableControl(target) {
  const control = target.closest?.('select');
  return control &&
    !control.disabled &&
    !control.multiple &&
    control.size <= 1 &&
    (control.matches(searchableSelects) || control.options.length >= 12)
    ? control
    : null;
}
function closeSelectSearch(restoreFocus = false) {
  if (!selectSearch) return;
  const { control, popup } = selectSearch;
  selectSearch = null;
  popup.remove();
  control.removeAttribute('aria-expanded');
  if (restoreFocus && control.isConnected) control.focus();
}
function positionSelectSearch() {
  if (!selectSearch) return;
  const { control, popup, results } = selectSearch;
  const dialog = control.closest('dialog');
  if (!control.isConnected || (dialog && !dialog.open)) {
    closeSelectSearch();
    return;
  }
  const rect = control.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > innerHeight) {
    closeSelectSearch();
    return;
  }
  const width = Math.min(Math.max(rect.width, 280), innerWidth - 16);
  const below = innerHeight - rect.bottom - 12,
    above = rect.top - 12;
  const up = below < 220 && above > below;
  results.style.maxHeight = Math.min(260, Math.max(70, (up ? above : below) - 54)) + 'px';
  popup.style.width = width + 'px';
  popup.style.left = Math.max(8, Math.min(rect.left, innerWidth - width - 8)) + 'px';
  popup.style.top = Math.max(8, up ? rect.top - popup.offsetHeight - 4 : rect.bottom + 4) + 'px';
}
function selectSearchChoices(control, query) {
  const words = normalizedSearch(query).trim().split(/\s+/).filter(Boolean);
  return [...control.options].filter((option) => {
    if (option.hidden || option.disabled || option.parentElement.matches('optgroup:disabled')) return false;
    if (!option.value) return !words.length;
    const target = normalizedSearch(option.label + ' ' + option.value);
    return words.every((word) => target.includes(word));
  });
}
function showSelectSearch(control) {
  if (selectSearch?.control === control) {
    selectSearch.input.focus();
    return;
  }
  closeSelectSearch();
  const popup = document.createElement('div');
  popup.className = 'select-search-popup';
  popup.setAttribute('role', 'group');
  popup.setAttribute('aria-label', 'Tìm và chọn');
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Tìm theo mã hoặc tên';
  input.setAttribute('aria-label', input.placeholder);
  input.autocomplete = 'off';
  const results = document.createElement('div');
  results.className = 'select-search-results';
  popup.append(input, results);
  (control.closest('dialog') || document.body).append(popup);
  selectSearch = { control, popup, input, results };
  control.setAttribute('aria-expanded', 'true');
  function choose(option) {
    if (!option.isConnected || option.hidden || option.disabled) return;
    const changed = control.selectedIndex !== option.index;
    control.selectedIndex = option.index;
    closeSelectSearch(true);
    if (changed) {
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function refresh() {
    results.replaceChildren();
    for (const option of selectSearchChoices(control, input.value)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.dataset.value = option.value;
      button.setAttribute('aria-pressed', String(option.selected));
      button.addEventListener('click', () => choose(option));
      results.append(button);
    }
    if (!results.childElementCount) {
      const empty = document.createElement('p');
      empty.setAttribute('role', 'status');
      empty.textContent = 'Không tìm thấy lựa chọn phù hợp.';
      results.append(empty);
    }
    positionSelectSearch();
  }
  input.addEventListener('input', refresh);
  popup.addEventListener('keydown', (event) => {
    const buttons = [...results.querySelectorAll('button')];
    const index = buttons.indexOf(event.target);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeSelectSearch(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next =
        event.key === 'ArrowDown'
          ? buttons[Math.min(index + 1, buttons.length - 1)]
          : index > 0
            ? buttons[index - 1]
            : input;
      next?.focus();
    } else if (event.key === 'Enter' && event.target === input) {
      event.preventDefault();
      const current = input.value.trim()
        ? null
        : buttons.find((button) => button.dataset.value && button.getAttribute('aria-pressed') === 'true');
      (current || buttons.find((button) => button.dataset.value) || buttons[0])?.click();
    }
  });
  refresh();
  input.focus({ preventScroll: true });
}
document.addEventListener(
  'mousedown',
  (event) => {
    const control = searchableControl(event.target);
    if (!control || event.button !== 0) return;
    event.preventDefault();
    showSelectSearch(control);
  },
  true,
);
document.addEventListener(
  'click',
  (event) => {
    const control = searchableControl(event.target);
    if (!control) return;
    event.preventDefault();
    showSelectSearch(control);
  },
  true,
);
document.addEventListener(
  'keydown',
  (event) => {
    const control = searchableControl(event.target);
    if (!control || !['Enter', ' ', 'ArrowDown', 'ArrowUp', 'F4'].includes(event.key)) return;
    event.preventDefault();
    showSelectSearch(control);
  },
  true,
);
document.addEventListener(
  'pointerdown',
  (event) => {
    if (selectSearch && !selectSearch.popup.contains(event.target) && event.target !== selectSearch.control)
      closeSelectSearch();
  },
  true,
);
document.addEventListener('focusin', (event) => {
  if (selectSearch && !selectSearch.popup.contains(event.target) && event.target !== selectSearch.control)
    closeSelectSearch();
});
document.addEventListener(
  'close',
  (event) => {
    if (selectSearch && event.target.contains(selectSearch.popup)) closeSelectSearch();
  },
  true,
);
window.addEventListener('hashchange', () => closeSelectSearch());
window.addEventListener('resize', positionSelectSearch);
document.addEventListener(
  'scroll',
  (event) => {
    if (selectSearch && !selectSearch.popup.contains(event.target)) positionSelectSearch();
  },
  true,
);
