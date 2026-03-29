// EMI Loans Module
// Manages EMI loan entries with auto-increment trigger for monthly payment tracking

const E_COL = { ID: 0, NAME: 1, BANK: 2, PRINCIPAL: 3, RATE: 4, START_DATE: 5, TENURE_MONTHS: 6, EMI_AMOUNT: 7, PAID_EMIS: 8, STATUS: 9 };
const E_HDR = ['ID', 'Name', 'Bank', 'Principal', 'Rate', 'StartDate', 'TenureMonths', 'EmiAmount', 'PaidEmis', 'Status'];
const DEFAULT_E_SHEET = 'EMI';

// Jewel Loans (Gold Loans) Module
const JL_COL = { ID: 0, NAME: 1, BANK: 2, PRINCIPAL: 3, RATE: 4, START_DATE: 5, END_DATE: 6, PAID_AMOUNT: 7, STATUS: 8 };
const JL_HDR = ['ID', 'Name', 'Bank', 'Principal', 'Rate', 'StartDate', 'EndDate', 'PaidAmount', 'Status'];
const DEFAULT_JL_SHEET = 'Jewel Loan';

const JLH_COL = { ID: 0, LOAN_ID: 1, DATE: 2, AMOUNT: 3, NOTE: 4 };
const JLH_HDR = ['ID', 'LoanId', 'Date', 'Amount', 'Note'];
const JLH_SHEET = 'Jewel Loan Repayment';

// Cash Loans Module
const CL_COL = { ID: 0, PERSON_NAME: 1, AMOUNT_RECEIVED: 2, START_DATE: 3, PAID_AMOUNT: 4 };
const CL_HDR = ['ID', 'PersonName', 'AmountReceived', 'StartDate', 'PaidAmount'];
const CL_SHEET = 'Cash Loan';

const CLH_COL = { ID: 0, LOAN_ID: 1, DATE: 2, AMOUNT: 3, NOTE: 4 };
const CLH_HDR = ['ID', 'LoanId', 'Date', 'Amount', 'Note'];
const CLH_SHEET = 'Cash Loan Repayment';

// Get the loans spreadsheet ID from properties
function _getLoansSpreadsheetId() {
  const id = PropertiesService.getScriptProperties().getProperty('LOANS_SPREADSHEET_ID');
  if (!id) throw new Error('LOANS_SPREADSHEET_ID not configured. Run _loans_saveSettings(spreadsheetId, sheetName)');
  return id;
}

// Get the EMI sheet name from properties (defaults to 'EMI')
function _getEmiSheetName() {
  return PropertiesService.getScriptProperties().getProperty('EMI_SHEET_NAME') || DEFAULT_E_SHEET;
}

// Get the Jewel Loan sheet name (always uses 'Jewel Loan')
function _getJewelLoanSheetName() {
  return DEFAULT_JL_SHEET;
}

// Get the EMI loans sheet with header validation
function _emiLoansSheet() {
  const ssId = _getLoansSpreadsheetId();
  const sheetName = _getEmiSheetName();
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.appendRow(E_HDR);
  }
  _ensureEmiLoansHeader(sh);
  return sh;
}

// Ensure header row exists and matches expected columns
function _ensureEmiLoansHeader(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(E_HDR);
    return;
  }
  const hdr = sh.getRange(1, 1, 1, E_HDR.length).getValues()[0];
  if (hdr.join('|') !== E_HDR.join('|')) {
    Logger.log('WARNING: EMI Loans sheet header mismatch. Expected: ' + E_HDR.join(',') + ', Got: ' + hdr.join(','));
  }
}

// Get the Jewel Loans sheet with header validation
function _jewelLoansSheet() {
  const ssId = _getLoansSpreadsheetId();
  const sheetName = _getJewelLoanSheetName();
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.appendRow(JL_HDR);
  }
  _ensureJewelLoansHeader(sh);
  return sh;
}

