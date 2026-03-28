/**
 * FinTracker – Google Apps Script Backend
 *
 * SETUP (one-time):
 *  1. Open your Google Sheet (the spreadsheet that will store your data)
 *  2. Extensions → Apps Script  (this binds the script to the spreadsheet)
 *  3. Delete any default code. Create two files:
 *       Code.gs  ← this file
 *       Index    ← create via File > New > HTML file, name it "Index" (no .html)
 *  4. Paste Index.html content into the Index file
 *  5. Deploy → New deployment → Type: Web app
 *       Execute as : Me
 *       Who has access : Anyone with Google account  (or Anyone)
 *  6. Click Deploy → Authorize → Copy the /exec URL
 *  7. Open the URL in your browser – that's your app!
 *
 *  Every time you redeploy (after code changes) click "New deployment" again
 *  and update the URL.
 */

// ── COLUMN INDEX MAP ─────────────────────────────────────────────────────────
const COL   = { ID:0, DATE:1, DESC:2, AMT:3, CAT:4, TYPE:5, MODE:6, NOTES:7 };
const HDR   = ['ID','Date','Description','Amount','Category','Type','Mode','Notes'];
const B_TAB = 'Budget';
const MNS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const M_RX  = /^([A-Za-z]{3})-(\d{4})$/;

// Sheet theme colours
const C_HDR_BG   = '#1E1B4B';   // dark navy header
const C_HDR_FG   = '#FFFFFF';
const C_INC_BG   = '#F0FDF4';   // soft green row  — Income
const C_INC_FG   = '#166534';
const C_EXP_BG   = '#FEF2F2';   // soft red row    — Expense
const C_EXP_FG   = '#991B1B';
const C_TRF_BG   = '#EFF6FF';   // soft blue row   — Transfer
const C_TRF_FG   = '#1D4ED8';
const C_SAV_BG   = '#FFFBEB';   // soft amber row  — Savings
const C_SAV_FG   = '#92400E';

// ── ENTRY POINTS ──────────────────────────────────────────────────────────────
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    try {
      const traceId = e.parameter.traceId;
      const debug = e.parameter.debug === 'true';
      if (debug && traceId) Logger.log('TRACE:' + traceId);
      _checkToken(e.parameter.token);
      const result = _handleGet(e.parameter);
      const debugInfo = debug ? { action: e.parameter.action, module: e.parameter.module } : undefined;
      return _apiJson(result, false, debugInfo, traceId);
    } catch(err) {
      if (e?.parameter?.traceId && e.parameter.debug === 'true') Logger.log('TRACE error:' + e.parameter.traceId);
      return _apiJson(err.message, true, undefined, e?.parameter?.traceId);
    }
  }
  return _apiJson({ message: 'FinTracker API — use the React app at https://aruncse-dev.github.io/fintracker/' });
}

function doPost(e) {
  let traceId;
  try {
    const contents = e.postData.contents || '{}';
    const body = JSON.parse(contents);
    traceId = body.traceId;
    const debug = body.debug === true;
    if (debug && traceId) Logger.log('TRACE:' + traceId);
    _checkToken(body.token);
    const result = _handlePost(body);
    const debugInfo = debug ? { action: body.action, module: body.module } : undefined;
    return _apiJson(result, false, debugInfo, traceId);
  } catch(err) {
    if (traceId) Logger.log('TRACE error:' + traceId);
    return _apiJson(err.message, true, undefined, traceId);
  }
}

function _checkToken(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (expected && token !== expected) throw new Error('Unauthorized');
}

// Called by deploy.sh / GitHub Actions via `clasp run` to set the API token
function setApiToken(token) {
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  return 'API_TOKEN set';
}

// Run once in the Apps Script editor to store your Gemini key securely:
//   setGeminiKey('AIzaSy...')
function setGeminiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', key);
  return 'GEMINI_KEY set';
}

function setExpensesSheetId(id) {
  PropertiesService.getScriptProperties().setProperty('EXPENSES_SHEET_ID', id);
  return 'EXPENSES_SHEET_ID set';
}

