// ── LENDING MODULE ────────────────────────────────────────────────────────────
//
// Spreadsheet : FinanceTrackerAssets
// Sheet       : Lending
// Columns     : ID | Date | Name | Amount | Type | Description
//
// All functions in this file are prefixed _lending_ to avoid naming collisions.
// Entry points are _lendingHandleGet / _lendingHandlePost, called from Code.gs.

const L_COL = { ID: 0, DATE: 1, NAME: 2, AMT: 3, TYPE: 4, DESC: 5 };
const L_HDR = ['ID', 'Date', 'Name', 'Amount', 'Type', 'Description'];
const L_SHEET = 'Lending';

// ── HELPER: read a spreadsheet ID from PropertiesService ──────────────────────
// key: script property name, e.g. 'ASSETS_SHEET_ID' or 'EXPENSES_SHEET_ID'
function _getSpreadsheetId(key) {
  Logger.log('_getSpreadsheetId: requesting key=' + key);
  const id = PropertiesService.getScriptProperties().getProperty(key);
  Logger.log('_getSpreadsheetId: id=' + (id ? 'SET (length=' + id.length + ')' : 'NOT SET'));
  if (!id) throw new Error(key + ' not configured. Run setAssetsSheetId("your-sheet-id") in the Apps Script editor.');
  return id;
}

// ── HELPER: open any sheet by property key + sheet name ───────────────────────
// Generic utility — reusable by future modules.
// key: PropertiesService key for the spreadsheet ID (e.g. 'ASSETS_SHEET_ID')
function getSheet(key, sheetName) {
  const ss = SpreadsheetApp.openById(_getSpreadsheetId(key));
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet "' + sheetName + '" not found (property: ' + key + ')');
  return sh;
}

// One-time setup: call this in the Apps Script editor to store the assets sheet ID.
function setAssetsSheetId(id) {
  PropertiesService.getScriptProperties().setProperty('ASSETS_SHEET_ID', id);
  return 'ASSETS_SHEET_ID set';
}

// ── INTERNAL: ensure header row exists at row 1 ────────────────────────────────
function _ensureLendingHeader(sh) {
  try {
    const lastRow = sh.getLastRow();
    Logger.log('_ensureLendingHeader: lastRow=' + lastRow);

    // If sheet is completely empty, append header
    if (lastRow === 0) {
      Logger.log('_ensureLendingHeader: sheet is empty, appending header');
      sh.appendRow(L_HDR);
      Logger.log('_ensureLendingHeader: header appended');
    } else {
      // Sheet has data, check first row
      try {
        const firstRow = sh.getRange(1, 1, 1, L_HDR.length).getValues()[0];
        const isHeader = L_HDR.every((col, i) => String(firstRow[i] || '').trim() === col);

        if (!isHeader) {
          Logger.log('_ensureLendingHeader: header incorrect, rebuilding');
          // Clear row 1 and set header values
          sh.getRange(1, 1, 1, L_HDR.length).clearContent();
          for (let i = 0; i < L_HDR.length; i++) {
            sh.getRange(1, i + 1).setValue(L_HDR[i]);
          }
          Logger.log('_ensureLendingHeader: header rebuilt');
        } else {
          Logger.log('_ensureLendingHeader: header is correct');
        }
      } catch(e) {
        // If first row check fails, rebuild it
        Logger.log('_ensureLendingHeader: first row check failed, rebuilding header');
        try {
          sh.getRange(1, 1, 1, L_HDR.length).clearContent();
        } catch(e2) {}
        for (let i = 0; i < L_HDR.length; i++) {
          sh.getRange(1, i + 1).setValue(L_HDR[i]);
        }
      }
    }

    // Apply minimal formatting (safer than full styling)
    try {
      const hdr = sh.getRange(1, 1, 1, L_HDR.length);
      hdr.setFontWeight('bold').setBackground('#1E1B4B').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
      Logger.log('_ensureLendingHeader: formatting applied');
    } catch(e) {
      Logger.log('_ensureLendingHeader: formatting skipped (' + e.message + ')');
    }

    // Hide ID column (optional, non-critical)
    try {
      sh.setColumnWidth(1, 40);
      sh.hideColumns(1);
    } catch(e) {}
  } catch(e) {
    Logger.log('_ensureLendingHeader ERROR: ' + e.message);
    throw e;
  }
}

