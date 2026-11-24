function openModal(title, body, fn, label = 'Xác nhận', blocked = false) {
  setModalContent(title, body, fn, label, blocked);
  $('dialog').showModal();
}
function snapshotModal(target) {
  const body = $('dialogBody').cloneNode(true),
    live = [...$('dialogBody').querySelectorAll('input,select,textarea')],
    copy = [...body.querySelectorAll('input,select,textarea')];
  live.forEach((el, i) => {
    const c = copy[i];
    if (!c) return;
    if (el instanceof HTMLSelectElement) {
      [...c.options].forEach((o, j) => {
        o.selected = Boolean(el.options[j]?.selected);
        if (o.selected) o.setAttribute('selected', '');
        else o.removeAttribute('selected');
      });
    } else if (el instanceof HTMLTextAreaElement) {
      c.value = el.value;
      c.textContent = el.value;
    } else {
      c.value = el.value;
      c.setAttribute('value', el.value);
      if (el.type === 'checkbox' || el.type === 'radio') {
        c.checked = el.checked;
        if (el.checked) c.setAttribute('checked', '');
        else c.removeAttribute('checked');
      }
    }
  });
  return {
    title: $('dialogTitle').textContent,
    body: body.innerHTML,
    button: $('dialogButton').textContent,
    disabled: $('dialogButton').disabled,
    handler: modalHandler,
    className: $('dialog').className,
    targetName: target?.name || 'party',
    targetKey: target?.dataset.partySelect || '',
  };
}
function restoreModal(state, selection = null) {
  if (!state) return;
  $('dialogTitle').textContent = state.title;
  $('dialogBody').innerHTML = state.body;
  $('dialogButton').textContent = state.button;
  $('dialogButton').disabled = state.disabled;
  modalHandler = state.handler;
  $('dialog').className = state.className;
  if (selection) {
    document.querySelectorAll('[data-party-select="' + selection.key + '"]').forEach((select) => {
      if (![...select.options].some((option) => option.value === selection.name))
        select.add(new Option(selection.code + ' · ' + selection.name, selection.name));
    });
    const target = [...$('dialogBody').querySelectorAll('[data-party-select]')].find(
      (select) => select.name === state.targetName && select.dataset.partySelect === selection.key,
    );
    if (target) target.value = selection.name;
  }
  modalReturnState = null;
  pendingPartySelection = null;
  validateFormDates($('dialogForm'));
  refreshOrderRows();
}
function closeActiveModal() {
  if (modalReturnState) {
    restoreModal(modalReturnState);
    return;
  }
  $('dialog').close();
}
function ask(title, body, fn, label) {
  openModal(
    title,
    body,
    () => {
      fn();
      return '';
    },
    label,
  );
}
function submitModal(form) {
  if (!$('dialog').open || $('dialogButton').disabled) return;
  const feedback = $('modalErr');
  feedback.textContent = '';
  const invalid = validateFormDates(form);
  if (invalid) {
    feedback.textContent = invalid.validationMessage;
    invalid.focus();
    return;
  }
  if (!form.reportValidity()) return;
  const data = formData(form);
  const error = data ? modalHandler?.(data) : 'Ngày chưa hợp lệ. Nhập theo dd/mm/yyyy.';
  if (error) {
    feedback.textContent = error;
    return;
  }
  if (modalReturnState) {
    restoreModal(modalReturnState, pendingPartySelection);
    return;
  }
  $('dialog').close();
}
$('dialogForm').addEventListener('submit', (event) => {
  event.preventDefault();
  submitModal(event.currentTarget);
});
// Run the shared action even when the preview disallows native form submission.
$('dialogButton').addEventListener('click', (event) => {
  event.preventDefault();
  submitModal($('dialogForm'));
});
$('dialog')
  .querySelectorAll('[data-close]')
  .forEach((x) => (x.onclick = closeActiveModal));