// Ensure Jewel Loans header row exists and matches
function _ensureJewelLoansHeader(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(JL_HDR);
    return;
  }
  const hdr = sh.getRange(1, 1, 1, JL_HDR.length).getValues()[0];
  if (hdr.join('|') !== JL_HDR.join('|')) {
    Logger.log('WARNING: Jewel Loans sheet header mismatch. Expected: ' + JL_HDR.join(',') + ', Got: ' + hdr.join(','));
  }
}

// Get the Jewel Loans History sheet with header validation
function _jewelLoansHistorySheet() {
  const ssId = _getLoansSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(JLH_SHEET);
  if (!sh) {
    sh = ss.insertSheet(JLH_SHEET);
    sh.appendRow(JLH_HDR);
  }
  _ensureJewelLoansHistoryHeader(sh);
  return sh;
}

// Ensure Jewel Loans History header row exists and matches
function _ensureJewelLoansHistoryHeader(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(JLH_HDR);
    return;
  }
  const hdr = sh.getRange(1, 1, 1, JLH_HDR.length).getValues()[0];
  if (hdr.join('|') !== JLH_HDR.join('|')) {
    Logger.log('WARNING: Jewel Loans History sheet header mismatch. Expected: ' + JLH_HDR.join(',') + ', Got: ' + hdr.join(','));
  }
}

// Get the Cash Loans sheet with header validation
function _cashLoansSheet() {
  const ssId = _getLoansSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(CL_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CL_SHEET);
    sh.appendRow(CL_HDR);
  }
  _ensureCashLoansHeader(sh);
  return sh;
}

// Ensure Cash Loans header row exists and matches
function _ensureCashLoansHeader(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(CL_HDR);
    return;
  }
  const hdr = sh.getRange(1, 1, 1, CL_HDR.length).getValues()[0];
  if (hdr.join('|') !== CL_HDR.join('|')) {
    Logger.log('WARNING: Cash Loans sheet header mismatch. Expected: ' + CL_HDR.join(',') + ', Got: ' + hdr.join(','));
  }
}

// Get the Cash Loans History sheet with header validation
function _cashLoansHistorySheet() {
  const ssId = _getLoansSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(CLH_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CLH_SHEET);
    sh.appendRow(CLH_HDR);
  }
  _ensureCashLoansHistoryHeader(sh);
  return sh;
}

// Ensure Cash Loans History header row exists and matches
function _ensureCashLoansHistoryHeader(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(CLH_HDR);
    return;
  }
  const hdr = sh.getRange(1, 1, 1, CLH_HDR.length).getValues()[0];
  if (hdr.join('|') !== CLH_HDR.join('|')) {
    Logger.log('WARNING: Cash Loans History sheet header mismatch. Expected: ' + CLH_HDR.join(',') + ', Got: ' + hdr.join(','));
  }
}

// Read loans settings from properties
function _loans_getSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    loansSpreadsheetId: props.getProperty('LOANS_SPREADSHEET_ID') || '',
    emiSheetName: props.getProperty('EMI_SHEET_NAME') || DEFAULT_E_SHEET,
  };
}

// Write loans settings to properties
function _loans_saveSettings(loansSpreadsheetId, emiSheetName) {
  const props = PropertiesService.getScriptProperties();
  if (loansSpreadsheetId) props.setProperty('LOANS_SPREADSHEET_ID', String(loansSpreadsheetId));
  if (emiSheetName) props.setProperty('EMI_SHEET_NAME', String(emiSheetName));
  return true;
}

// ─── JEWEL LOANS (Gold Loans) CRUD ─────────────────────────────────────────────

// Get all Jewel Loan entries
function _jl_getEntries() {
  const sh = _jewelLoansSheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return []; // Header only

  return vals.slice(1).map(row => ({
    id: String(row[JL_COL.ID] || ''),
    name: String(row[JL_COL.NAME] || ''),
    bank: String(row[JL_COL.BANK] || ''),
    principal: Number(row[JL_COL.PRINCIPAL]) || 0,
    rate: Number(row[JL_COL.RATE]) || 0,
    start_date: _fmtDate(row[JL_COL.START_DATE]),
    end_date: _fmtDate(row[JL_COL.END_DATE]),
    paid_amount: Number(row[JL_COL.PAID_AMOUNT]) || 0,
    status: String(row[JL_COL.STATUS] || 'Ongoing'),
  }));
}