// ── INTERNAL: get (or initialise) the Lending sheet ──────────────────────────
function _lendingSheet(sheetName) {
  const name = sheetName || L_SHEET;
  Logger.log('_lendingSheet: requesting sheet name=' + name);

  const ssId = _getSpreadsheetId('ASSETS_SHEET_ID');
  Logger.log('_lendingSheet: ASSETS_SHEET_ID=' + ssId);

  const ss = SpreadsheetApp.openById(ssId);
  Logger.log('_lendingSheet: spreadsheet opened, name=' + ss.getName());

  let sh = ss.getSheetByName(name);
  if (!sh) {
    Logger.log('_lendingSheet: sheet "' + name + '" not found, creating');
    sh = ss.insertSheet(name);
    sh.appendRow(L_HDR);
    Logger.log('_lendingSheet: sheet "' + name + '" created and header added');
  } else {
    Logger.log('_lendingSheet: sheet "' + name + '" exists, lastRow=' + sh.getLastRow());
  }

  // Validate sheet object
  if (!sh) {
    throw new Error('Failed to get or create sheet: ' + name);
  }
  Logger.log('Sheet used: ' + name);

  // Always ensure header is correct
  _ensureLendingHeader(sh);

  return sh;
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
function _lendingHandleGet(action, sheetName) {
  const sheet = sheetName || 'Lending';
  Logger.log('_lendingHandleGet action: ' + action + ', sheet used: ' + sheet);

  if (action === 'getEntries') {
    Logger.log('_lendingHandleGet: Calling _lending_getEntries with sheet=' + sheet);
    const result = _lending_getEntries(sheet);
    Logger.log('_lendingHandleGet: _lending_getEntries returned ' + result.length + ' entries from sheet "' + sheet + '"');
    return result;
  }
  throw new Error('Unknown lending GET action: ' + action);
}

function _lendingHandlePost(action, body) {
  const sheet = body.sheetName || 'Lending';
  Logger.log('_lendingHandlePost action: ' + action + ', sheet used: ' + sheet);

  if (action === 'addEntry') {
    Logger.log('_lendingHandlePost: Calling _lending_addEntry with sheet=' + sheet);
    return _lending_addEntry(body.date, body.name, body.amount, body.type, body.description, sheet);
  }
  if (action === 'updateEntry') {
    Logger.log('_lendingHandlePost: Calling _lending_updateEntry with sheet=' + sheet);
    return _lending_updateEntry(body.id, body.date, body.name, body.amount, body.type, body.description, sheet);
  }
  if (action === 'deleteEntry') {
    Logger.log('_lendingHandlePost: Calling _lending_deleteEntry with sheet=' + sheet);
    return _lending_deleteEntry(body.id, sheet);
  }
  throw new Error('Unknown lending POST action: ' + action);
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function _lending_getEntries(sheetName) {
  try {
    const sheet = sheetName || 'Lending';
    Logger.log('_lending_getEntries: sheet=' + sheet);
    const sh = _lendingSheet(sheet);

    if (!sh) {
      throw new Error('Invalid sheet: ' + sheet);
    }
    Logger.log('_lending_getEntries: sheet obtained, reading data from "' + sheet + '"');

    const vals = sh.getDataRange().getValues();
    Logger.log('_lending_getEntries: got ' + vals.length + ' rows from sheet "' + sheet + '"');

    if (vals.length < 2) {
      Logger.log('_lending_getEntries: sheet "' + sheet + '" only has header or is empty');
      return [];
    }

    const result = vals.slice(1)
      .filter(r => {
        const type = String(r[L_COL.TYPE] || '').trim().toUpperCase();
        return type === 'LEND' || type === 'REPAY';
      })
      .map(r => ({
        id:          String(r[L_COL.ID]   || ''),
        date:        _fmtDate(r[L_COL.DATE]),
        name:        String(r[L_COL.NAME] || '').trim(),
        amount:      parseFloat(r[L_COL.AMT]) || 0,
        type:        String(r[L_COL.TYPE] || '').trim().toUpperCase(),
        description: String(r[L_COL.DESC] || '').trim(),
      }));

    Logger.log('_lending_getEntries: returning ' + result.length + ' valid entries');
    return result;
  } catch(e) {
    Logger.log('_lending_getEntries ERROR: ' + e.message);
    throw e;
  }
}

function _lending_addEntry(date, name, amount, type, description, sheetName) {
  try {
    const sheet = sheetName || 'Lending';
    Logger.log('_lending_addEntry: START sheet=' + sheet + ', name=' + name + ', amount=' + amount + ', type=' + type);
    const sh  = _lendingSheet(sheet);

    if (!sh) {
      throw new Error('Invalid sheet: ' + sheet);
    }
    Logger.log('_lending_addEntry: sheet "' + sheet + '" obtained');

    const id  = Utilities.getUuid();
    const amt = parseFloat(amount) || 0;
    Logger.log('_lending_addEntry: appending row to sheet "' + sheet + '" with id=' + id);
    sh.appendRow([id, date || '', String(name || '').trim(), amt, String(type || '').toUpperCase(), String(description || '').trim()]);
    Logger.log('_lending_addEntry: row appended to sheet "' + sheet + '", last row=' + sh.getLastRow());

    const row = sh.getLastRow();
    Logger.log('_lending_addEntry: styling row ' + row);
    _lendingStyleRow(sh, row, String(type || ''));
    Logger.log('_lending_addEntry: styling complete');
    Logger.log('_lending_addEntry: SUCCESS id=' + id);
    return id;
  } catch(e) {
    Logger.log('_lending_addEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _lending_updateEntry(id, date, name, amount, type, description, sheetName) {
  try {
    const sheet = sheetName || 'Lending';
    Logger.log('_lending_updateEntry: START id=' + id + ', sheet=' + sheet + ', name=' + name + ', amount=' + amount);
    const sh   = _lendingSheet(sheet);

    if (!sh) {
      throw new Error('Invalid sheet: ' + sheet);
    }
    Logger.log('_lending_updateEntry: sheet "' + sheet + '" obtained');

    const vals = sh.getDataRange().getValues();
    Logger.log('_lending_updateEntry: data read from sheet "' + sheet + '", rows=' + vals.length);

    const targetId = String(id).trim();

    for (let i = 1; i < vals.length; i++) {
      const rowId = String(vals[i][L_COL.ID] || "").trim();
      Logger.log('_lending_updateEntry: comparing rowId="' + rowId + '" with targetId="' + targetId + '"');

      if (rowId === targetId) {
        Logger.log('_lending_updateEntry: found entry at row ' + (i + 1));
        const amt = parseFloat(amount) || 0;
        const rowNum = i + 1;
        Logger.log('_lending_updateEntry: setting values for row ' + rowNum);
        sh.getRange(rowNum, 1, 1, L_HDR.length).setValues([[
          id,
          date || '',
          String(name || '').trim(),
          amt,
          String(type || '').toUpperCase(),
          String(description || '').trim(),
        ]]);
        Logger.log('_lending_updateEntry: values set, styling row');
        _lendingStyleRow(sh, rowNum, String(type || ''));
        Logger.log('_lending_updateEntry: SUCCESS');
        return true;
      }
    }
    throw new Error('Lending entry not found: ' + id);
  } catch(e) {
    Logger.log('_lending_updateEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _lending_deleteEntry(id, sheetName) {
  try {
    const sheet = sheetName || 'Lending';
    Logger.log('_lending_deleteEntry: id=' + id + ', sheet=' + sheet);
    const sh   = _lendingSheet(sheet);

    if (!sh) {
      throw new Error('Invalid sheet: ' + sheet);
    }
    Logger.log('_lending_deleteEntry: sheet "' + sheet + '" obtained, reading data');

    const vals = sh.getDataRange().getValues();
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][L_COL.ID]) === String(id)) {
        Logger.log('_lending_deleteEntry: found entry at row ' + (i + 1));
        sh.deleteRow(i + 1);
        Logger.log('_lending_deleteEntry: success');
        return true;
      }
    }
    throw new Error('Lending entry not found: ' + id);
  } catch(e) {
    Logger.log('_lending_deleteEntry ERROR: ' + e.message);
    throw e;
  }
}

// ── FORMATTING ────────────────────────────────────────────────────────────────
function _lendingStyleRow(sh, rowNum, type) {
  const isRepay = type.toUpperCase() === 'REPAY';
  const bg = isRepay ? '#F0FDF4' : '#FEF2F2';
  const fg = isRepay ? '#166534' : '#991B1B';
  sh.getRange(rowNum, 2, 1, L_HDR.length - 1).setBackground(bg).setFontColor(fg);
  sh.getRange(rowNum, L_COL.AMT + 1).setFontWeight('bold').setNumberFormat('₹#,##,##0.00').setHorizontalAlignment('right');
  sh.getRange(rowNum, L_COL.DATE + 1).setNumberFormat('dd-mmm-yy').setHorizontalAlignment('center');
  sh.getRange(rowNum, L_COL.TYPE + 1).setHorizontalAlignment('center');
}
