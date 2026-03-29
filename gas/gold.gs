// ── GOLD MODULE ───────────────────────────────────────────────────────────────
//
// Spreadsheet : FinanceTrackerAssets
// Sheet       : Gold
// Columns     : ID | Name | WeightG | Pavan | Person | Location
//
// All functions in this file are prefixed _gold_ to avoid naming collisions.
// Entry points are _goldHandleGet / _goldHandlePost, called from Code.gs.

const G_COL = { ID: 0, NAME: 1, WEIGHT_G: 2, PAVAN: 3, PERSON: 4, LOCATION: 5 };
const G_HDR = ['ID', 'Name', 'WeightG', 'Pavan', 'Person', 'Location'];
const G_SHEET = 'Gold';
const PAVAN_CONVERSION = 1 / 8; // 1 pavan = 8 grams

// ── UTILITY: calculate pavan from weight_g ────────────────────────────────────
function _calcPavan(weight_g) {
  const wg = parseFloat(weight_g) || 0;
  return wg * PAVAN_CONVERSION;
}

// ── INTERNAL: ensure header row exists at row 1 ────────────────────────────────
function _ensureGoldHeader(sh) {
  try {
    const lastRow = sh.getLastRow();
    Logger.log('_ensureGoldHeader: lastRow=' + lastRow);

    // If sheet is completely empty, append header
    if (lastRow === 0) {
      Logger.log('_ensureGoldHeader: sheet is empty, appending header');
      sh.appendRow(G_HDR);
      Logger.log('_ensureGoldHeader: header appended');
    } else {
      // Sheet has data, check first row
      try {
        const firstRow = sh.getRange(1, 1, 1, G_HDR.length).getValues()[0];
        const isHeader = G_HDR.every((col, i) => String(firstRow[i] || '').trim() === col);

        if (!isHeader) {
          Logger.log('_ensureGoldHeader: header incorrect, rebuilding');
          // Clear row 1 and set header values
          sh.getRange(1, 1, 1, G_HDR.length).clearContent();
          for (let i = 0; i < G_HDR.length; i++) {
            sh.getRange(1, i + 1).setValue(G_HDR[i]);
          }
          Logger.log('_ensureGoldHeader: header rebuilt');
        } else {
          Logger.log('_ensureGoldHeader: header is correct');
        }
      } catch(e) {
        // If first row check fails, rebuild it
        Logger.log('_ensureGoldHeader: first row check failed, rebuilding header');
        try {
          sh.getRange(1, 1, 1, G_HDR.length).clearContent();
        } catch(e2) {}
        for (let i = 0; i < G_HDR.length; i++) {
          sh.getRange(1, i + 1).setValue(G_HDR[i]);
        }
      }
    }
  } catch(e) {
    Logger.log('_ensureGoldHeader ERROR: ' + e.message);
    throw e;
  }
}