// Add a new Jewel Loan entry
function _jl_addEntry(body) {
  const sh = _jewelLoansSheet();
  const id = Utilities.getUuid();
  const countBefore = sh.getLastRow();

  sh.appendRow([
    id,
    String(body.name || ''),
    String(body.bank || ''),
    Number(body.principal) || 0,
    Number(body.rate) || 0,
    body.start_date || '',
    body.end_date || '',
    0, // paid_amount defaults to 0
    body.status || 'Ongoing',
  ]);

  const countAfter = sh.getLastRow();
  if (countAfter !== countBefore + 1) {
    throw new Error('Failed to add Jewel Loan entry: row count mismatch');
  }

  return id;
}

// Update an existing Jewel Loan entry
function _jl_updateEntry(body) {
  const sh = _jewelLoansSheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][JL_COL.ID]).trim() === id) {
      const targetRow = i + 1;
      sh.getRange(targetRow, 1, 1, JL_HDR.length).setValues([[
        id,
        String(body.name || vals[i][JL_COL.NAME]),
        String(body.bank || vals[i][JL_COL.BANK]),
        Number(body.principal !== undefined ? body.principal : vals[i][JL_COL.PRINCIPAL]),
        Number(body.rate !== undefined ? body.rate : vals[i][JL_COL.RATE]),
        body.start_date || vals[i][JL_COL.START_DATE],
        body.end_date || vals[i][JL_COL.END_DATE],
        Number(body.paid_amount !== undefined ? body.paid_amount : vals[i][JL_COL.PAID_AMOUNT]),
        String(body.status || vals[i][JL_COL.STATUS]),
      ]]);
      return true;
    }
  }

  throw new Error('Jewel Loan not found: ' + id);
}

// Delete a Jewel Loan entry
function _jl_deleteEntry(body) {
  const sh = _jewelLoansSheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();
  const countBefore = vals.length - 1;

  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][JL_COL.ID]).trim() === id) {
      sh.deleteRow(i + 1);
      const countAfter = sh.getLastRow() - 1;
      if (countAfter !== countBefore - 1) {
        throw new Error('Failed to delete Jewel Loan entry: row count mismatch');
      }
      return true;
    }
  }

  throw new Error('Jewel Loan not found: ' + id);
}

// ─── JEWEL LOANS HISTORY CRUD ──────────────────────────────────────────────────

// Get all Jewel Loan history entries, optionally filtered by loan_id
function _jl_getHistory(p) {
  const sh = _jewelLoansHistorySheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];

  let entries = vals.slice(1).map(row => ({
    id: String(row[JLH_COL.ID] || ''),
    loan_id: String(row[JLH_COL.LOAN_ID] || ''),
    date: _fmtDate(row[JLH_COL.DATE]),
    amount: Number(row[JLH_COL.AMOUNT]) || 0,
    note: String(row[JLH_COL.NOTE] || ''),
  }));

  // Filter by loan_id if provided
  if (p && p.loan_id) {
    entries = entries.filter(e => e.loan_id === String(p.loan_id));
  }

  return entries;
}

// Helper: Recalculate paid_amount for a loan based on history entries
function _jl_recalcPaidAmount(loanId) {
  const histSh = _jewelLoansHistorySheet();
  const histVals = histSh.getDataRange().getValues();
  let totalPaid = 0;

  for (let i = 1; i < histVals.length; i++) {
    if (String(histVals[i][JLH_COL.LOAN_ID]).trim() === loanId) {
      totalPaid += Number(histVals[i][JLH_COL.AMOUNT]) || 0;
    }
  }

  // Update the main loan's paid_amount
  const mainSh = _jewelLoansSheet();
  const mainVals = mainSh.getDataRange().getValues();

  for (let i = 1; i < mainVals.length; i++) {
    if (String(mainVals[i][JL_COL.ID]).trim() === loanId) {
      mainSh.getRange(i + 1, JL_COL.PAID_AMOUNT + 1).setValue(totalPaid);
      return totalPaid;
    }
  }

  throw new Error('Jewel Loan not found for paid_amount recalc: ' + loanId);
}