function _configure(expensesSheetId, assetsSheetId) {
  if (!expensesSheetId) throw new Error('expensesSheetId is required');
  PropertiesService.getScriptProperties().setProperty('EXPENSES_SHEET_ID', expensesSheetId);
  if (assetsSheetId) {
    PropertiesService.getScriptProperties().setProperty('ASSETS_SHEET_ID', assetsSheetId);
  }
  return true;
}


function _apiJson(data, isError, debug, traceId) {
  const payload = isError ? { ok: false, error: data } : { ok: true, data: data };
  if (traceId) payload.traceId = traceId;
  if (debug) payload.debug = debug;
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function _handleGet(p) {
  Logger.log('_handleGet module: ' + (p.module || 'UNDEFINED') + ', action: ' + (p.action || 'UNDEFINED'));
  if (p.module === 'lending') {
    Logger.log('_handleGet: routing to lending handler for action=' + p.action);
    return _lendingHandleGet(p.action);
  }
  if (p.module === 'savings') {
    Logger.log('_handleGet: routing to savings handler for action=' + p.action);
    return _savingsHandleGet(p.action);
  }
  const action = p.action;
  if (action === 'init') return {
    months:     getMonths(),
    budget:     getBudget(),
    openingBal: getAccountOpeningBalances()
  };
  if (action === 'getMonths')          return getMonths();
  if (action === 'getData')            return getData(p.month, p.year);
  if (action === 'getBudget')          return getBudget();
  if (action === 'getOpeningBalances') return getAccountOpeningBalances();
  throw new Error('Unknown GET action: ' + action);
}

function _handlePost(body) {
  Logger.log('_handlePost module: ' + (body.module || 'UNDEFINED') + ', action: ' + (body.action || 'UNDEFINED'));
  if (body.module === 'lending') {
    Logger.log('_handlePost: routing to lending handler for action=' + body.action);
    return _lendingHandlePost(body.action, body);
  }
  if (body.module === 'savings') {
    Logger.log('_handlePost: routing to savings handler for action=' + body.action);
    return _savingsHandlePost(body.action, body);
  }
  const action = body.action;
  if (action === 'addRow')
    return addRow(body.month, body.year, body.date, body.desc, body.a, body.c, body.t, body.m, body.notes);
  if (action === 'updateRow')
    return updateRow(body.month, body.year, body.id, body.date, body.desc, body.a, body.c, body.t, body.m, body.notes);
  if (action === 'deleteRow')
    return deleteRow(body.month, body.year, body.id);
  if (action === 'saveBudget')
    return saveBudget(body.budgets);
  if (action === 'updateBudgetEntry')
    return updateBudgetEntry(body.cat, body.amt);
  if (action === 'deleteBudgetEntry')
    return deleteBudgetEntry(body.cat);
  if (action === 'saveOpeningBal')
    return saveAccountOpeningBalances(body.data);
  if (action === 'ensureMonth')
    return ensureMonth(body.month, body.year);
  if (action === 'resetBudget')
    return saveBudget(_defaultBudgets()) && _defaultBudgets();
  if (action === 'configure')
    return _configure(body.expensesSheetId, body.assetsSheetId);
  if (action === 'gemini')
    return _geminiProxy(body.system, body.prompt, body.forceTool === true);
  throw new Error('Unknown POST action: ' + action);
}

// ── PRIVATE SHEET HELPERS ─────────────────────────────────────────────────────
function _ss() {
  const id = PropertiesService.getScriptProperties().getProperty('EXPENSES_SHEET_ID');
  if (!id) throw new Error('EXPENSES_SHEET_ID not configured. Run setExpensesSheetId("your-sheet-id") in the Apps Script editor.');
  return SpreadsheetApp.openById(id);
}
function _name(m, y)  { return m + '-' + y; }

function _styleHeader(sh, numCols) {
  const hdr = sh.getRange(1, 1, 1, numCols);
  hdr.setFontWeight('bold')
     .setBackground(C_HDR_BG)
     .setFontColor(C_HDR_FG)
     .setFontSize(11)
     .setFontFamily('Arial')
     .setHorizontalAlignment('center')
     .setVerticalAlignment('middle');
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);
}

