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
  const id = PropertiesService.getScriptProperties().getProperty(key);
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

// ── INTERNAL: get (or initialise) the Lending sheet ──────────────────────────
function _lendingSheet() {
  const ss = SpreadsheetApp.openById(_getSpreadsheetId('ASSETS_SHEET_ID'));

  let sh = ss.getSheetByName(L_SHEET);
  if (!sh) {
    sh = ss.insertSheet(L_SHEET);
    sh.appendRow(L_HDR);
    // Style header row
    const hdr = sh.getRange(1, 1, 1, L_HDR.length);
    hdr.setFontWeight('bold')
       .setBackground('#1E1B4B')
       .setFontColor('#FFFFFF')
       .setFontSize(11)
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle');
    sh.setRowHeight(1, 32);
    sh.setFrozenRows(1);
    // Column widths
    sh.setColumnWidth(1, 0);   // ID — hide
    sh.setColumnWidth(2, 100); // Date
    sh.setColumnWidth(3, 160); // Name
    sh.setColumnWidth(4, 120); // Amount
    sh.setColumnWidth(5, 90);  // Type
    sh.setColumnWidth(6, 240); // Description
    try { sh.hideColumns(1); } catch(e) {}
  }
  return sh;
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
function _lendingHandleGet(action) {
  if (action === 'getEntries') return _lending_getEntries();
  throw new Error('Unknown lending GET action: ' + action);
}

function _lendingHandlePost(action, body) {
  if (action === 'addEntry')    return _lending_addEntry(body.date, body.name, body.amount, body.type, body.description);
  if (action === 'updateEntry') return _lending_updateEntry(body.id, body.date, body.name, body.amount, body.type, body.description);
  if (action === 'deleteEntry') return _lending_deleteEntry(body.id);
  throw new Error('Unknown lending POST action: ' + action);
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function _lending_getEntries() {
  const sh   = _lendingSheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];

  return vals.slice(1)
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
}

function _lending_addEntry(date, name, amount, type, description) {
  const sh  = _lendingSheet();
  const id  = Utilities.getUuid();
  const amt = parseFloat(amount) || 0;
  sh.appendRow([id, date || '', String(name || '').trim(), amt, String(type || '').toUpperCase(), String(description || '').trim()]);

  const row = sh.getLastRow();
  _lendingStyleRow(sh, row, String(type || ''));
  return id;
}

function _lending_updateEntry(id, date, name, amount, type, description) {
  const sh   = _lendingSheet();
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][L_COL.ID]) === String(id)) {
      const amt = parseFloat(amount) || 0;
      sh.getRange(i + 1, 1, 1, L_HDR.length).setValues([[
        id,
        date || '',
        String(name || '').trim(),
        amt,
        String(type || '').toUpperCase(),
        String(description || '').trim(),
      ]]);
      _lendingStyleRow(sh, i + 1, String(type || ''));
      return true;
    }
  }
  throw new Error('Lending entry not found: ' + id);
}

function _lending_deleteEntry(id) {
  const sh   = _lendingSheet();
  const vals = sh.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][L_COL.ID]) === String(id)) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  throw new Error('Lending entry not found: ' + id);
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