// Add a new Jewel Loan history entry and update paid_amount
function _jl_addHistory(body) {
  const histSh = _jewelLoansHistorySheet();
  const id = Utilities.getUuid();
  const countBefore = histSh.getLastRow();

  histSh.appendRow([
    id,
    String(body.loan_id || ''),
    body.date || '',
    Number(body.amount) || 0,
    String(body.note || ''),
  ]);

  const countAfter = histSh.getLastRow();
  if (countAfter !== countBefore + 1) {
    throw new Error('Failed to add Jewel Loan history: row count mismatch');
  }

  // Recalculate paid_amount for the main loan
  _jl_recalcPaidAmount(String(body.loan_id));

  return id;
}

// Update a Jewel Loan history entry and recalculate paid_amount
function _jl_updateHistory(body) {
  const sh = _jewelLoansHistorySheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();
  const loanId = String(body.loan_id || '').trim();

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][JLH_COL.ID]).trim() === id) {
      const targetRow = i + 1;
      sh.getRange(targetRow, 1, 1, JLH_HDR.length).setValues([[
        id,
        loanId || vals[i][JLH_COL.LOAN_ID],
        body.date || vals[i][JLH_COL.DATE],
        Number(body.amount !== undefined ? body.amount : vals[i][JLH_COL.AMOUNT]),
        String(body.note || vals[i][JLH_COL.NOTE]),
      ]]);

      // Recalculate for the loan
      _jl_recalcPaidAmount(loanId || String(vals[i][JLH_COL.LOAN_ID]));
      return true;
    }
  }

  throw new Error('Jewel Loan history not found: ' + id);
}

// Delete a Jewel Loan history entry and recalculate paid_amount
function _jl_deleteHistory(body) {
  const sh = _jewelLoansHistorySheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();
  const countBefore = vals.length - 1;
  let loanId = '';

  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][JLH_COL.ID]).trim() === id) {
      loanId = String(vals[i][JLH_COL.LOAN_ID]);
      sh.deleteRow(i + 1);
      const countAfter = sh.getLastRow() - 1;
      if (countAfter !== countBefore - 1) {
        throw new Error('Failed to delete Jewel Loan history: row count mismatch');
      }

      // Recalculate for the loan
      _jl_recalcPaidAmount(loanId);
      return true;
    }
  }

  throw new Error('Jewel Loan history not found: ' + id);
}

// ─── CASH LOANS CRUD ────────────────────────────────────────────────────────────

// Get all Cash Loan entries
function _cl_getEntries() {
  const sh = _cashLoansSheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];

  return vals.slice(1).map(row => ({
    id: String(row[CL_COL.ID] || ''),
    person_name: String(row[CL_COL.PERSON_NAME] || ''),
    amount_received: Number(row[CL_COL.AMOUNT_RECEIVED]) || 0,
    start_date: _fmtDate(row[CL_COL.START_DATE]),
    paid_amount: Number(row[CL_COL.PAID_AMOUNT]) || 0,
  }));
}

// Add a new Cash Loan entry
function _cl_addEntry(body) {
  const sh = _cashLoansSheet();
  const id = Utilities.getUuid();
  const countBefore = sh.getLastRow();

  sh.appendRow([
    id,
    String(body.person_name || ''),
    Number(body.amount_received) || 0,
    body.start_date || '',
    0, // paid_amount defaults to 0
  ]);

  const countAfter = sh.getLastRow();
  if (countAfter !== countBefore + 1) {
    throw new Error('Failed to add Cash Loan entry: row count mismatch');
  }

  return id;
}

// Update an existing Cash Loan entry
function _cl_updateEntry(body) {
  const sh = _cashLoansSheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][CL_COL.ID]).trim() === id) {
      const targetRow = i + 1;
      sh.getRange(targetRow, 1, 1, CL_HDR.length).setValues([[
        id,
        String(body.person_name || vals[i][CL_COL.PERSON_NAME]),
        Number(body.amount_received !== undefined ? body.amount_received : vals[i][CL_COL.AMOUNT_RECEIVED]),
        body.start_date || vals[i][CL_COL.START_DATE],
        Number(body.paid_amount !== undefined ? body.paid_amount : vals[i][CL_COL.PAID_AMOUNT]),
      ]]);
      return true;
    }
  }

  throw new Error('Cash Loan not found: ' + id);
}

