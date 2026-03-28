/**
 * Portfolio sync for Stocks & Mutual Funds via Upstox API
 * Static token mode — no OAuth, user provides access token directly
 */

const UPSTOX_API_BASE = 'https://api.upstox.com/v2';

// ===== TEST FUNCTION — Run this in Apps Script editor to verify token =====
function testUpstoxToken() {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('UPSTOX_ACCESS_TOKEN');

    Logger.log('=== UPSTOX TOKEN TEST ===');
    Logger.log('Token exists: ' + !!token);
    Logger.log('Token length: ' + (token ? token.length : 'N/A'));
    Logger.log('Token (first 50 chars): ' + (token ? token.substring(0, 50) : 'NO TOKEN'));

    if (!token) {
      Logger.log('ERROR: No token found in Script Properties');
      return;
    }

    // Test API call
    const url = UPSTOX_API_BASE + '/portfolio/long-term-holdings';
    Logger.log('Calling API: ' + url);

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('Response code: ' + responseCode);
    Logger.log('Response text: ' + responseText);

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      Logger.log('SUCCESS! Found ' + (data.data ? data.data.length : 0) + ' holdings');
      Logger.log('Response: ' + JSON.stringify(data, null, 2));
    } else if (responseCode === 401) {
      Logger.log('FAILED: Token is expired or invalid (401 Unauthorized)');
    } else {
      Logger.log('FAILED: API returned ' + responseCode);
    }
  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
  }
}

// ===== Public handlers (called from Code.gs) =====

function _portfolioHandleGet(module, action) {
  if (action === 'getHoldings') {
    return _portfolio_getHoldings(module);
  } else if (action === 'getTokenStatus') {
    return _portfolio_getTokenStatus();
  } else if (action === 'getAuthUrl') {
    return _upstox_getAuthUrl();
  }
  throw new Error(`Unknown action: ${action}`);
}

function _portfolioHandlePost(module, action, body) {
  if (action === 'sync') {
    return _portfolio_sync(module);
  } else if (action === 'setToken') {
    return _portfolio_setToken(body.token);
  }
  throw new Error(`Unknown action: ${action}`);
}

// ===== OAuth & Token Management =====

function setUpstoxCredentials(clientId, clientSecret) {
  PropertiesService.getScriptProperties().setProperty('UPSTOX_CLIENT_ID', clientId);
  PropertiesService.getScriptProperties().setProperty('UPSTOX_CLIENT_SECRET', clientSecret);
  return 'Upstox OAuth credentials set';
}

function _upstox_getAuthUrl() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('UPSTOX_CLIENT_ID');
  if (!clientId) {
    throw new Error('UPSTOX_CLIENT_ID not configured');
  }
  const redirectUri = ScriptApp.getService().getUrl();
  const authUrl = 'https://api.upstox.com/v2/login/authorization/dialog' +
    '?response_type=code' +
    '&client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri);
  return { authUrl: authUrl };
}

function _upstox_exchangeCode(code) {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('UPSTOX_CLIENT_ID');
  const clientSecret = props.getProperty('UPSTOX_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('UPSTOX_CLIENT_ID or UPSTOX_CLIENT_SECRET not configured');
  }

  const redirectUri = ScriptApp.getService().getUrl();
  const response = UrlFetchApp.fetch('https://api.upstox.com/v2/login/authorization/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    },
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  Logger.log('OAuth token exchange response: ' + responseCode);

  if (responseCode !== 200) {
    Logger.log('OAuth error response: ' + responseText);
    throw new Error('OAuth token exchange failed: ' + responseCode + ' ' + responseText);
  }

  const result = JSON.parse(responseText);
  if (result.access_token) {
    props.setProperty('UPSTOX_ACCESS_TOKEN', result.access_token);
    Logger.log('Upstox token stored successfully');
    _ensureDailySyncTrigger();
    return true;
  } else {
    throw new Error('No access_token in OAuth response');
  }
}

function _ensureDailySyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'portfolioSyncStocks') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing portfolioSyncStocks trigger');
    }
  });

  ScriptApp.newTrigger('portfolioSyncStocks')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('Created new daily portfolioSyncStocks trigger at 9 AM');
}

function portfolioSyncStocks() {
  try {
    Logger.log('Daily stocks sync started');
    _portfolio_sync('stocks');
    Logger.log('Daily stocks sync completed successfully');
  } catch(e) {
    Logger.log('Daily stocks sync failed: ' + e.toString());
  }
}

function _upstox_getToken() {
  // Try both Script Properties and User Properties (fallback)
  let token = PropertiesService.getScriptProperties().getProperty('UPSTOX_ACCESS_TOKEN');
  if (!token) {
    token = PropertiesService.getUserProperties().getProperty('UPSTOX_ACCESS_TOKEN');
  }
  if (!token) {
    throw new Error('TOKEN_NOT_SET');
  }
  return token;
}

// ===== API calls =====

function _upstox_fetchHoldings(token) {
  const url = UPSTOX_API_BASE + '/portfolio/long-term-holdings';

  // Log for debugging (remove later)
  Logger.log('Fetching from URL: ' + url);
  Logger.log('Token length: ' + token.length);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  Logger.log('Response code: ' + responseCode);

  if (responseCode === 401) {
    throw new Error('TOKEN_EXPIRED');
  }

  if (responseCode !== 200) {
    const errorText = response.getContentText();
    Logger.log('Error response: ' + errorText);
    throw new Error('Upstox API error: ' + responseCode + ' ' + errorText);
  }

  const result = JSON.parse(response.getContentText());
  Logger.log('API response status: ' + result.status);

  if (result.status !== 'success') {
    throw new Error('API error: ' + (result.errors ? result.errors[0] : 'unknown'));
  }

  return result.data || [];
}

