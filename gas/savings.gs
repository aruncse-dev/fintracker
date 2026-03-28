// ── SAVINGS MODULE ────────────────────────────────────────────────────────────
//
// Spreadsheet : FinanceTrackerAssets
// Sheet       : Savings
// Columns     : ID | Date | Account | Amount | Description | Type | ToAccount
//
// All functions in this file are prefixed _savings_ to avoid naming collisions.
// Entry points are _savingsHandleGet / _savingsHandlePost, called from Code.gs.

const S_COL = { ID: 0, DATE: 1, ACCOUNT: 2, AMT: 3, DESC: 4, TYPE: 5, TO_ACCT: 6 };
const S_HDR = ['ID', 'Date', 'Account', 'Amount', 'Description', 'Type', 'ToAccount'];
const S_SHEET = 'Savings';

// ── INTERNAL: ensure header row exists at row 1 ────────────────────────────────
function _ensureSavingsHeader(sh) {
  try {
    const lastRow = sh.getLastRow();
    Logger.log('_ensureSavingsHeader: lastRow=' + lastRow);

    // If sheet is completely empty, append header
    if (lastRow === 0) {
      Logger.log('_ensureSavingsHeader: sheet is empty, appending header');
      sh.appendRow(S_HDR);
      Logger.log('_ensureSavingsHeader: header appended');
    } else {
      // Sheet has data, check first row
      try {
        const firstRow = sh.getRange(1, 1, 1, S_HDR.length).getValues()[0];
        const isHeader = S_HDR.every((col, i) => String(firstRow[i] || '').trim() === col);

        if (!isHeader) {
          Logger.log('_ensureSavingsHeader: header incorrect, rebuilding');
          // Clear row 1 and set header values
          sh.getRange(1, 1, 1, S_HDR.length).clearContent();
          for (let i = 0; i < S_HDR.length; i++) {
            sh.getRange(1, i + 1).setValue(S_HDR[i]);
          }
          Logger.log('_ensureSavingsHeader: header rebuilt');
        } else {
          Logger.log('_ensureSavingsHeader: header is correct');
        }
      } catch(e) {
        // If first row check fails, rebuild it
        Logger.log('_ensureSavingsHeader: first row check failed, rebuilding header');
        try {
          sh.getRange(1, 1, 1, S_HDR.length).clearContent();
        } catch(e2) {}
        for (let i = 0; i < S_HDR.length; i++) {
          sh.getRange(1, i + 1).setValue(S_HDR[i]);
        }
      }
    }

    // Apply minimal formatting (safer than full styling)
    try {
      const hdr = sh.getRange(1, 1, 1, S_HDR.length);
      hdr.setFontWeight('bold').setBackground('#1E1B4B').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
      Logger.log('_ensureSavingsHeader: formatting applied');
    } catch(e) {
      Logger.log('_ensureSavingsHeader: formatting skipped (' + e.message + ')');
    }

    // Hide ID column (optional, non-critical)
    try {
      sh.setColumnWidth(1, 40);
      sh.hideColumns(1);
    } catch(e) {}
  } catch(e) {
    Logger.log('_ensureSavingsHeader ERROR: ' + e.message);
    throw e;
  }
}