// Delete a Cash Loan entry
function _cl_deleteEntry(body) {
  const sh = _cashLoansSheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();
  const countBefore = vals.length - 1;

  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][CL_COL.ID]).trim() === id) {
      sh.deleteRow(i + 1);
      const countAfter = sh.getLastRow() - 1;
      if (countAfter !== countBefore - 1) {
        throw new Error('Failed to delete Cash Loan entry: row count mismatch');
      }
      return true;
    }
  }

  throw new Error('Cash Loan not found: ' + id);
}

// ─── CASH LOANS HISTORY CRUD ───────────────────────────────────────────────────────

// Get all Cash Loan history entries
function _cl_getHistory(p) {
  const sh = _cashLoansHistorySheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];

  let entries = vals.slice(1).map(row => ({
    id: String(row[CLH_COL.ID] || ''),
    loan_id: String(row[CLH_COL.LOAN_ID] || ''),
    date: _fmtDate(row[CLH_COL.DATE]),
    amount: Number(row[CLH_COL.AMOUNT]) || 0,
    note: String(row[CLH_COL.NOTE] || ''),
  }));

  if (p && p.loan_id) {
    entries = entries.filter(e => e.loan_id === String(p.loan_id));
  }

  return entries;
}

// Helper: Recalculate paid_amount for a cash loan based on history entries
function _cl_recalcPaidAmount(loanId) {
  const histSh = _cashLoansHistorySheet();
  const histVals = histSh.getDataRange().getValues();
  let totalPaid = 0;

  for (let i = 1; i < histVals.length; i++) {
    if (String(histVals[i][CLH_COL.LOAN_ID]).trim() === loanId) {
      totalPaid += Number(histVals[i][CLH_COL.AMOUNT]) || 0;
    }
  }

  const mainSh = _cashLoansSheet();
  const mainVals = mainSh.getDataRange().getValues();

  for (let i = 1; i < mainVals.length; i++) {
    if (String(mainVals[i][CL_COL.ID]).trim() === loanId) {
      mainSh.getRange(i + 1, CL_COL.PAID_AMOUNT + 1).setValue(totalPaid);
      return totalPaid;
    }
  }

  throw new Error('Cash Loan not found for paid_amount recalc: ' + loanId);
}

// Add a new Cash Loan history entry and update paid_amount
function _cl_addHistory(body) {
  const histSh = _cashLoansHistorySheet();
  const id = Utilities.getUuid();
  const countBefore = histSh.getLastRow();

  histSh.appendRow([
    id,
    String(body.loan_id || ''),
    body.date || '',
    Number(body.amount) || 0,
    String(body.note || ''),
  ]);

  const countAfter = histSh.getLastRow();
  if (countAfter !== countBefore + 1) {
    throw new Error('Failed to add Cash Loan history: row count mismatch');
  }

  _cl_recalcPaidAmount(String(body.loan_id));

  return id;
}

// Delete a Cash Loan history entry and recalculate paid_amount
function _cl_deleteHistory(body) {
  const sh = _cashLoansHistorySheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();
  const countBefore = vals.length - 1;
  let loanId = '';

  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][CLH_COL.ID]).trim() === id) {
      loanId = String(vals[i][CLH_COL.LOAN_ID]);
      sh.deleteRow(i + 1);
      const countAfter = sh.getLastRow() - 1;
      if (countAfter !== countBefore - 1) {
        throw new Error('Failed to delete Cash Loan history: row count mismatch');
      }

      _cl_recalcPaidAmount(loanId);
      return true;
    }
  }

  throw new Error('Cash Loan history not found: ' + id);
}