function _getOrCreate(name, headers) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers && headers.length) {
      sh.appendRow(headers);
      _styleHeader(sh, headers.length);
      try {
        sh.getRange(2, 1, 999, headers.length)
          .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
      } catch(e) {}
    }
  }
  return sh;
}

function _fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd-MMM-yy');
  return String(v);
}

// ── SHEET FORMATTING: apply column widths + number format to a month sheet ───
function _formatMonthSheet(sh) {
  // Column widths: ID(hidden), Date, Description, Amount, Category, Type, Mode, Notes
  const widths = [0, 90, 260, 110, 140, 90, 110, 180];
  widths.forEach((w, i) => { if (w > 0) sh.setColumnWidth(i + 1, w); });

  // Amount column: Indian currency format
  sh.getRange(2, COL.AMT + 1, 999, 1)
    .setNumberFormat('₹#,##,##0.00');

  // Date column: consistent date format
  sh.getRange(2, COL.DATE + 1, 999, 1)
    .setNumberFormat('dd-mmm-yy');

  // Description: left-align, wrap
  sh.getRange(2, COL.DESC + 1, 999, 1)
    .setHorizontalAlignment('left')
    .setWrap(true);

  // Amount: right-align
  sh.getRange(2, COL.AMT + 1, 999, 1)
    .setHorizontalAlignment('right');

  // Centre-align: Date, Category, Type, Mode
  [COL.DATE, COL.CAT, COL.TYPE, COL.MODE].forEach(c => {
    sh.getRange(2, c + 1, 999, 1).setHorizontalAlignment('center');
  });

  sh.setRowHeightsForced(2, 999, 24);
}

// ── SHEET FORMATTING: colour-code rows by transaction type ───────────────────
function _colorRows(sh, vals) {
  for (let i = 1; i < vals.length; i++) {
    const type = String(vals[i][COL.TYPE] || '');
    let bg, fg;
    if (type === 'Income')   { bg = C_INC_BG; fg = C_INC_FG; }
    else if (type === 'Transfer') { bg = C_TRF_BG; fg = C_TRF_FG; }
    else if (type === 'Savings')  { bg = C_SAV_BG; fg = C_SAV_FG; }
    else                          { bg = C_EXP_BG; fg = C_EXP_FG; }

    const row = sh.getRange(i + 1, 2, 1, 7); // cols 2-8 (skip hidden ID)
    row.setBackground(bg).setFontColor(fg);

    // Bold the amount
    sh.getRange(i + 1, COL.AMT + 1).setFontWeight('bold');
  }
}

// ── PUBLIC: MONTH MANAGEMENT ──────────────────────────────────────────────────
function getMonths() {
  return _ss().getSheets()
    .map(sh => sh.getName())
    .filter(n => M_RX.test(n))
    .map(n => { const [, m, y] = n.match(M_RX); return { month: m, year: y }; })
    .sort((a, b) => {
      const yd = parseInt(b.year) - parseInt(a.year);
      return yd !== 0 ? yd : MNS.indexOf(b.month) - MNS.indexOf(a.month);
    });
}

function ensureMonth(month, year) {
  const sh = _getOrCreate(_name(month, year), HDR);
  try { sh.hideColumns(1); } catch(e) {}
  _formatMonthSheet(sh);
  return true;
}

// ── PUBLIC: TRANSACTIONS ──────────────────────────────────────────────────────
function getData(month, year) {
  const sh = _ss().getSheetByName(_name(month, year));
  if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  return vals.slice(1)
    .filter(r => r[COL.DESC])
    .map(r => ({
      id:    String(r[COL.ID]    || ''),
      date:  _fmtDate(r[COL.DATE]),
      desc:  String(r[COL.DESC]  || ''),
      a:     parseFloat(r[COL.AMT])  || 0,
      c:     String(r[COL.CAT]   || ''),
      t:     String(r[COL.TYPE]  || ''),
      m:     String(r[COL.MODE]  || ''),
      notes: String(r[COL.NOTES] || '')
    }));
}

