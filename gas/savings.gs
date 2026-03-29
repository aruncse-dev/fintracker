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
// STRICT: Never clears or truncates data. Only validates headers.
function _ensureSavingsHeader(sh) {
  try {
    const lastRow = sh.getLastRow();
    Logger.log('_ensureSavingsHeader: lastRow=' + lastRow);

    // If sheet is completely empty, append header
    if (lastRow === 0) {
      Logger.log('_ensureSavingsHeader: sheet is empty, appending header');
      sh.appendRow(S_HDR);
      Logger.log('_ensureSavingsHeader: header appended');
    } else if (lastRow >= 1) {
      // Sheet has data - VALIDATE header only, NEVER clear or modify
      try {
        const firstRow = sh.getRange(1, 1, 1, S_HDR.length).getValues()[0];
        const isHeader = S_HDR.every((col, i) => String(firstRow[i] || '').trim() === col);

        if (!isHeader) {
          Logger.log('_ensureSavingsHeader: header mismatch detected, but NOT modifying to preserve data');
          Logger.log('_ensureSavingsHeader: first row content: ' + JSON.stringify(firstRow));
          // Do NOT clear or modify - just log the issue
        } else {
          Logger.log('_ensureSavingsHeader: header is correct');
        }
      } catch(e) {
        Logger.log('_ensureSavingsHeader: first row check failed, but preserving all data: ' + e.message);
        // Do NOT modify the sheet
      }
    }
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

    const rowCountBefore = sh.getLastRow();
    Logger.log('_savings_addEntry: row count before append=' + rowCountBefore + ', appending with id=' + id);

    sh.appendRow([
      id,
      date || '',
      String(account || '').trim(),
      amt,
      String(desc || '').trim(),
      String(type || '').toUpperCase(),
      String(toAccount || '').trim()
    ]);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_savings_addEntry: row count after append=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore + 1) {
      throw new Error('Data append verification failed: expected ' + (rowCountBefore + 1) + ' rows, got ' + rowCountAfter);
    }

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
    const rowCountBefore = sh.getLastRow();
    Logger.log('_savings_updateEntry: data read, rows=' + vals.length + ', row count=' + rowCountBefore);

    const targetId = String(id).trim();
    let targetRow = -1;

    for (let i = 1; i < vals.length; i++) {
      const rowId = String(vals[i][S_COL.ID] || "").trim();
      Logger.log('_savings_updateEntry: comparing rowId="' + rowId + '" with targetId="' + targetId + '"');

      if (rowId === targetId) {
        targetRow = i + 1;
        Logger.log('_savings_updateEntry: found entry at row ' + targetRow);
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Savings entry not found: ' + id);
    }

    const amt = parseFloat(amount) || 0;
    Logger.log('_savings_updateEntry: setting values for row ' + targetRow);

    sh.getRange(targetRow, 1, 1, S_HDR.length).setValues([[
      id,
      date || '',
      String(account || '').trim(),
      amt,
      String(desc || '').trim(),
      String(type || '').toUpperCase(),
      String(toAccount || '').trim()
    ]]);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_savings_updateEntry: row count before=' + rowCountBefore + ', after=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore) {
      throw new Error('Data update verification failed: row count changed from ' + rowCountBefore + ' to ' + rowCountAfter);
    }

    Logger.log('_savings_updateEntry: SUCCESS');
    return true;
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
    const rowCountBefore = sh.getLastRow();
    Logger.log('_savings_deleteEntry: row count before delete=' + rowCountBefore);

    let targetRow = -1;

    // Find the target row (search backwards)
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][S_COL.ID]) === String(id)) {
        targetRow = i + 1;
        Logger.log('_savings_deleteEntry: found entry at row ' + targetRow);
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Savings entry not found: ' + id);
    }

    sh.deleteRow(targetRow);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_savings_deleteEntry: row count after delete=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore - 1) {
      throw new Error('Data delete verification failed: expected ' + (rowCountBefore - 1) + ' rows, got ' + rowCountAfter);
    }

    Logger.log('_savings_deleteEntry: success');
    return true;
  } catch(e) {
    Logger.log('_savings_deleteEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}