// GET handler router
function _loansHandleGet(action, p) {
  try {
    if (action === 'getEntries') {
      if (p && p.type === 'jewel') return _jl_getEntries();
      if (p && p.type === 'cash') return _cl_getEntries();
      return _loans_getEntries();
    }
    if (action === 'getHistory') {
      if (p && p.type === 'jewel') return _jl_getHistory(p);
      if (p && p.type === 'cash') return _cl_getHistory(p);
      throw new Error('Unknown loans GET action for history');
    }
    throw new Error('Unknown loans GET action: ' + action);
  } catch (e) {
    Logger.log('Loans GET ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

// POST handler router
function _loansHandlePost(action, body) {
  try {
    if (action === 'addEntry') {
      if (body.type === 'jewel') return _jl_addEntry(body);
      if (body.type === 'cash') return _cl_addEntry(body);
      return _loans_addEntry(body);
    }
    if (action === 'updateEntry') {
      if (body.type === 'jewel') return _jl_updateEntry(body);
      if (body.type === 'cash') return _cl_updateEntry(body);
      return _loans_updateEntry(body);
    }
    if (action === 'deleteEntry') {
      if (body.type === 'jewel') return _jl_deleteEntry(body);
      if (body.type === 'cash') return _cl_deleteEntry(body);
      return _loans_deleteEntry(body);
    }
    if (action === 'addHistory') {
      if (body.type === 'jewel') return _jl_addHistory(body);
      if (body.type === 'cash') return _cl_addHistory(body);
      throw new Error('Unknown loans POST action for addHistory');
    }
    if (action === 'updateHistory') {
      if (body.type === 'jewel') return _jl_updateHistory(body);
      throw new Error('Unknown loans POST action for updateHistory');
    }
    if (action === 'deleteHistory') {
      if (body.type === 'jewel') return _jl_deleteHistory(body);
      if (body.type === 'cash') return _cl_deleteHistory(body);
      throw new Error('Unknown loans POST action for deleteHistory');
    }
    throw new Error('Unknown loans POST action: ' + action);
  } catch (e) {
    Logger.log('Loans POST ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

// Get all EMI loan entries
function _loans_getEntries() {
  const sh = _emiLoansSheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return []; // Header only

  return vals.slice(1).map(row => ({
    id: String(row[E_COL.ID] || ''),
    name: String(row[E_COL.NAME] || ''),
    bank: String(row[E_COL.BANK] || ''),
    principal: Number(row[E_COL.PRINCIPAL]) || 0,
    rate: Number(row[E_COL.RATE]) || 0,
    start_date: _fmtDate(row[E_COL.START_DATE]),
    tenure_months: Number(row[E_COL.TENURE_MONTHS]) || 0,
    emi_amount: Number(row[E_COL.EMI_AMOUNT]) || 0,
    paid_emis: Number(row[E_COL.PAID_EMIS]) || 0,
    status: String(row[E_COL.STATUS] || 'Ongoing'),
  }));
}

// Add a new EMI loan entry
function _loans_addEntry(body) {
  const sh = _emiLoansSheet();
  const id = Utilities.getUuid();
  const countBefore = sh.getLastRow();

  sh.appendRow([
    id,
    String(body.name || ''),
    String(body.bank || ''),
    Number(body.principal) || 0,
    Number(body.rate) || 0,
    body.start_date || '',
    Number(body.tenure_months) || 0,
    Number(body.emi_amount) || 0,
    Number(body.paid_emis) || 0,
    body.status || 'Ongoing',
  ]);

  const countAfter = sh.getLastRow();
  if (countAfter !== countBefore + 1) {
    throw new Error('Failed to add EMI entry: row count mismatch');
  }

  return id;
}

// Update an existing EMI loan entry
function _loans_updateEntry(body) {
  const sh = _emiLoansSheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][E_COL.ID]).trim() === id) {
      const targetRow = i + 1; // Sheet rows are 1-indexed
      sh.getRange(targetRow, 1, 1, E_HDR.length).setValues([[
        id,
        String(body.name || vals[i][E_COL.NAME]),
        String(body.bank || vals[i][E_COL.BANK]),
        Number(body.principal !== undefined ? body.principal : vals[i][E_COL.PRINCIPAL]),
        Number(body.rate !== undefined ? body.rate : vals[i][E_COL.RATE]),
        body.start_date || vals[i][E_COL.START_DATE],
        Number(body.tenure_months !== undefined ? body.tenure_months : vals[i][E_COL.TENURE_MONTHS]),
        Number(body.emi_amount !== undefined ? body.emi_amount : vals[i][E_COL.EMI_AMOUNT]),
        Number(body.paid_emis !== undefined ? body.paid_emis : vals[i][E_COL.PAID_EMIS]),
        String(body.status || vals[i][E_COL.STATUS]),
      ]]);
      return true;
    }
  }

  throw new Error('EMI loan not found: ' + id);
}

// Delete an EMI loan entry
function _loans_deleteEntry(body) {
  const sh = _emiLoansSheet();
  const vals = sh.getDataRange().getValues();
  const id = String(body.id).trim();
  const countBefore = vals.length - 1; // Exclude header

  // Delete backwards to avoid index shifting
  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][E_COL.ID]).trim() === id) {
      sh.deleteRow(i + 1); // Sheet rows are 1-indexed
      const countAfter = sh.getLastRow() - 1; // Exclude header
      if (countAfter !== countBefore - 1) {
        throw new Error('Failed to delete EMI entry: row count mismatch');
      }
      return true;
    }
  }

  throw new Error('EMI loan not found: ' + id);
}

