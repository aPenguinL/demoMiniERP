function actions(id, button) {
  if (!allowedAction(id)) return;
  if (id === 'load-test-data') return loadTestData();
  if (id.startsWith('mfg-cost|') && precheckGuard()) return;
  if (v9Action(id)) return;
  if (id.startsWith('mfg-')) return manufacturingAction(id);
  if ((id === 'common-charge' || id === 'common-allocate' || id.startsWith('mfg-cost|')) && precheckGuard())
    return;
  if (id === 'common-charge') return commonCharge();
  if (id === 'common-allocate') return commonAllocation();
  if (id === 'kit-assemble') return chooseKit();
  if (id.startsWith('kit-edit|')) return editKit(itemBy(id.split('|')[1]));
  if (id.startsWith('stock-detail|')) return stockDetail(id.split('|')[1]);
  if (id === 'stock-check-new') return checkStock();
  if (id === 'transfer-new') return transferStock();
  if (id.startsWith('item-new|')) return editItem(null, itemPages[id.split('|')[1]]);
  const warehouseAction = id.match(/^warehouse-(stop|start|remove)\|(.+)$/);
  if (warehouseAction) return warehouseLifecycle(warehouseAction[1], warehouseAction[2]);
  if (id.startsWith('stock-resolve|'))
    return resolveStock(stockChecks.find((x) => x.code === id.split('|')[1]));
  if (id.startsWith('sales-adjust|'))
    return salesAdjustment(records.sale.find((x) => x.code === id.split('|')[1]));
  if (id.startsWith('sales-adjust-post|'))
    return postAdjustment(saleAdjustments.find((x) => x.code === id.split('|')[1]));
  if (id === 'buy-service' || id === 'buy-noinvoice')
    return purchaseSpecial(id === 'buy-service' ? 'service' : 'noinvoice');
  if (id.startsWith('wood-edit|') || id.startsWith('wood-download|')) {
    const record = receipts.find((x) => x.code === id.split('|')[1]);
    return id.startsWith('wood-edit') ? editWood(record) : downloadWood(record);
  }
  if (id.startsWith('sales-accept|'))
    return acceptDelivery(salesDeliveries.find((x) => x.code === id.split('|')[1]));
  if (id.startsWith('deposit-new|'))
    return receiveDeposit(salesOrders.find((x) => x.code === id.split('|')[1]));
  if (id.startsWith('deposit-settle|'))
    return disposeDeposit(deposits.find((x) => x.code === id.split('|')[1]));
  if (id.startsWith('deposit-apply|'))
    return applyDeposit(records.sale.find((x) => x.code === id.split('|')[1]));
  if (id === 'ins-new') return newInsurance();
  if (id === 'ins-notice') return insuranceNotice();
  if (id.startsWith('material-return|'))
    return returnMaterial(productionIssues.find((x) => (x.lineId || x.code) === id.split('|')[1]));
  if (id === 'employee-new' || id.startsWith('employee-edit|'))
    return editEmployee(employees.find((x) => x.code === id.split('|')[1]));
  if (id === 'wage-new') return newWage();
  if (id === 'wage-batch') return wageBatch();
  if (id === 'scrap-new') return sellScrap();
  if (id === 'warranty-new') return newWarranty();
  if (id.startsWith('warranty-spend|') || id.startsWith('warranty-close|'))
    return warrantyEvent(
      warranties.find((x) => x.code === id.split('|')[1]),
      id.startsWith('warranty-close|'),
    );
  if (id.startsWith('wage-pay|'))
    return wagePayment(wageRuns.find((x) => x.code === id.split('|')[1] && x.state === 'Đã ghi sổ'));
  if (id === 'wage-remit') return remitPayroll();
  if (id.startsWith('special-review|'))
    return reviewSpecial(records.buy.find((x) => x.code === id.split('|')[1]));
  if (id === 'wage-advance') return wageAdvance();
  if (id.startsWith('wage-deduct|')) return wageDeduction(wageRuns.find((x) => x.code === id.split('|')[1]));
  {
    const m = id.match(/^wage-(approve|reject|submit|delete)\|(.+)$/);
    if (m)
      return wageReview(
        m[1],
        wageRuns.find((x) => x.code === m[2]),
      );
  }
  if (id.startsWith('bom-edit|')) return editBom(itemBy(id.split('|')[1]));
  if (id.startsWith('catalog-new-')) return editCatalog(id.slice(12));
  if (id.startsWith('catalog-edit-')) {
    const [key, code] = id.slice(13).split('|');
    return editCatalog(key, code);
  }
  if (id === 'payment-new') return route(6);
  if (id.startsWith('document-state-')) {
    if ($('document-filters') && !applyDocumentFilters($('document-filters'))) return;
    status = stateTabs[Number(id.slice(15))]?.[0] || '';
    render();
    return;
  }
  if (id === 'document-reset') {
    filter = '';
    dateFrom = '';
    dateTo = '';
    render();
    return;
  }
  if (id.startsWith('profile-new-')) return newProfile(id.slice(12));
  if (id.startsWith('workflow-')) {
    const [, key, index] = id.split('-');
    return workflowDraft(key, Number(index));
  }
  if (id === 'clear-ledger-doc') {
    ledgerDocument = '';
    render();
    return;
  }
  if (id.startsWith('docledger-')) {
    const [account, entry] = id.slice(10).split('|');
    ledgerCode = account;
    const journal = journalBy(entry);
    if (journal)
      route(
        '11?period=' + encodeURIComponent(postingPeriod(journal.day)) + '&entry=' + encodeURIComponent(entry),
      );
    return;
  }
  if (id === 'refresh-reconcile')
    return say(
      unresolved()
        ? 'Đã đối soát lại. Còn ' + unresolved() + ' khoản lệch.'
        : 'Đã đối soát lại. Các nguồn đã khớp.',
    );
  if (id === 'adjust-purchase') {
    const entry = adjustment();
    if (entry) route(journalHref(entry.code));
    return;
  }
  if (id.startsWith('review-account-')) {
    const item = reviewRows()[Number(id.slice(15))];
    if (!item) return;
    const kho = item.account === '152',
      suggestion = adjustment();
    return openModal(
      item.label,
      meta([
        ['Kỳ', '11/2026'],
        ['Số chi tiết', money(item.detail)],
        ['Số sổ cái', money(item.ledger)],
        ['Chênh lệch', money(item.detail - item.ledger)],
        ...(kho
          ? [
              ['Vật tư', purchase.sku + ' · ' + purchase.name],
              ['Kho', purchase.warehouse],
            ]
          : []),
      ]) +
        '<div class="actions">' +
        reviewSource(item) +
        b('ledger-' + item.account, 'Mở sổ cái TK ' + item.account, 'link') +
        (kho
          ? a('receipts?ref=' + purchase.receipt, purchase.receipt) + journalAnchor('JV-2026-00013')
          : '') +
        '</div>' +
        reconciliationDetail(item.account) +
        (stage.period === 'Đã khóa'
          ? note(esc(reviewNotes[item.account] || 'Kỳ đã khóa.'))
          : textArea('Nguyên nhân hoặc bước xử lý', 'reason', reviewNotes[item.account] || '')) +
        (kho && suggestion
          ? '<div class="actions">' +
            b('adjust-purchase', 'Mở hạch toán hóa đơn và chênh lệch giá', 'primary') +
            '</div>'
          : ''),
      (data) => {
        if (stage.period === 'Đã khóa') return '';
        const reason = String(data.get('reason') || '').trim();
        if (item.detail !== item.ledger && !reason) return 'Nhập nguyên nhân hoặc bước xử lý.';
        reviewNotes[item.account] = reason;
        say('Đã lưu ghi chú đối soát.');
        return '';
      },
      stage.period === 'Đã khóa' ? 'Đóng' : 'Lưu ghi chú',
    );
  }
  if (id.startsWith('debt-')) {
    debtFilter = id.slice(5);
    render();
    return;
  }
  if (id.startsWith('tab-')) {
    if (page === 'stock') {
      route(Number(id.slice(4)) ? 'stock?group=products' : 'stock');
      return;
    }
    tab = Number(id.slice(4));
    if (page === '8') debtFilter = 'all';
    render();
    return;
  }
  if (id.startsWith('go-')) {
    activeRecord = null;
    route(id.slice(3));
    return;
  }
  const recordAction = id.match(/^(open|payref|party)-(journal|pay|sale|buy)-(.+)$/);
  if (recordAction) {
    const [, op, kind, code] = recordAction;
    if (op === 'party') {
      const x = records[kind].find((item) => item.code === code);
      openModal(
        x.party,
        table(
          ['Hóa đơn', 'Ngày', 'Còn thanh toán'],
          records[kind]
            .filter((y) => y.party === x.party && y.state === 'Đã ghi sổ')
            .map((y) => [esc(y.code), y.day, money(y.amount - (y.paid || 0))]),
        ),
        () => {
          startInvoicePayment(kind, code);
          return '';
        },
        'Tạo phiếu thu/chi',
      );
    } else if (op === 'open') route(targets[kind] + '?code=' + encodeURIComponent(code));
    else startInvoicePayment(kind, code);
    return;
  }
  if (id === 'close-pick-month')
    return pickReportMonth(
      dayKey('01/' + selectedClosePeriod).slice(0, 7),
      (value) => route(closeHref(page, postingPeriod(value + '-01'))),
      'Chọn kỳ kế toán',
    );
  if (id === 'ledger-pick-month')
    return pickReportMonth(dayKey('01/' + ledgerMonth).slice(0, 7), (value) => {
      ledgerMonth = postingPeriod(value + '-01');
      ledgerDocument = '';
      if (page === '11')
        replaceHash('11?' + new URLSearchParams({ account: ledgerCode, period: ledgerMonth }));
      if (page === '12') replaceHash('12?' + new URLSearchParams({ period: ledgerMonth }));
      render();
    });
  if (id.startsWith('ledger-')) {
    ledgerCode = id.slice(7);
    const fromClose = ['23', 'reconcile', 'close-review', '24'].includes(page);
    if (fromClose) ledgerMonth = '11/2026';
    route(fromClose ? '11?period=11/2026' : 11);
    return;
  }
  if (id === 'save') return saveEntry();
  if (id === 'add-row') {
    $('editRows').insertAdjacentHTML('beforeend', editRow($('editRows').dataset.kind));
    hydrateEntry();
    updateCalc();
    return;
  }
  if (id === 'delete-row') {
    button.closest('tr').remove();
    if ($('editRows').dataset.kind === 'pay') updatePaymentOptions(false);
    else updateCalc();
    return;
  }
  if (id === 'new-order') return editProcurement('order');
  if (id === 'new-receipt') return editProcurement('receipt');
  if (id.startsWith('receipt-from-order-')) {
    const order = purchaseOrders.find((x) => x.code === id.slice(19));
    if (order) return editProcurement('receipt', null, order);
  }
  if (id.startsWith('proc-')) {
    const [op, kind] = id.split('|')[0].slice(5).split('-'),
      code = id.split('|')[1];
    const x = (kind === 'receipt' ? receipts : purchaseOrders).find((row) => row.code === code);
    if (op === 'edit') {
      if (x?.state === 'Nháp')
        return editProcurement(
          kind,
          x,
          purchaseOrders.find((row) => row.code === x.source),
        );
      return;
    }
    return changeProcurement(op, kind, code);
  }
  if (id.startsWith('invoice-from-receipt-')) {
    return route('30?source=' + encodeURIComponent(id.slice('invoice-from-receipt-'.length)));
  }
  if (id === 'new-buy' || id === 'new-sale') {
    const buy = id === 'new-buy';
    const choices = (buy ? receipts : salesDeliveries).filter(
      (x) =>
        x.state === 'Đã ghi sổ' &&
        (buy || !x.requiresAcceptance || x.accepted) &&
        !(buy ? billedReceipt : billedDelivery)(x.code),
    );
    const label = buy ? 'phiếu nhập kho' : 'phiếu giao hàng';
    if (!choices.length)
      return openModal(
        'Chưa có ' + label + ' để lập hóa đơn',
        a(buy ? 'receipts' : 'deliveries', 'Mở ' + label),
        () => '',
        'Đóng',
      );
    return openModal(
      'Chọn ' + label,
      select(
        'Nguồn chứng từ',
        'source',
        choices.map((x) => x.code + ' · ' + x.party),
      ),
      (data) => {
        const source = choices.find((x) => String(data.get('source')).startsWith(x.code + ' · '));
        if (!source) return 'Chọn chứng từ nguồn.';
        route((buy ? '30' : '28') + '?source=' + encodeURIComponent(source.code));
        return '';
      },
      'Mở form',
    );
  }
  if (id === 'sales-new') return editSaleDocument('order');
  if (id === 'sales-delivery-picker') return editSaleDocument('delivery');
  if (id.startsWith('sales-delivery-'))
    return editSaleDocument(
      'delivery',
      null,
      salesOrders.find((x) => x.code === id.slice(15)),
    );
  if (id.startsWith('sales-invoice-')) {
    route('28?source=' + encodeURIComponent(id.slice('sales-invoice-'.length)));
    return;
  }
  if (/^sales-(edit|post|cancel)-/.test(id)) {
    const [op, kind] = id.split('|')[0].slice(6).split('-'),
      code = id.split('|')[1];
    if (op === 'edit') {
      const row = (kind === 'delivery' ? salesDeliveries : salesOrders).find((x) => x.code === code);
      if (row?.state === 'Nháp')
        return editSaleDocument(
          kind,
          row,
          salesOrders.find((x) => x.code === row.source),
        );
      return;
    }
    return saleDocumentTransition(op, kind, code);
  }
  if (id.startsWith('edit-')) {
    const kind = id.slice(5),
      x = records[kind]?.find((y) => y.code === activeRecord?.code);
    if (x?.state !== 'Nháp') return;
    if (kind === 'journal' && (x.profile || x.caseAdjustment)) {
      const recurring = monthlyFlows.includes(x.flow) && x.workflowEvent === 1;
      const amountField = x.profile
        ? recurring
          ? note('Số tiền lấy theo mức của hồ sơ.')
          : field('Số tiền', 'amount', x.amount, 'number')
        : '';
      return openModal(
        'Sửa nháp ' + esc(x.code),
        grid(
          field('Diễn giải', 'party', x.party),
          ...(x.profile ? [field('Ngày hạch toán', 'day', dayKey(x.day), 'date'), amountField] : []),
        ),
        (data) => {
          const party = escToText(data.get('party'));
          if (!party) return 'Nhập diễn giải.';
          if (x.profile) {
            const day = data.get('day');
            const dateError = postingDateError(day);
            if (dateError) return dateError;
            const profile = profileStore[x.flow]?.find((row) => row.code === x.profile);
            const amount =
              recurring && profile
                ? monthlyDue(x.flow, profile, postingPeriod(day))
                : Number(data.get('amount'));
            if (!Number.isSafeInteger(amount) || amount <= 0) return 'Kiểm tra số tiền cần hạch toán.';
            x.lines = x.lines.map(([account, object, debit, credit]) => [
              account,
              object,
              Number(debit) ? amount : 0,
              Number(credit) ? amount : 0,
            ]);
            x.amount = amount;
            x.day = isoDate(day);
            x.post = day;
          }
          x.party = party;
          activeRecord = { ...x, kind };
          say('Đã cập nhật bản nháp.');
          return '';
        },
        'Lưu nháp',
      );
    }
    const target = { journal: 3, pay: 6, sale: 28, buy: 30 }[kind];
    route(target + '?edit=' + encodeURIComponent(x.code));
    return;
  }
  const stateAction = id.match(/^(post|cancel)-(journal|pay|sale|buy)$/);
  if (stateAction) {
    const [, op, kind] = stateAction;
    const x = records[kind].find((y) => y.code === activeRecord?.code);
    if (!x || (op === 'post' ? x.state !== 'Nháp' : x.state !== 'Đã ghi sổ')) return;
    if (periodLocked(x.post || x.day))
      return openModal(
        'Kỳ kế toán đã khóa',
        note('Mở lại kỳ hoặc sử dụng quy trình điều chỉnh phù hợp.'),
        () => '',
        'Đóng',
      );
    if (op === 'cancel' && kind === 'journal' && x.sourceManaged)
      return openModal(
        'Bút toán gắn với chứng từ',
        note('Mở chứng từ nguồn để xử lý chứng từ và bút toán liên quan cùng lúc.'),
        () => '',
        'Đóng',
      );
    if (op === 'cancel' && (x.special || x.paid || x.einv === 'Đã cấp mã'))
      return openModal(
        'Cần xử lý chứng từ liên quan',
        note('Kiểm tra thanh toán đã phân bổ hoặc hóa đơn điện tử đã cấp mã trước khi hủy.'),
        () => '',
        'Đóng',
      );
    const relevant =
      kind === 'journal'
        ? postingLines(kind, x)
        : op === 'post'
          ? postingLines(kind, x)
          : linkedJournal(x.code)
              .filter((j) => j.state === 'Đã ghi sổ')
              .flatMap((j) => j.lines);
    const check = () =>
      postingError(kind, x, op, relevant) ||
      (kind === 'journal'
        ? profilePostingError(x, op)
        : kind === 'pay'
          ? paymentAllocation(x, op).error
          : '');
    const warning = check();
    const preview = op === 'post' ? postingPreview(relevant, x.post || x.day) : '';
    const advisory =
      op !== 'post'
        ? ''
        : kind === 'pay'
          ? cashTaxWarning(x)
          : kind === 'sale'
            ? salesDateAdvisory(
                salesDeliveries.find((d) => d.code === x.source),
                x.day,
                x.post || x.day,
              )
            : '';
    const impact =
      op === 'cancel' && kind === 'pay'
        ? [
            (x.lines || [])
              .filter((row) => row[0] && Number(row[2]) > 0)
              .map((row) => 'gỡ phân bổ ' + money(row[2]) + ' khỏi ' + row[0])
              .join('; '),
            bank
              .filter((row) => row[5] === x.code)
              .map((row) => 'bỏ khớp sao kê ' + row[1])
              .join('; '),
          ].filter(Boolean)
        : [];
    return openModal(
      op === 'post' ? 'Xác nhận ghi sổ' : 'Hủy chứng từ',
      note(esc(x.code) + ' · ' + money(x.amount)) +
        preview +
        (impact.length ? note('Khi hủy: ' + esc(impact.join('; ')) + '.') : '') +
        (advisory ? '<p class="blocking-error" role="status">' + esc(advisory) + '</p>' : '') +
        (warning ? '<p class="blocking-error" role="alert">' + esc(warning) + '</p>' : '') +
        (op === 'cancel' ? textArea('Lý do hủy', 'reason') : ''),
      (data) => {
        if (op === 'cancel' && !String(data.get('reason')).trim()) return 'Nhập lý do hủy.';
        const error = check();
        if (error) return error;
        if (kind === 'pay') {
          const { changed } = paymentAllocation(x, op);
          for (const [invoice, value] of changed)
            invoice.paid = Math.max(0, (invoice.paid || 0) + (op === 'post' ? value : -value));
        }
        if (kind !== 'journal') {
          if (op === 'post') {
            const sourceRoute =
              (kind === 'buy' ? 30 : kind === 'sale' ? 28 : 7) + '?code=' + encodeURIComponent(x.code);
            writeJournal(
              'JV-CT-' + String(records.journal.length + 1).padStart(4, '0'),
              x.post ? isoDate(x.post) : x.day,
              'Hạch toán ' + x.code,
              relevant,
              { source: x.code, sourceRoute, sourceManaged: true },
            );
          } else {
            for (const linked of linkedJournal(x.code).filter((entry) => entry.state === 'Đã ghi sổ')) {
              linked.state = 'Đã hủy';
              linked.log = 'Đã đảo khi hủy ' + x.code + '.';
            }
          }
        }
        if (op === 'cancel' && kind === 'pay')
          for (const row of bank)
            if (row[5] === x.code) {
              row[4] = 'Chờ khớp';
              row[5] = '';
            }
        x.state = op === 'post' ? 'Đã ghi sổ' : 'Đã hủy';
        x.log =
          op === 'post'
            ? 'Kế toán đã xác nhận ghi sổ mẫu.' + (advisory ? ' ' + advisory : '')
            : 'Đã hủy · ' + data.get('reason');
        activeRecord = { ...x, kind };
        touchClosing(x.post || x.day);
        say(x.state + ' · ' + x.code);
        return '';
      },
      op === 'post' ? 'Xác nhận ghi sổ' : 'Hủy chứng từ',
      Boolean(warning),
    );
  }
  if (id.startsWith('match-')) {
    const row = bank[Number(id.slice(6))],
      matched = row[4] === 'Đã khớp';
    const candidates = [
      ...records.pay
        .filter((x) => x.state === 'Đã ghi sổ' && accountCode(x.cash || '').startsWith('112'))
        .map((x) => x.code),
      ...records.journal.filter((x) => x.state === 'Đã ghi sổ' && x.bankRef).map((x) => x.code),
    ].filter((code) => !bank.some((other) => other !== row && other[5] === code));
    if (!matched && !candidates.length)
      return openModal(
        'Chưa có chứng từ để khớp',
        note('Dùng “Tạo chứng từ” cho dòng sao kê chưa có trên sổ.'),
        () => '',
        'Đóng',
      );
    return openModal(
      matched ? 'Bỏ khớp giao dịch' : 'Đối chiếu dòng sao kê',
      note(esc(row[1]) + ' · ' + money(row[3])) +
        (matched
          ? note('Đang khớp với ' + esc(row[5] || 'chứng từ mẫu') + '.')
          : select('Chứng từ đối chiếu', 'record', candidates)),
      (data) => {
        if (matched) {
          row[4] = 'Chờ khớp';
          row[5] = '';
        } else {
          row[4] = 'Đã khớp';
          row[5] = String(data.get('record') || '');
        }
        touchClosing(isoDate(dayKey(row[0])));
        say('Đã cập nhật đối chiếu.');
        return '';
      },
      matched ? 'Bỏ khớp' : 'Xác nhận khớp',
    );
  }
  if (id.startsWith('bank-create-')) {
    const row = bank[Number(id.slice(12))];
    if (!row || row[4] === 'Đã khớp') return;
    const types =
      row[3] < 0
        ? ['Phí ngân hàng · Nợ 6422 / Có 1121']
        : ['Lãi tiền gửi · Nợ 1121 / Có 515', 'Khách chuyển khoản · lập phiếu thu'];
    return openModal(
      'Tạo chứng từ từ sao kê',
      note(esc(row[0]) + ' · ' + esc(row[1]) + ' · ' + esc(row[2]) + ' · ' + money(row[3])) +
        select('Loại nghiệp vụ', 'type', types),
      (data) => {
        const type = String(data.get('type') || '');
        if (type.startsWith('Khách')) {
          $('dialog').close();
          route(6);
          return '';
        }
        const day = dayKey(row[0]);
        const error = postingDateError(day);
        if (error) return error;
        const amount = Math.abs(row[3]);
        const bankAccount = configuredAccount('bank');
        const lines =
          row[3] < 0
            ? [debitLine(configuredAccount('bankFee'), amount), creditLine(bankAccount, amount)]
            : [debitLine(bankAccount, amount), creditLine(configuredAccount('bankInterest'), amount)];
        const cashError = cashProjection(lines, day).error;
        if (cashError) return cashError;
        const entry = writeJournal(
          'JV-NH-' + String(records.journal.length + 1).padStart(4, '0'),
          row[0],
          row[2] + ' · ' + row[1],
          lines,
          { bankRef: row[1], source: row[1], sourceRoute: '10' },
        );
        row[4] = 'Đã khớp';
        row[5] = entry.code;
        touchClosing(row[0]);
        say('Đã tạo ' + entry.code + ' và khớp với ' + row[1] + '.');
        return '';
      },
      'Tạo và khớp',
    );
  }
  if (id === 'import-bank')
    return openModal(
      'Nhập sao kê',
      select(
        'Tài khoản ngân hàng',
        'account',
        accounts.filter((x) => accountCode(x).startsWith('112')),
      ) +
        field('Tệp CSV', 'file', '', 'file') +
        note(
          'Loại bỏ trùng mã giao dịch khi nhập. Chỉ khớp được chứng từ cùng tài khoản ngân hàng. Bản mẫu sẽ thêm một dòng minh họa.',
        ),
      (data) => {
        if (!data.get('account')) return 'Chọn tài khoản ngân hàng.';
        if (!data.get('file')?.name) return 'Chọn tệp sao kê.';
        bank.push(['20/11/2026', 'DEMO-' + (bank.length + 1), 'Dòng sao kê mẫu', 1500000, 'Chờ khớp']);
        say('Đã thêm dòng sao kê minh họa.');
        return '';
      },
      'Nhập mẫu',
    );
  if (id.startsWith('allocate-')) {
    const payment = records.pay.find((x) => x.code === id.slice(9) && x.state === 'Đã ghi sổ');
    if (!payment || unallocated(payment) <= 0) return;
    const kind = payment.type === 'Chi tiền' ? 'buy' : 'sale';
    const key = kind === 'buy' ? 'suppliers' : 'customers';
    const choices = openDebt(kind).filter(
      (x) => catalogMatch(key, x.party) === catalogMatch(key, payment.party),
    );
    if (!choices.length)
      return openModal('Chưa có hóa đơn còn nợ của đối tác', note(esc(payment.party)), () => '', 'Đóng');
    return openModal(
      'Phân bổ tiền ứng trước',
      select(
        'Hóa đơn',
        'invoice',
        choices.map((x) => x.code),
      ) + field('Số tiền phân bổ', 'amount', '', 'number'),
      (data) => {
        const x = choices.find((row) => row.code === data.get('invoice')),
          n = Number(data.get('amount'));
        if (!x || !Number.isSafeInteger(n) || n <= 0 || n > unallocated(payment) || n > remaining(x))
          return 'Kiểm tra số tiền ứng trước và số còn nợ.';
        if (periodLocked(x.post || x.day) || periodLocked(payment.post || payment.day))
          return 'Kỳ của phiếu hoặc hóa đơn đã khóa.';
        const rule = kind === 'buy' ? 'payable' : 'receivable';
        const invoiceAccount = postedCounterAccount(x.code, rule, kind === 'buy' ? 'credit' : 'debit');
        const paymentAccount = postedCounterAccount(payment.code, rule, kind === 'buy' ? 'debit' : 'credit');
        if (invoiceAccount && paymentAccount && invoiceAccount !== paymentAccount)
          return 'Tài khoản công nợ của phiếu ứng trước và hóa đơn khác nhau. Cần đối chiếu bút toán trước khi phân bổ.';
        payment.lines ??= [];
        payment.lines.push([x.code, remaining(x), n]);
        x.paid = (x.paid || 0) + n;
        touchClosing();
        say('Đã phân bổ ' + money(n));
        return '';
      },
      'Xác nhận phân bổ',
    );
  }
  if (id === 'save-b09') {
    stage.explain = document.querySelector('[name=explain]').value;
    stage.items = document.querySelector('[name=items]').value;
    return say('Đã lưu thuyết minh mẫu.');
  }
  if (id === 'closing') {
    if (selectedClosePeriod !== closingPeriod) return;
    if (stage.period === 'Đã khóa') return;
    if (todayKey() < dayKey(closePeriods[closingPeriod].to))
      return openModal(
        'Kỳ chưa kết thúc',
        note('Có thể rà soát trong kỳ. Kết chuyển từ ngày ' + closePeriods[closingPeriod].to + '.'),
        () => '',
        'Đóng',
      );
    if (closeBlockers().length)
      return openModal('Kỳ chưa đủ điều kiện', closingChecklist(), () => '', 'Đóng');
    const previous = currentClosing();
    if (previous && stage.closing) {
      route(journalHref(previous.code));
      return;
    }
    const balances = new Map();
    for (const line of journalLines()) {
      if (monthOf(line) !== closingPeriod || line.entry.closeEntry || !/^([5678])/.test(line.code)) continue;
      balances.set(line.code, (balances.get(line.code) || 0) + line.debit - line.credit);
    }
    const lines = [];
    let result = 0;
    for (const [code, balance] of balances) {
      if (!balance) continue;
      if (balance < 0) lines.push(debitLine(code, -balance), creditLine('911', -balance));
      else lines.push(debitLine('911', balance), creditLine(code, balance));
      result -= balance;
    }
    if (result > 0) lines.push(debitLine('911', result), creditLine('4212', result));
    if (result < 0) lines.push(debitLine('4212', -result), creditLine('911', -result));
    const openLines = journalLines().filter((line) => !line.entry.closeEntry);
    const vatOffset = Math.min(
      Math.max(postedAmount('1331', closingPeriod, openLines), 0),
      Math.max(-postedAmount('33311', closingPeriod, openLines), 0),
    );
    if (vatOffset > 0) lines.unshift(debitLine('33311', vatOffset), creditLine('1331', vatOffset));
    return ask(
      'Xem trước bút toán kết chuyển',
      table(
        ['Tài khoản', 'Nợ', 'Có'],
        lines.map(([account, , d, c]) => [account, d ? money(d) : '—', c ? money(c) : '—']),
        [1, 2],
      ) +
        note(
          'Kết quả theo sổ mẫu của kỳ: ' +
            money(result) +
            (vatOffset ? ' · Bù trừ thuế GTGT đầu vào với đầu ra: ' + money(vatOffset) : ''),
        ),
      () => {
        const code =
          'JV-KC-2026-11-' + String(records.journal.filter((x) => x.closeEntry).length + 1).padStart(2, '0');
        if (previous) {
          previous.state = 'Đã hủy';
          previous.log = 'Đã đảo khi kết chuyển lại bằng ' + code + '.';
        }
        writeJournal(code, '30/11/2026', 'Kết chuyển kết quả kỳ ' + closingPeriod, lines, {
          closeEntry: true,
          source: 'Kết chuyển kỳ ' + closingPeriod,
          sourceRoute: 'reconcile',
          log: previous ? 'Thay cho ' + previous.code + '.' : 'Đã xác nhận kết chuyển.',
        });
        stage.closing = true;
        stage.reviewed = true;
        stage.redo = false;
        stage.approvedClosing = null;
        stage.closingReview = null;
        say('Đã kết chuyển. Mở ' + code + ' để xem chi tiết.');
      },
      'Xác nhận kết chuyển',
    );
  }
  if (id === 'close-submit' || id === 'close-approve' || id === 'close-reject')
    return handleClosingReview(id);
  if (id === 'lock') {
    if (selectedClosePeriod !== closingPeriod) return;
    const locked = stage.period === 'Đã khóa';
    if (
      locked &&
      Object.values(closePeriods).some(
        (p) => dayKey(p.from) > dayKey(closePeriods[closingPeriod].to) && p.state === 'Đã khóa',
      )
    )
      return openModal(
        'Chưa mở lại được kỳ 11/2026',
        note('Chỉ mở lại kỳ khóa gần nhất. Mở lại các kỳ sau trước.'),
        () => '',
        'Đóng',
      );
    const filed = [
      vatReturnState().vat === 'Đã nộp' ? 'Tờ khai 01/GTGT' : '',
      stage.pit === 'Đã nộp' ? 'Tờ khai 05/KK-TNCN' : '',
    ].filter(Boolean);
    return openModal(
      locked ? 'Mở lại kỳ 11/2026' : 'Khóa sổ kỳ 11/2026',
      (locked && filed.length
        ? '<p class="blocking-error" role="status">' +
          filed.join(', ') +
          ' của kỳ đã nộp. Sau khi khóa lại, nếu số liệu thuế thay đổi thì lập tờ khai bổ sung tại màn Tờ khai.</p>'
        : '') +
        note(
          locked
            ? 'Kỳ sẽ cần rà soát và kiểm tra lại kết chuyển.'
            : stage.closing
              ? 'Đã có bút toán kết chuyển mẫu.'
              : 'Hoàn thành kết chuyển ở ACC23 trước khi khóa.',
        ) +
        (locked ? textArea('Lý do mở kỳ', 'reason') : ''),
      (data) => {
        const reason = String(data.get('reason') || '').trim();
        if (locked && !reason) return 'Nhập lý do mở kỳ.';
        if (!locked && closeBlockers().length) return 'Xử lý các mục có trạng thái Chặn trước khi khóa.';
        if (!locked && !stage.closing) return 'Kỳ chưa kết chuyển.';
        if (!locked && !closeApproved()) return 'Duyệt báo cáo kỳ trước khi khóa sổ.';
        stage.period = locked ? 'Đang mở' : 'Đã khóa';
        stage.periodLog = '19/11/2026';
        stage.history ??= [];
        stage.history.unshift([
          '11/2026',
          locked ? 'Mở lại' : 'Khóa kỳ',
          roleLabels[demoRole],
          esc(reason || 'Hoàn thành kết chuyển'),
        ]);
        if (locked) {
          const entry = currentClosing();
          if (entry) {
            entry.state = 'Đã hủy';
            entry.log = 'Đã đảo khi mở lại kỳ · ' + reason;
          }
          touchClosing();
        }
        say(stage.period + '.');
        return '';
      },
    );
  }
  if (id.startsWith('tax-review-')) {
    const x = records.buy.find((item) => item.code === id.slice(11));
    if (!x) return;
    return openModal(
      'Rà soát hồ sơ GTGT đầu vào',
      note(esc(x.code) + ' · Thuế mẫu ' + money(invoiceTax(x, 'buy').tax)) +
        select('Kết quả rà soát', 'review', ['Chờ kiểm tra hồ sơ', 'Đủ hồ sơ (mẫu)', 'Thiếu hồ sơ']) +
        textArea('Ghi chú đối chiếu chứng từ', 'reason', x.taxNote || ''),
      (data) => {
        const review = data.get('review'),
          reason = String(data.get('reason') || '').trim();
        if (review !== 'Chờ kiểm tra hồ sơ' && !reason) return 'Nhập ghi chú đối chiếu để lưu kết quả.';
        x.taxReview = review;
        x.taxNote = reason;
        say('Đã lưu kết quả rà soát mẫu.');
        return '';
      },
      'Lưu rà soát',
    );
  }
  if (id === 'issue-batch' || id === 'issue-single') {
    const queue = [...records.sale, ...scrapSales].filter(
      (x) => x.state === 'Đã ghi sổ' && !issued(x) && (id === 'issue-batch' || x.code === activeRecord?.code),
    );
    const blocked = queue.filter((x) => customerTaxError(x.party));
    if (blocked.length)
      return openModal(
        'Chưa đủ thông tin phát hành',
        table(
          ['Hóa đơn', 'Lỗi'],
          blocked.map((x) => [esc(x.code), esc(customerTaxError(x.party))]),
        ) + a('customers', 'Mở danh mục khách hàng'),
        () => '',
        'Đóng',
      );
    if (!queue.length)
      return openModal('Hàng đợi VNPT', note('Không có hóa đơn chờ phát hành.'), () => '', 'Đóng');
    return openModal(
      'Phát hành hóa đơn điện tử',
      note(queue.length + ' hóa đơn trong hàng đợi. Chọn kết quả để thử giao diện.') +
        select('Phản hồi mô phỏng', 'outcome', ['Thành công', 'Lỗi kết nối']),
      (data) => {
        const failed = data.get('outcome') === 'Lỗi kết nối';
        for (const x of queue) {
          x.einv = failed ? 'Lỗi' : 'Đã cấp mã';
          x.vnpt = failed
            ? { error: 'Kết nối VNPT hết thời gian chờ (mô phỏng).' }
            : {
                number: 'MẪU-' + x.code.split('-').pop(),
                symbol: '1C26TTP (mẫu)',
                lookup: 'DEMO-' + x.code,
                date: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
              };
        }
        say(
          failed
            ? 'Đã mô phỏng lỗi. Mở hàng đợi để xem nguyên nhân và thử lại.'
            : 'Đã mô phỏng cấp mã ' + queue.length + ' hóa đơn.',
        );
        return '';
      },
      'Chạy mô phỏng',
    );
  }
  if (id.startsWith('einv-')) {
    const x = [...records.sale, ...scrapSales].find((item) => item.code === id.slice(5));
    if (!x) return;
    activeRecord = { ...x, kind: 'sale' };
    if (!issued(x) && x.einv !== 'Lỗi') return actions('issue-single');
    if (x.einv === 'Lỗi')
      return openModal(
        'Phát hành VNPT thất bại',
        note(esc(x.vnpt?.error || 'Chưa có phản hồi từ nhà cung cấp.')),
        () => {
          setTimeout(() => actions('issue-single'), 0);
          return '';
        },
        'Thử lại',
      );
    const info = x.vnpt || {};
    return openModal(
      'Thông tin hóa đơn VNPT',
      meta([
        [
          'Chứng từ ERP',
          a(x.code.startsWith('PL-') ? '27?type=scrap' : '28?code=' + encodeURIComponent(x.code), x.code),
        ],
        ['Số hóa đơn', esc(info.number || '—')],
        ['Ký hiệu', esc(info.symbol || '—')],
        ['Mã tra cứu', esc(info.lookup || '—')],
        ['Thời điểm phát hành', esc(info.date || '—')],
      ]),
      () => '',
      'Đóng',
    );
  }
  const tax = id.match(/^tax-(close|file|reopen|amend)-(vat|pit)$/);
  if (tax) {
    const [, op, k] = tax;
    const state = k === 'vat' ? vatReturnState() : stage;
    const history = k === 'vat' ? state.history : taxHistory.pit;
    const period = k === 'vat' ? vatWindow().label : taxPeriod;
    const title = {
      close: 'Chốt số liệu',
      file: 'Ghi nhận đã nộp',
      reopen: 'Mở lại số liệu',
      amend: 'Lập tờ khai bổ sung',
    }[op];
    const body =
      op === 'file'
        ? grid(
            field('Ngày nộp', 'date', sampleDate, 'date'),
            field('Mã giao dịch', 'ref'),
            field('Thông báo tiếp nhận', 'file', '', 'file'),
          )
        : op === 'reopen' || op === 'amend'
          ? textArea('Lý do', 'reason')
          : note('Xem lại chỉ tiêu trước khi chốt bản kê khai.');
    return openModal(
      title,
      body,
      (data) => {
        if (
          op === 'file' &&
          (!data.get('date') || !String(data.get('ref')).trim() || !data.get('file')?.name)
        )
          return 'Nhập ngày nộp, mã giao dịch và thông báo tiếp nhận.';
        if (['reopen', 'amend'].includes(op) && !String(data.get('reason')).trim()) return 'Nhập lý do.';
        if (op === 'amend') state[k + 'Version'] = (state[k + 'Version'] || 0) + 1;
        if (op === 'file') state[k + 'Receipt'] = 'Đã ghi nhận hồ sơ mẫu · ' + data.get('ref');
        else if (op === 'amend')
          state[k + 'Receipt'] = 'Tham chiếu bản đã nộp trước đó · ' + state[k + 'Receipt'];
        if (op === 'close' && k === 'vat') state.vatSnapshot = vatTotals();
        if (op === 'reopen' || op === 'amend') delete state[k + 'Snapshot'];
        history.push([
          state[k + 'Version'] ? 'Bổ sung lần ' + state[k + 'Version'] : 'Lần đầu',
          title,
          op === 'file' ? dateRef(data) : String(data.get('reason') || period),
        ]);
        state[k] = { close: 'Đã chốt', file: 'Đã nộp', reopen: 'Nháp', amend: 'Nháp' }[op];
        say(title + ' thành công trong bản mẫu.');
        return '';
      },
      title,
    );
  }
  if (id === 'xml')
    return openModal(
      'Xuất XML tờ khai',
      note('Bản mẫu minh họa bước xuất tệp gửi cơ quan thuế. Chưa có tệp XML theo chuẩn nộp.'),
      () => '',
      'Đóng',
    );
  if (id === 'cit-calc') return calculateCit();
  if (id === 'tax-rate')
    return openModal(
      'Thêm mức thuế',
      grid(
        field('Loại thuế', 'type', 'GTGT'),
        field('Thuế suất (%)', 'rate', '', 'number'),
        field('Hiệu lực từ', 'day', sampleDate, 'date'),
      ),
      (data) => {
        if (!tenantOnly()) return 'Chỉ Quản trị tenant được sửa cấu hình.';
        if (!data.get('type') || data.get('rate') === '' || !data.get('day'))
          return 'Điền đủ thông tin mức thuế.';
        stage.rates ??= [['GTGT', '10%', '01/01/2026', pill('Bản mẫu')]];
        stage.rates.push([
          esc(data.get('type')),
          esc(data.get('rate')) + '%',
          data.get('day').split('-').reverse().join('/'),
          pill('Bản mẫu'),
        ]);
        say('Đã thêm mức thuế mẫu.');
        return '';
      },
    );
  if (page === '25' && tab === 1) {
    if (id === 'default-account-add') return editDefaultAccount();
    const [operation, key] = id.split('|');
    if (defaultAccountRows().includes(key)) {
      if (operation === 'default-account-edit') return editDefaultAccount(key);
      if (operation === 'default-account-remove')
        return ask(
          'Xóa thiết lập tài khoản',
          note(esc(defaultAccountRules[key][0]) + ' sẽ dùng lại TK ' + defaultAccountRules[key][1] + '.'),
          () => setDefaultAccount(key, null),
          'Xóa thiết lập',
        );
    }
  }
  if (id === 'save-settings') {
    const inputs = Object.fromEntries([...$('app').querySelectorAll('[name]')].map((x) => [x.name, x.value]));
    if (
      tab === 0 &&
      [...vatReturns.values()].some((state) => state.vat !== 'Nháp') &&
      inputs.taxPeriod !== (stage.settings?.[0]?.taxPeriod || 'Theo tháng')
    )
      return openModal(
        'Tờ khai đã chốt hoặc đã nộp',
        note('Giữ kỳ kê khai của hồ sơ hiện tại.'),
        () => '',
        'Đóng',
      );
    if (
      tab === 4 &&
      (!String(inputs.costVariance ?? '').trim() ||
        !Number.isFinite(Number(inputs.costVariance)) ||
        Number(inputs.costVariance) < 0)
    )
      return openModal(
        'Kiểm tra ngưỡng',
        note('Nhập ngưỡng phần trăm lớn hơn hoặc bằng 0.'),
        () => '',
        'Đóng',
      );
    if (tab === 0) {
      inputs.accountingRegime = inputs.accountingRegime.trim();
      inputs.openingMonth = validDate(inputs.openingMonth) ? inputs.openingMonth.slice(0, 7) : '';
      if (
        !inputs.accountingRegime ||
        !accountingCycles.includes(inputs.closingCycle) ||
        !accountingCycles.includes(inputs.taxPeriod) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(inputs.openingMonth) ||
        inputs.openingMonth > todayKey().slice(0, 7)
      )
        return openModal(
          'Kiểm tra thiết lập nền',
          note('Nhập chế độ kế toán, chu kỳ chốt sổ và kỳ khởi tạo hợp lệ đến tháng hiện tại.'),
          () => '',
          'Đóng',
        );
      if (savedOpening && inputs.openingMonth !== savedOpening.day.slice(0, 7))
        return openModal(
          'Số dư đầu kỳ đã xác nhận',
          note('Giữ kỳ khởi tạo đã dùng để xác nhận số dư đầu kỳ.'),
          () => '',
          'Đóng',
        );
    }
    stage.settings ??= {};
    stage.settings[tab] = inputs;
    return say('Đã lưu cấu hình trong phiên minh họa.');
  }
  if (id === 'print-accounting') {
    window.print();
    return;
  }
  if (id === 'financial-csv') {
    const { cols, rows } = financialData(tab, financialMonth);
    const encode = (value) => '"' + String(value).replaceAll('"', '""') + '"';
    const csv = [cols, ...rows].map((row) => row.map(encode).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download =
      financialLabels[tab].replaceAll(' ', '-') + '-' + financialMonth.replace('/', '-') + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (id === 'cash-pick-month') {
    const control = $('cash-report-filter').elements.month;
    return pickReportMonth(control.value, (value) => {
      control.value = value;
      $('cash-month-value').textContent = postingPeriod(value + '-01');
    });
  }
  if (id === 'export') {
    if (page === '9') return exportCashReport();
    const kind =
      page === '31'
        ? document.querySelector('[name=report]').value
        : page === '26'
          ? ['B01a-DNN', 'B02-DNN', 'B09-DNN', 'F01-DNN', 'B03-DNN'][tab]
          : page === '19'
            ? registry[page][0] + ' · ' + citPeriod(true).label
            : registry[page][0];
    const format = page === '31' ? document.querySelector('[name=format]').value : 'Excel (.xlsx)';
    exportsLog.push([
      'EXP-' + String(exportsLog.length + 1).padStart(3, '0'),
      kind,
      format,
      '19/11/2026',
      'Mô phỏng',
    ]);
    return openModal(
      'Đã tạo yêu cầu xuất',
      note(esc(kind) + ' · ' + esc(format)) + a(31, 'Mở lịch sử xuất báo cáo'),
      () => '',
      'Đóng',
    );
  }
  if (id.startsWith('download-')) {
    const row = exportsLog[Number(id.slice(9))];
    return openModal(
      'Yêu cầu ' + row[0],
      meta([
        ['Loại báo cáo', esc(row[1])],
        ['Định dạng', esc(row[2])],
        ['Tình trạng', 'Dữ liệu minh họa'],
      ]),
      () => '',
      'Đóng',
    );
  }
  if (id === 'opening-import' || id === 'check-provider')
    return openModal(
      {
        'opening-import': 'Kiểm tra dữ liệu',
        'import-payroll': 'Nhập bảng lương',
        'check-provider': 'Kiểm tra kết nối VNPT',
      }[id],
      (id === 'import-payroll' ? field('Tệp dữ liệu lương', 'file', '', 'file') : '') +
        note('Đây là bước minh họa UI. Kết quả thực tế lấy từ quy trình xử lý dữ liệu của hệ thống.'),
      () => '',
      'Đóng',
    );
}