function addRow(month, year, date, desc, a, c, t, m, notes) {
  ensureMonth(month, year);
  const sh  = _ss().getSheetByName(_name(month, year));
  const id  = Utilities.getUuid();
  sh.appendRow([id, date, desc, parseFloat(a) || 0, c, t, m, notes || '']);
  // Colour the new row
  const lastRow = sh.getLastRow();
  const type = String(t || '');
  let bg, fg;
  if (type === 'Income')    { bg = C_INC_BG; fg = C_INC_FG; }
  else if (type === 'Transfer') { bg = C_TRF_BG; fg = C_TRF_FG; }
  else if (type === 'Savings')  { bg = C_SAV_BG; fg = C_SAV_FG; }
  else                          { bg = C_EXP_BG; fg = C_EXP_FG; }
  sh.getRange(lastRow, 2, 1, 7).setBackground(bg).setFontColor(fg);
  sh.getRange(lastRow, COL.AMT + 1).setFontWeight('bold');
  return id;
}

function updateRow(month, year, id, date, desc, a, c, t, m, notes) {
  const sh = _ss().getSheetByName(_name(month, year));
  if (!sh) throw new Error('Sheet not found: ' + _name(month, year));
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][COL.ID]) === String(id)) {
      sh.getRange(i + 1, 1, 1, 8)
        .setValues([[id, date, desc, parseFloat(a) || 0, c, t, m, notes || '']]);
      // Re-colour updated row
      const type = String(t || '');
      let bg, fg;
      if (type === 'Income')    { bg = C_INC_BG; fg = C_INC_FG; }
      else if (type === 'Transfer') { bg = C_TRF_BG; fg = C_TRF_FG; }
      else if (type === 'Savings')  { bg = C_SAV_BG; fg = C_SAV_FG; }
      else                          { bg = C_EXP_BG; fg = C_EXP_FG; }
      sh.getRange(i + 1, 2, 1, 7).setBackground(bg).setFontColor(fg);
      sh.getRange(i + 1, COL.AMT + 1).setFontWeight('bold');
      return true;
    }
  }
  throw new Error('Row not found: ' + id);
}

function deleteRow(month, year, id) {
  const sh = _ss().getSheetByName(_name(month, year));
  if (!sh) throw new Error('Sheet not found: ' + _name(month, year));
  const vals = sh.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][COL.ID]) === String(id)) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  throw new Error('Row not found: ' + id);
}

// ── PUBLIC: BUDGET ────────────────────────────────────────────────────────────
function getBudget() {
  const sh   = _getOrCreate(B_TAB, ['Category', 'Budget']);
  const vals = sh.getDataRange().getValues();
  const out  = {};
  vals.slice(1).forEach(r => { if (r[0]) out[String(r[0])] = parseFloat(r[1]) || 0; });
  if (!Object.keys(out).length) {
    const def = _defaultBudgets();
    saveBudget(def);
    return def;
  }
  return out;
}

function saveBudget(budgets) {
  const sh = _getOrCreate(B_TAB, ['Category', 'Budget']);

  // Safety guard: refuse to overwrite a larger existing budget with suspiciously
  // few entries — this prevents partial-state saves from wiping real data.
  const existing = sh.getLastRow() - 1; // subtract header row
  const incoming = Object.keys(budgets).length;
  if (existing > 5 && incoming < existing * 0.5) {
    throw new Error(
      'Save blocked: incoming budget has ' + incoming + ' entries but sheet has ' +
      existing + '. Reload the app and try again.'
    );
  }

  sh.clearContents();
  sh.appendRow(['Category', 'Budget']);
  _styleHeader(sh, 2);
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 130);
  const rows = Object.entries(budgets);
  rows.forEach(([cat, amt]) => sh.appendRow([cat, parseFloat(amt) || 0]));
  if (rows.length) {
    sh.getRange(2, 2, rows.length, 1).setNumberFormat('₹#,##,##0.00').setHorizontalAlignment('right');
    sh.getRange(2, 1, rows.length, 1).setHorizontalAlignment('left');
    sh.setRowHeightsForced(2, rows.length, 24);
  }
  return true;
}