// Calculate expected paid EMIs based on start date
function _expectedPaidEmis(startDateStr) {
  try {
    const start = new Date(startDateStr);
    const now = new Date();
    const yearDiff = now.getFullYear() - start.getFullYear();
    const monthDiff = now.getMonth() - start.getMonth();
    const dayAdjust = now.getDate() >= start.getDate() ? 0 : -1;
    return yearDiff * 12 + monthDiff + dayAdjust;
  } catch (e) {
    Logger.log('Error parsing date ' + startDateStr + ': ' + e.message);
    return 0;
  }
}

// Auto-increment EMI paid counts based on months elapsed
function _loans_autoIncrementEMIs() {
  try {
    const sh = _emiLoansSheet();
    const vals = sh.getDataRange().getValues();
    let updatedCount = 0;
    let closedCount = 0;

    for (let i = 1; i < vals.length; i++) {
      const status = String(vals[i][E_COL.STATUS] || 'Ongoing').trim();

      // Only process ongoing loans
      if (status !== 'Ongoing') continue;

      const startDate = vals[i][E_COL.START_DATE];
      const currentPaid = Number(vals[i][E_COL.PAID_EMIS]) || 0;
      const tenureMonths = Number(vals[i][E_COL.TENURE_MONTHS]) || 0;

      const expectedPaid = Math.min(_expectedPaidEmis(startDate), tenureMonths);
      const newPaid = Math.max(currentPaid, expectedPaid); // Never decrement

      let needsUpdate = false;
      let newStatus = status;

      // Update paid_emis if it increased
      if (newPaid !== currentPaid) {
        needsUpdate = true;
      }

      // Check if loan should be closed
      if (newPaid >= tenureMonths && status === 'Ongoing') {
        newStatus = 'Closed';
        needsUpdate = true;
        closedCount++;
      }

      // Update the row if needed
      if (needsUpdate) {
        sh.getRange(i + 1, E_COL.PAID_EMIS + 1).setValue(newPaid);
        sh.getRange(i + 1, E_COL.STATUS + 1).setValue(newStatus);
        updatedCount++;
      }
    }

    Logger.log('EMI Auto-Increment Summary: Updated ' + updatedCount + ' loans, Closed ' + closedCount + ' loans');
    return { updated: updatedCount, closed: closedCount };
  } catch (e) {
    Logger.log('EMI Auto-Increment ERROR: ' + e.message + ' | Stack: ' + e.stack);
    throw e;
  }
}

// Setup monthly trigger for auto-increment (run once from GAS editor)
function setupLoansTrigger() {
  // Remove existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === '_loans_autoIncrementEMIs')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Install new monthly trigger (runs on 1st of each month at 8 AM)
  ScriptApp.newTrigger('_loans_autoIncrementEMIs')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  Logger.log('EMI Loans trigger installed: Runs on 1st of each month at 8 AM');
}