// ── INTERNAL: get (or initialise) the Gold sheet ───────────────────────────────
function _goldSheet() {
  Logger.log('_goldSheet: getting spreadsheet ID');
  const ssId = _getSpreadsheetId('ASSETS_SHEET_ID');
  Logger.log('_goldSheet: opening spreadsheet: ' + ssId);

  const ss = SpreadsheetApp.openById(ssId);
  Logger.log('_goldSheet: spreadsheet name=' + ss.getName());

  let sh = ss.getSheetByName(G_SHEET);
  if (!sh) {
    Logger.log('_goldSheet: sheet "' + G_SHEET + '" not found, creating');
    sh = ss.insertSheet(G_SHEET);
    sh.appendRow(G_HDR);
    Logger.log('_goldSheet: sheet created and header added');
  } else {
    Logger.log('_goldSheet: sheet "' + G_SHEET + '" found, lastRow=' + sh.getLastRow());
  }

  // Always ensure header is correct
  _ensureGoldHeader(sh);

  return sh;
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
function _goldHandleGet(action) {
  Logger.log('_goldHandleGet action: ' + action);
  if (action === 'getEntries') {
    Logger.log('Calling _gold_getEntries');
    const result = _gold_getEntries();
    Logger.log('_gold_getEntries returned: ' + result.length + ' entries');
    return result;
  }
  if (action === 'getHistory') {
    Logger.log('Calling _gold_getHistory');
    const result = _gold_getHistory();
    Logger.log('_gold_getHistory returned: ' + result.length + ' entries');
    return result;
  }
  throw new Error('Unknown gold GET action: ' + action);
}

function _goldHandlePost(action, body) {
  Logger.log('_goldHandlePost action: ' + action);
  if (action === 'addEntry') {
    Logger.log('Calling _gold_addEntry');
    return _gold_addEntry(body.name, body.weight_g, body.pavan, body.person, body.location);
  }
  if (action === 'updateEntry') {
    Logger.log('Calling _gold_updateEntry');
    return _gold_updateEntry(body.id, body.name, body.weight_g, body.pavan, body.person, body.location);
  }
  if (action === 'deleteEntry') {
    Logger.log('Calling _gold_deleteEntry');
    return _gold_deleteEntry(body.id);
  }
  if (action === 'addHistory') {
    Logger.log('Calling _gold_addHistory');
    return _gold_addHistory(body.date, body.type, body.name, body.weight_g, body.note);
  }
  if (action === 'updateHistory') {
    Logger.log('Calling _gold_updateHistory');
    return _gold_updateHistory(body);
  }
  if (action === 'deleteHistory') {
    Logger.log('Calling _gold_deleteHistory');
    return _gold_deleteHistory(body.id);
  }
  throw new Error('Unknown gold POST action: ' + action);
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function _gold_getEntries() {
  try {
    Logger.log('_gold_getEntries: getting sheet');
    const sh = _goldSheet();
    Logger.log('_gold_getEntries: sheet obtained, reading data');

    const vals = sh.getDataRange().getValues();
    Logger.log('_gold_getEntries: got ' + vals.length + ' rows');

    if (vals.length < 2) {
      Logger.log('_gold_getEntries: only header row or empty');
      return [];
    }

    const result = vals.slice(1).map(r => ({
      id:       String(r[G_COL.ID]       || ''),
      name:     String(r[G_COL.NAME]     || '').trim(),
      weight_g: parseFloat(r[G_COL.WEIGHT_G]) || 0,
      pavan:    parseFloat(r[G_COL.PAVAN])    || 0,
      person:   String(r[G_COL.PERSON]   || '').trim(),
      location: String(r[G_COL.LOCATION] || '').trim(),
    }));

    Logger.log('_gold_getEntries: returning ' + result.length + ' entries');
    return result;
  } catch(e) {
    Logger.log('_gold_getEntries ERROR: ' + e.message);
    throw e;
  }
}

function _gold_addEntry(name, weight_g, pavan, person, location) {
  try {
    Logger.log('_gold_addEntry: START name=' + name + ', weight_g=' + weight_g);
    const sh = _goldSheet();
    Logger.log('_gold_addEntry: sheet obtained');
    const id = Utilities.getUuid();
    const wg = parseFloat(weight_g) || 0;
    const pv = _calcPavan(wg); // Auto-calculate pavan from weight_g

    const rowCountBefore = sh.getLastRow();
    Logger.log('_gold_addEntry: row count before append=' + rowCountBefore + ', appending row with id=' + id);

    sh.appendRow([
      id,
      String(name || '').trim(),
      wg,
      pv,
      String(person || '').trim(),
      String(location || '').trim()
    ]);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_gold_addEntry: row count after append=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore + 1) {
      throw new Error('Data append verification failed: expected ' + (rowCountBefore + 1) + ' rows, got ' + rowCountAfter);
    }

    Logger.log('_gold_addEntry: SUCCESS id=' + id);
    return id;
  } catch(e) {
    Logger.log('_gold_addEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _gold_updateEntry(id, name, weight_g, pavan, person, location) {
  try {
    Logger.log('_gold_updateEntry: START id=' + id + ', name=' + name);
    const sh = _goldSheet();
    Logger.log('_gold_updateEntry: sheet obtained');
    const vals = sh.getDataRange().getValues();
    const rowCountBefore = sh.getLastRow();
    Logger.log('_gold_updateEntry: data read, rows=' + vals.length + ', row count=' + rowCountBefore);

    const targetId = String(id).trim();
    let targetRow = -1;

    // Find the target row
    for (let i = 1; i < vals.length; i++) {
      const rowId = String(vals[i][G_COL.ID] || "").trim();
      Logger.log('_gold_updateEntry: comparing rowId="' + rowId + '" with targetId="' + targetId + '"');

      if (rowId === targetId) {
        targetRow = i + 1;
        Logger.log('_gold_updateEntry: found entry at row ' + targetRow);
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Gold entry not found: ' + id);
    }

    const wg = parseFloat(weight_g) || 0;
    const pv = _calcPavan(wg); // Auto-calculate pavan from weight_g
    Logger.log('_gold_updateEntry: setting values for row ' + targetRow);

    sh.getRange(targetRow, 1, 1, G_HDR.length).setValues([[
      id,
      String(name || '').trim(),
      wg,
      pv,
      String(person || '').trim(),
      String(location || '').trim()
    ]]);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_gold_updateEntry: row count before=' + rowCountBefore + ', after=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore) {
      throw new Error('Data update verification failed: row count changed from ' + rowCountBefore + ' to ' + rowCountAfter);
    }

    Logger.log('_gold_updateEntry: SUCCESS');
    return true;
  } catch(e) {
    Logger.log('_gold_updateEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _gold_deleteEntry(id) {
  try {
    Logger.log('_gold_deleteEntry: id=' + id);
    const sh = _goldSheet();
    const vals = sh.getDataRange().getValues();
    const rowCountBefore = sh.getLastRow();
    Logger.log('_gold_deleteEntry: row count before delete=' + rowCountBefore);

    let targetRow = -1;

    // Find the target row (search backwards to avoid index shifts)
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][G_COL.ID]) === String(id)) {
        targetRow = i + 1;
        Logger.log('_gold_deleteEntry: found entry at row ' + targetRow);
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Gold entry not found: ' + id);
    }

    sh.deleteRow(targetRow);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_gold_deleteEntry: row count after delete=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore - 1) {
      throw new Error('Data delete verification failed: expected ' + (rowCountBefore - 1) + ' rows, got ' + rowCountAfter);
    }

    Logger.log('_gold_deleteEntry: success');
    return true;
  } catch(e) {
    Logger.log('_gold_deleteEntry ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

// ── GOLD HISTORY SHEET ────────────────────────────────────────────────────────
// Sheet: "Gold - History"
// Columns: ID | Date | Type | Name | WeightG | Note
// Supports: add, update (by id), delete (by id)

const GH_COL = { ID: 0, DATE: 1, TYPE: 2, NAME: 3, WEIGHT_G: 4, NOTE: 5 };
const GH_HDR = ['ID', 'Date', 'Type', 'Name', 'WeightG', 'Note'];
const GH_SHEET = 'Gold - History';

// ── INTERNAL: ensure header row exists ─────────────────────────────────────────
function _ensureGoldHistoryHeader(sh) {
  try {
    const lastRow = sh.getLastRow();
    Logger.log('_ensureGoldHistoryHeader: lastRow=' + lastRow);

    if (lastRow === 0) {
      Logger.log('_ensureGoldHistoryHeader: sheet is empty, appending header');
      sh.appendRow(GH_HDR);
      Logger.log('_ensureGoldHistoryHeader: header appended');
    } else if (lastRow >= 1) {
      // Only validate header, NEVER clear data
      try {
        const firstRow = sh.getRange(1, 1, 1, GH_HDR.length).getValues()[0];
        const isHeader = GH_HDR.every((col, i) => String(firstRow[i] || '').trim() === col);

        if (!isHeader) {
          Logger.log('_ensureGoldHistoryHeader: header mismatch detected, but NOT modifying to preserve data');
          Logger.log('_ensureGoldHistoryHeader: first row content: ' + JSON.stringify(firstRow));
          // Do NOT clear or modify - just log the issue
        }
      } catch(e) {
        Logger.log('_ensureGoldHistoryHeader: first row check failed, but preserving all data: ' + e.message);
        // Do NOT modify the sheet
      }
    }
  } catch(e) {
    Logger.log('_ensureGoldHistoryHeader ERROR: ' + e.message);
    throw e;
  }
}

// ── INTERNAL: get (or initialise) the Gold History sheet ──────────────────────
function _goldHistorySheet() {
  Logger.log('_goldHistorySheet: getting spreadsheet ID');
  const ssId = _getSpreadsheetId('ASSETS_SHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);

  let sh = ss.getSheetByName(GH_SHEET);
  if (!sh) {
    Logger.log('_goldHistorySheet: sheet "' + GH_SHEET + '" not found, creating');
    sh = ss.insertSheet(GH_SHEET);
    sh.appendRow(GH_HDR);
  }

  _ensureGoldHistoryHeader(sh);
  return sh;
}

// ── HISTORY ACTIONS ────────────────────────────────────────────────────────────
function _gold_getHistory() {
  try {
    Logger.log('_gold_getHistory: getting sheet');
    const sh = _goldHistorySheet();
    const vals = sh.getDataRange().getValues();

    if (vals.length < 2) {
      Logger.log('_gold_getHistory: only header row or empty');
      return [];
    }

    const result = vals.slice(1).map(r => ({
      id:       String(r[GH_COL.ID]       || ''),
      date:     _fmtDate(r[GH_COL.DATE]),
      type:     String(r[GH_COL.TYPE]     || '').trim().toUpperCase(),
      name:     String(r[GH_COL.NAME]     || '').trim(),
      weight_g: parseFloat(r[GH_COL.WEIGHT_G]) || 0,
      note:     String(r[GH_COL.NOTE]     || '').trim() || undefined,
    }));

    Logger.log('_gold_getHistory: returning ' + result.length + ' entries');
    return result;
  } catch(e) {
    Logger.log('_gold_getHistory ERROR: ' + e.message);
    throw e;
  }
}

function _gold_addHistory(date, type, name, weight_g, note) {
  try {
    Logger.log('_gold_addHistory: START type=' + type + ', name=' + name + ', weight_g=' + weight_g);
    const sh = _goldHistorySheet();
    const id = Utilities.getUuid();
    const wg = parseFloat(weight_g) || 0;
    const typeUpper = String(type || '').trim().toUpperCase();

    if (typeUpper !== 'IN' && typeUpper !== 'OUT') {
      throw new Error('Invalid history type: ' + type);
    }

    // Verify sheet state before append
    const rowCountBefore = sh.getLastRow();
    Logger.log('_gold_addHistory: row count before append=' + rowCountBefore);

    sh.appendRow([
      id,
      date || '',
      typeUpper,
      String(name || '').trim(),
      wg,
      String(note || '').trim()
    ]);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_gold_addHistory: row count after append=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore + 1) {
      throw new Error('Data append verification failed: expected ' + (rowCountBefore + 1) + ' rows, got ' + rowCountAfter);
    }

    Logger.log('_gold_addHistory: SUCCESS id=' + id);
    return id;
  } catch(e) {
    Logger.log('_gold_addHistory ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _gold_updateHistory(body) {
  try {
    Logger.log('_gold_updateHistory: START id=' + body.id);
    const sh = _goldHistorySheet();
    const vals = sh.getDataRange().getValues();
    const rowCountBefore = sh.getLastRow();

    const targetId = String(body.id || '').trim();
    let targetRow = -1;

    // Find the target row
    for (let i = 1; i < vals.length; i++) {
      const rowId = String(vals[i][GH_COL.ID] || '').trim();
      if (rowId === targetId) {
        targetRow = i + 1;
        Logger.log('_gold_updateHistory: found entry at row ' + targetRow);
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Gold history entry not found: ' + body.id);
    }

    const wg = parseFloat(body.weight_g) || 0;
    const typeUpper = String(body.type || '').trim().toUpperCase();

    if (typeUpper !== 'IN' && typeUpper !== 'OUT') {
      throw new Error('Invalid history type: ' + body.type);
    }

    // Update the row
    sh.getRange(targetRow, 1, 1, GH_HDR.length).setValues([[
      body.id,
      body.date || '',
      typeUpper,
      String(body.name || '').trim(),
      wg,
      String(body.note || '').trim()
    ]]);

    const rowCountAfter = sh.getLastRow();
    Logger.log('_gold_updateHistory: row count before=' + rowCountBefore + ', after=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore) {
      throw new Error('Data update verification failed: row count changed from ' + rowCountBefore + ' to ' + rowCountAfter);
    }

    Logger.log('_gold_updateHistory: SUCCESS');
    return { success: true };
  } catch(e) {
    Logger.log('_gold_updateHistory ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

function _gold_deleteHistory(id) {
  try {
    Logger.log('_gold_deleteHistory: id=' + id);
    const sh = _goldHistorySheet();
    const vals = sh.getDataRange().getValues();
    const rowCountBefore = sh.getLastRow();
    Logger.log('_gold_deleteHistory: row count before delete=' + rowCountBefore);

    let deletedCount = 0;
    let targetRow = -1;

    // Find the target row (search backwards to avoid index shifts)
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][GH_COL.ID] || '').trim() === String(id || '').trim()) {
        Logger.log('_gold_deleteHistory: found entry at row ' + (i + 1));
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Gold history entry not found: ' + id);
    }

    // Delete the row
    sh.deleteRow(targetRow);
    deletedCount = 1;

    const rowCountAfter = sh.getLastRow();
    Logger.log('_gold_deleteHistory: row count after delete=' + rowCountAfter);

    if (rowCountAfter !== rowCountBefore - 1) {
      throw new Error('Data delete verification failed: expected ' + (rowCountBefore - 1) + ' rows, got ' + rowCountAfter);
    }

    Logger.log('_gold_deleteHistory: success, deleted ' + deletedCount + ' row(s)');
    return { success: true };
  } catch(e) {
    Logger.log('_gold_deleteHistory ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

// ── SETTINGS (GAS PropertiesService) ───────────────────────────────────────────
function _gold_getSettings() {
  try {
    Logger.log('_gold_getSettings: retrieving settings');
    const props = PropertiesService.getScriptProperties();
    const rate = parseFloat(props.getProperty('GOLD_RATE') || '7500');
    Logger.log('_gold_getSettings: goldRate=' + rate);
    return { goldRate: rate };
  } catch(e) {
    Logger.log('_gold_getSettings ERROR: ' + e.message);
    throw e;
  }
}

function _gold_saveSettings(goldRate) {
  try {
    Logger.log('_gold_saveSettings: START goldRate=' + goldRate);
    const rate = parseFloat(goldRate) || 7500;
    PropertiesService.getScriptProperties().setProperty('GOLD_RATE', String(rate));
    Logger.log('_gold_saveSettings: SUCCESS, rate=' + rate);
    return true;
  } catch(e) {
    Logger.log('_gold_saveSettings ERROR: ' + e.message);
    throw e;
  }
}