// ── INTERNAL: get (or initialise) the Savings sheet ──────────────────────────
function _savingsSheet() {
  Logger.log('_savingsSheet: getting spreadsheet ID');
  const ssId = _getSpreadsheetId('ASSETS_SHEET_ID');
  Logger.log('_savingsSheet: opening spreadsheet: ' + ssId);

  const ss = SpreadsheetApp.openById(ssId);
  Logger.log('_savingsSheet: spreadsheet name=' + ss.getName());

  let sh = ss.getSheetByName(S_SHEET);
  if (!sh) {
    Logger.log('_savingsSheet: sheet "' + S_SHEET + '" not found, creating');
    sh = ss.insertSheet(S_SHEET);
    sh.appendRow(S_HDR);
    Logger.log('_savingsSheet: sheet created and header added');
  } else {
    Logger.log('_savingsSheet: sheet "' + S_SHEET + '" found, lastRow=' + sh.getLastRow());
  }

  // Always ensure header is correct
  _ensureSavingsHeader(sh);

  return sh;
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
function _savingsHandleGet(action) {
  Logger.log('_savingsHandleGet action: ' + action);
  if (action === 'getEntries') {
    Logger.log('Calling _savings_getEntries');
    const result = _savings_getEntries();
    Logger.log('_savings_getEntries returned: ' + result.length + ' entries');
    return result;
  }
  throw new Error('Unknown savings GET action: ' + action);
}

function _savingsHandlePost(action, body) {
  Logger.log('_savingsHandlePost action: ' + action);
  if (action === 'addEntry') {
    Logger.log('Calling _savings_addEntry');
    return _savings_addEntry(body.date, body.account, body.amount, body.desc, body.type, body.toAccount);
  }
  if (action === 'updateEntry') {
    Logger.log('Calling _savings_updateEntry');
    return _savings_updateEntry(body.id, body.date, body.account, body.amount, body.desc, body.type, body.toAccount);
  }
  if (action === 'deleteEntry') {
    Logger.log('Calling _savings_deleteEntry');
    return _savings_deleteEntry(body.id);
  }
  throw new Error('Unknown savings POST action: ' + action);
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function _savings_getEntries() {
  try {
    Logger.log('_savings_getEntries: getting sheet');
    const sh = _savingsSheet();
    Logger.log('_savings_getEntries: sheet obtained, reading data');

    const vals = sh.getDataRange().getValues();
    Logger.log('_savings_getEntries: got ' + vals.length + ' rows');

    if (vals.length < 2) {
      Logger.log('_savings_getEntries: only header row or empty');
      return [];
    }

    const result = vals.slice(1)
      .filter(r => {
        const type = String(r[S_COL.TYPE] || '').trim().toUpperCase();
        return type === 'INCOME' || type === 'EXPENSE' || type === 'TRANSFER';
      })
      .map(r => ({
        id:        String(r[S_COL.ID]      || ''),
        date:      _fmtDate(r[S_COL.DATE]),
        account:   String(r[S_COL.ACCOUNT] || '').trim(),
        amount:    parseFloat(r[S_COL.AMT]) || 0,
        desc:      String(r[S_COL.DESC]    || '').trim(),
        type:      String(r[S_COL.TYPE]    || '').trim().toUpperCase(),
        toAccount: String(r[S_COL.TO_ACCT] || '').trim() || undefined,
      }));

    Logger.log('_savings_getEntries: returning ' + result.length + ' valid entries');
    return result;
  } catch(e) {
    Logger.log('_savings_getEntries ERROR: ' + e.message);
    throw e;
  }
}

function _savings_addEntry(date, account, amount, desc, type, toAccount) {
  try {
    Logger.log('_savings_addEntry: START date=' + date + ', account=' + account + ', amount=' + amount + ', type=' + type);
    const sh  = _savingsSheet();
    Logger.log('_savings_addEntry: sheet obtained');
    const id  = Utilities.getUuid();
    const amt = parseFloat(amount) || 0;
    Logger.log('_savings_addEntry: appending row with id=' + id);
    sh.appendRow([
      id,
      date || '',
      String(account || '').trim(),
      amt,
      String(desc || '').trim(),
      String(type || '').toUpperCase(),
      String(toAccount || '').trim()
    ]);
    Logger.log('_savings_addEntry: row appended, last row=' + sh.getLastRow());

    const row = sh.getLastRow();
    Logger.log('_savings_addEntry: styling row ' + row);
    _savingsStyleRow(sh, row, String(type || ''));
    Logger.log('_savings_addEntry: styling complete');
    Logger.log('_savings_addEntry: SUCCESS id=' + id);
    return id;
  } catch(e) {
    Logger.log('_savings_addEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _savings_updateEntry(id, date, account, amount, desc, type, toAccount) {
  try {
    Logger.log('_savings_updateEntry: START id=' + id + ', account=' + account + ', amount=' + amount);
    const sh   = _savingsSheet();
    Logger.log('_savings_updateEntry: sheet obtained');
    const vals = sh.getDataRange().getValues();
    Logger.log('_savings_updateEntry: data read, rows=' + vals.length);

    const targetId = String(id).trim();

    for (let i = 1; i < vals.length; i++) {
      const rowId = String(vals[i][S_COL.ID] || "").trim();
      Logger.log('_savings_updateEntry: comparing rowId="' + rowId + '" with targetId="' + targetId + '"');

      if (rowId === targetId) {
        Logger.log('_savings_updateEntry: found entry at row ' + (i + 1));
        const amt = parseFloat(amount) || 0;
        const rowNum = i + 1;
        Logger.log('_savings_updateEntry: setting values for row ' + rowNum);
        sh.getRange(rowNum, 1, 1, S_HDR.length).setValues([[
          id,
          date || '',
          String(account || '').trim(),
          amt,
          String(desc || '').trim(),
          String(type || '').toUpperCase(),
          String(toAccount || '').trim()
        ]]);
        Logger.log('_savings_updateEntry: values set, styling row');
        _savingsStyleRow(sh, rowNum, String(type || ''));
        Logger.log('_savings_updateEntry: SUCCESS');
        return true;
      }
    }
    throw new Error('Savings entry not found: ' + id);
  } catch(e) {
    Logger.log('_savings_updateEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _savings_deleteEntry(id) {
  try {
    Logger.log('_savings_deleteEntry: id=' + id);
    const sh   = _savingsSheet();
    const vals = sh.getDataRange().getValues();
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][S_COL.ID]) === String(id)) {
        Logger.log('_savings_deleteEntry: found entry at row ' + (i + 1));
        sh.deleteRow(i + 1);
        Logger.log('_savings_deleteEntry: success');
        return true;
      }
    }
    throw new Error('Savings entry not found: ' + id);
  } catch(e) {
    Logger.log('_savings_deleteEntry ERROR: ' + e.message);
    throw e;
  }
}

// ── FORMATTING ────────────────────────────────────────────────────────────────
function _savingsStyleRow(sh, rowNum, type) {
  const typeUpper = type.toUpperCase();
  const isIncome = typeUpper === 'INCOME';
  const isExpense = typeUpper === 'EXPENSE';

  // Color map: Income=green, Expense=red, Transfer=blue
  let bg = '#EFF6FF', fg = '#1D4ED8'; // Transfer (blue)
  if (isIncome) {
    bg = '#F0FDF4'; fg = '#166534'; // green
  } else if (isExpense) {
    bg = '#FEF2F2'; fg = '#991B1B'; // red
  }

  sh.getRange(rowNum, 2, 1, S_HDR.length - 1).setBackground(bg).setFontColor(fg);
  sh.getRange(rowNum, S_COL.AMT + 1).setFontWeight('bold').setNumberFormat('₹#,##,##0.00').setHorizontalAlignment('right');
  sh.getRange(rowNum, S_COL.DATE + 1).setNumberFormat('dd-mmm-yy').setHorizontalAlignment('center');
  sh.getRange(rowNum, S_COL.TYPE + 1).setHorizontalAlignment('center');
}