function _upstox_splitHoldings(data) {
  const stocks = [];
  const mfs = [];

  data.forEach(function(holding) {
    const instrumentToken = holding.instrument_token || '';
    const row = [
      holding.tradingsymbol || '',
      holding.company_name || '',
      holding.isin || '',
      parseFloat(holding.quantity) || 0,
      parseFloat(holding.average_price) || 0,
      parseFloat(holding.last_price) || 0,
      parseFloat(holding.pnl) || 0,
      parseFloat(holding.day_change_percent) || 0,
      new Date()
    ];

    if (instrumentToken.indexOf('NSE_EQ|') === 0 || instrumentToken.indexOf('BSE_EQ|') === 0) {
      stocks.push(row);
    } else if (instrumentToken.indexOf('NSE_MF|') === 0 || instrumentToken.indexOf('BSE_MF|') === 0) {
      mfs.push(row);
    }
  });

  return { stocks: stocks, mfs: mfs };
}

// ===== Sheet operations =====

function _parseCurrencyNum(val) {
  // Handle ₹ prefix and commas in currency strings
  if (typeof val === 'string') {
    // Remove ₹ and commas, then parse
    const cleaned = val.replace(/₹/g, '').replace(/,/g, '').trim();
    return parseFloat(cleaned) || 0;
  }
  return parseFloat(val) || 0;
}

function _portfolio_ensureSheet(sheetName) {
  const ss = SpreadsheetApp.openById(_getSpreadsheetId('ASSETS_SHEET_ID'));
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    if (sheetName === 'Stocks') {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Symbol', 'Company', 'ISIN', 'Qty', 'AvgPrice', 'LastPrice', 'PnL', 'DayChg%', 'Synced']);
    } else if (sheetName === 'MutualFunds') {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['FundName', 'FolioNo', 'Units', 'Purchased', 'CurrentValue', 'ProfitLoss', 'SchemeCode']);
    }
  }

  return sheet;
}

function _portfolio_writeHoldings(sheetName, rows) {
  const sheet = _portfolio_ensureSheet(sheetName);

  // Clear existing data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  // Write new rows
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  return rows.length;
}

function _portfolio_readHoldings(sheetName) {
  const sheet = _portfolio_ensureSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  const rows = [];

  if (sheetName === 'Stocks') {
    // Upstox-synced Stocks format: [Symbol, Company, ISIN, Qty, AvgPrice, LastPrice, PnL, DayChg%, Synced]
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      rows.push({
        symbol: String(row[0]),
        company: String(row[1]),
        isin: String(row[2]),
        qty: parseFloat(row[3]) || 0,
        avgPrice: parseFloat(row[4]) || 0,
        lastPrice: parseFloat(row[5]) || 0,
        pnl: parseFloat(row[6]) || 0,
        dayChangePct: parseFloat(row[7]) || 0,
        synced: String(row[8])
      });
    }
  } else if (sheetName === 'MutualFunds') {
    // Manual sheet format: [FundName, FolioNo, Units, Purchased, CurrentValue, ProfitLoss, SchemeCode]
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const units = parseFloat(row[2]) || 0;
      const purchased = _parseCurrencyNum(row[3]);
      const current = _parseCurrencyNum(row[4]);
      const pnl = _parseCurrencyNum(row[5]);

      rows.push({
        symbol: String(row[6]),           // SchemeCode
        company: String(row[0]),          // FundName
        isin: String(row[1]),             // FolioNo
        qty: units,                       // Units
        avgPrice: units > 0 ? purchased / units : 0,  // Purchased / Units
        lastPrice: units > 0 ? current / units : 0,   // Current / Units
        pnl: pnl,
        dayChangePct: 0,                  // Not available in manual sheet
        synced: ''
      });
    }
  }

  return rows;
}

// ===== Public actions =====

function _portfolio_getHoldings(module) {
  if (module === 'stocks') {
    return _portfolio_readHoldings('Stocks');
  } else if (module === 'mutualfunds') {
    return _portfolio_readHoldings('MutualFunds');
  }
  throw new Error('Unknown module: ' + module);
}

function _portfolio_sync(module) {
  try {
    if (module === 'stocks') {
      const token = _upstox_getToken();
      const holdings = _upstox_fetchHoldings(token);
      const split = _upstox_splitHoldings(holdings);
      const count = _portfolio_writeHoldings('Stocks', split.stocks);
      return { count: count };
    } else if (module === 'mutualfunds') {
      throw new Error('MutualFunds must be updated manually. Sync is not supported for MF.');
    } else {
      throw new Error('Unknown module: ' + module);
    }
  } catch (e) {
    const errorMsg = e.toString();
    if (errorMsg.indexOf('TOKEN_EXPIRED') >= 0 || errorMsg.indexOf('401') >= 0) {
      throw new Error('TOKEN_EXPIRED');
    } else if (errorMsg.indexOf('TOKEN_NOT_SET') >= 0) {
      throw new Error('TOKEN_NOT_SET');
    }
    throw e;
  }
}

function _portfolio_getTokenStatus() {
  // Check both Script Properties and User Properties
  let token = PropertiesService.getScriptProperties().getProperty('UPSTOX_ACCESS_TOKEN');
  if (!token) {
    token = PropertiesService.getUserProperties().getProperty('UPSTOX_ACCESS_TOKEN');
  }
  return { hasToken: !!token };
}

function _portfolio_setToken(token) {
  if (!token || !String(token).trim()) {
    throw new Error('Token cannot be empty');
  }
  // Store in Script Properties for consistency with existing deployment pattern
  PropertiesService.getScriptProperties().setProperty('UPSTOX_ACCESS_TOKEN', String(token).trim());
  return true;
}
