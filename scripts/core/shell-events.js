$('dialogForm').addEventListener('input', (event) => {
  const grid = event.target.closest('[data-wage-hours]');
  if (grid) refreshHours(grid);
  if (event.target.name === 'amount') refreshCostPreview();
  if (event.target.name === 'day' || /^out\d+$/.test(event.target.name || '')) refreshCompletionConflicts();
});
$('dialogForm').addEventListener('change', (event) => {
  if (event.target.id === 'timesheet-file') importWageHours(event.target);
});

function v9Action(id) {
  if (id === 'deposit-picker') {
    pickDeposit();
    return true;
  }
  if (id === 'allocation-undo') {
    undoAllocation();
    return true;
  }
  if (id === 'close-reopen-work') {
    reopenCostWork();
    return true;
  }
  if (id.startsWith('cost-undo|')) {
    undoCostRun(id.split('|')[1]);
    return true;
  }
  if (id === 'common-expense') {
    expenseCommon();
    return true;
  }
  if (id.startsWith('wd-cancel|')) {
    cancelStockDocument(id.split('|')[1]);
    return true;
  }
  if (id === 'refresh-reconcile') {
    stage.reviewed = !unresolved();
    return false;
  }
  return false;
}
document.addEventListener('change', (event) => {
  const { id, name, value } = event.target;
  if (name === 'demo-role') {
    if (!Object.hasOwn(roleLabels, value)) return;
    demoRole = value;
    $('profile-menu').open = false;
    onRoute();
    $('profile-trigger').focus();
    return;
  }
  const filters = {
    'warehouse-type': () => {
      warehouseKind = value;
      route(value ? 'warehouse-docs?type=' + encodeURIComponent(value) : 'warehouse-docs');
    },
    'sales-type': () => {
      invoiceKind = value;
      route('27?type=' + encodeURIComponent(value) + '&einv=' + encodeURIComponent(invoiceStage));
    },
    'sales-einv': () => {
      invoiceStage = value;
      route('27?type=' + encodeURIComponent(invoiceKind) + '&einv=' + encodeURIComponent(value));
    },
  };
  filters[name]?.();
});

$('dialogForm').addEventListener('change', (event) =>
  updateWarehouseFields(event.currentTarget, event.target),
);
const themeStorageKey = 'mini-erp-theme';
let theme = 'light';
try {
  if (localStorage.getItem(themeStorageKey) === 'dark') theme = 'dark';
} catch {}
function applyTheme() {
  document.documentElement?.setAttribute('data-theme', theme);
  const toggle = $('theme-toggle');
  const label = theme === 'dark' ? 'Bật giao diện sáng' : 'Bật giao diện tối';
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  toggle.title = label;
  if (page === '14')
    $('app').querySelector('iframe')?.contentDocument?.documentElement?.setAttribute('data-theme', theme);
}
$('theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {}
  applyTheme();
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'dashboard-period') {
    dashboardPeriod = event.target.value;
    render();
  } else if (event.target.id === 'dashboard-year') {
    dashboardYear = Number(event.target.value);
    render();
  } else if (event.target.id === 'dashboard-custom-month') {
    dashboardCustomMonth = event.target.value;
    render();
  } else if (event.target.id === 'dashboard-stock-group') {
    dashboardStockGroup = event.target.value;
    render();
  } else if (event.target.id === 'dashboard-stock-period') {
    dashboardStockPeriod = event.target.value;
    render();
  } else if (event.target.id === 'dashboard-stock-month') {
    dashboardStockMonth = event.target.value;
    render();
  } else if (event.target.id === 'dashboard-stock-date') {
    dashboardStockDate = event.target.value;
    render();
  }
});
document.addEventListener('click', (event) => {
  const menu = $('profile-menu');
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
document.addEventListener('keydown', (event) => {
  const menu = $('profile-menu');
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    $('profile-trigger').focus();
  }
});