// Update or insert a single budget row by category name — never clears the sheet.
function updateBudgetEntry(cat, amt) {
  const sh = _getOrCreate(B_TAB, ['Category', 'Budget']);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(cat)) {
      sh.getRange(i + 1, 2).setValue(parseFloat(amt) || 0)
        .setNumberFormat('₹#,##,##0.00').setHorizontalAlignment('right');
      return true;
    }
  }
  // Not found — append a new row
  sh.appendRow([cat, parseFloat(amt) || 0]);
  const r = sh.getLastRow();
  sh.getRange(r, 2).setNumberFormat('₹#,##,##0.00').setHorizontalAlignment('right');
  sh.getRange(r, 1).setHorizontalAlignment('left');
  sh.setRowHeightsForced(r, 1, 24);
  return true;
}

// Delete a single budget row by category name — never touches other rows.
function deleteBudgetEntry(cat) {
  const sh = _getOrCreate(B_TAB, ['Category', 'Budget']);
  const vals = sh.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][0]) === String(cat)) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  throw new Error('Budget category not found: ' + cat);
}

// ── PUBLIC: ACCOUNT OPENING BALANCES ─────────────────────────────────────────
const ACCT_NAMES = ['Cash', 'HDFC Bank', 'Wallet'];
const A_ACC_TAB  = 'Accounts';

function getAccountOpeningBalances() {
  const sh   = _getOrCreate(A_ACC_TAB, ['Account', 'Opening Balance']);
  const vals = sh.getDataRange().getValues();
  const out  = {};
  ACCT_NAMES.forEach(a => out[a] = 0);
  vals.slice(1).forEach(r => { if (r[0]) out[String(r[0])] = parseFloat(r[1]) || 0; });
  if (vals.length < 2) { saveAccountOpeningBalances(out); }
  return out;
}

function saveAccountOpeningBalances(data) {
  const sh = _getOrCreate(A_ACC_TAB, ['Account', 'Opening Balance']);
  sh.clearContents();
  sh.appendRow(['Account', 'Opening Balance']);
  _styleHeader(sh, 2);
  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 150);
  ACCT_NAMES.forEach(a => sh.appendRow([a, parseFloat(data[a]) || 0]));
  sh.getRange(2, 2, ACCT_NAMES.length, 1).setNumberFormat('₹#,##,##0.00').setHorizontalAlignment('right');
  sh.getRange(2, 1, ACCT_NAMES.length, 1).setHorizontalAlignment('left');
  sh.setRowHeightsForced(2, ACCT_NAMES.length, 24);
  return true;
}

// ── AI PROXY (Groq — llama-3.1-8b-instant, Tool Calling) ─────────────────────
function setGroqKey(key) {
  PropertiesService.getScriptProperties().setProperty('GROQ_KEY', key);
  return 'GROQ_KEY set';
}

function _geminiProxy(system, prompt, forceTool) {
  const key = PropertiesService.getScriptProperties().getProperty('GROQ_KEY');
  if (!key) throw new Error('GROQ_KEY not set. Run setGroqKey("your-key") in the Apps Script editor.');

  const EXPENSE_CATS = ['Long Term Loan','Jewel Loan','Insurance','SIP/Savings','Emergency Fund',
    'Rent','Vijaya Amma','Staff Salary','Groceries','Milk','Vegetables','Fruits','Food/Eating Out',
    'Snacks','Meat','Education','Kids','Health & Medical','Amma','Body Care','Dress','Entertainment',
    'Travel','Gifts/Functions','Home Care','Maintenance','Internet/Recharge','Electricity',
    'Cylinder','Car','Daily Expenses','NGO','Others'];
  const INCOME_CATS = ['Salary','Cashback','Other Income'];
  const ALL_CATS = EXPENSE_CATS.concat(INCOME_CATS);

  // forceTool=true → user is recording a transaction (add_transaction, required)
  // forceTool=false → user is querying/analysing (list_transactions, auto)
  const tools = forceTool ? [{
    type: 'function',
    function: {
      name: 'add_transaction',
      description: 'Add a financial transaction. Called when user gives an amount and description.',
      parameters: {
        type: 'object',
        properties: {
          amt:        { type: 'number', description: 'Amount in INR. Required.' },
          desc:       { type: 'string', description: 'Vendor, place or item name (e.g. "Auto", "A1 Mart", "Swiggy"). If no specific vendor/place is mentioned, use the category name itself.' },
          cat:        { type: 'string', description: 'Expense/Transfer category', enum: EXPENSE_CATS },
          income_cat: { type: 'string', description: 'Income category', enum: INCOME_CATS },
          type:       { type: 'string', enum: ['Expense','Income','Transfer'], description: 'Income if money received; Transfer if moving between accounts; else Expense.' },
          mode:       { type: 'string', enum: ['Cash','HDFC Bank','Wallet','ICICI','HDFC','Bommi','Ramya','Others'],
                        description: 'Payment method. cash/hand → Cash; icici/icici card → ICICI; hdfc card/hdfc cc → HDFC; hdfc bank/hdfc debit/hdfcbank → HDFC Bank; gpay/phonepay/paytm/upi/wallet → Wallet. Default: Cash.' }
        },
        required: ['amt', 'desc', 'type', 'mode']
      }
    }
  }] : [{
    type: 'function',
    function: {
      name: 'list_transactions',
      description: 'List transactions for the current month filtered by category or type.',
      parameters: {
        type: 'object',
        properties: {
          cat:   { type: 'string', description: 'Filter by category name', enum: ALL_CATS },
          type:  { type: 'string', enum: ['Expense','Income','Transfer'], description: 'Filter by type' },
          limit: { type: 'number', description: 'Max rows to return (default 10, max 50)' }
        }
      }
    }
  }];

  const res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: prompt }
      ],
      tools: tools,
      tool_choice: forceTool ? 'required' : 'auto',
      max_tokens: 400,
      temperature: forceTool ? 0.1 : 0.3
    }),
    muteHttpExceptions: true
  });

  const json = JSON.parse(res.getContentText());
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));

  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error('No response from AI');

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc   = msg.tool_calls[0];
    const args = JSON.parse(tc.function.arguments);

    if (tc.function.name === 'add_transaction') {
      const cat = args.type === 'Income' ? (args.income_cat || 'Other Income') : (args.cat || 'Others');
      return JSON.stringify({ __tool: 'add_transaction', amt: args.amt, desc: args.desc, cat, type: args.type, mode: args.mode || 'Cash' });
    }

    if (tc.function.name === 'list_transactions') {
      return JSON.stringify({ __tool: 'list_transactions', cat: args.cat || '', type: args.type || '', limit: args.limit || 10 });
    }
  }

  return msg.content || '';
}

// ── DEFAULTS ──────────────────────────────────────────────────────────────────
// Budget plan for ₹2,38,000 income
function _defaultBudgets() {
  return {
    // ── FIXED ─────────────────────────────────────────────────────────────────
    'Jewel Loan':30000, 'Long Term Loan':56000,
    'Insurance':9700,
    'SIP/Savings':11500, 'Rent':5500,
    'Vijaya Amma':6500, 'Staff Salary':18000, 'Internet/Recharge':1900,
    // ── VARIABLE ──────────────────────────────────────────────────────────────
    'Emergency Fund':6000,
    // Food
    'Groceries':18000, 'Milk':6000, 'Vegetables':3500, 'Fruits':2000,
    'Food/Eating Out':3500, 'Snacks':1500, 'Meat':4000,
    // Family
    'Education':6500, 'Kids':3000, 'Health & Medical':4500, 'Amma':5000,
    // Personal
    'Body Care':3000, 'Dress':2000,
    // Lifestyle
    'Entertainment':1500, 'Travel':4500, 'Gifts/Functions':2000, 'Home Care':3500, 'Maintenance':3000,
    // Utilities
    'Electricity':3500, 'Cylinder':2000, 'Car':2000, 'Daily Expenses':2500,
    // Buffer
    'Others':5000,
  };
}

