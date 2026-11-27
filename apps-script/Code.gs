/**
 * Household Tracker backend
 * Google Apps Script bound to your Google Sheet.
 *
 * IMPORTANT:
 * 1. Run setup() once from the Apps Script editor.
 * 2. Set APP_ACCESS_KEY and the five sticker keys in Script Properties (README).
 * 3. Deploy as a Web App: Execute as Me; access Anyone.
 *
 * This is a small private household utility using unguessable capability URLs.
 * Anyone who obtains the shared app link or a sticker URL can use that capability.
 */

const SHEETS = {
  diapers: "Diaper Log",
  cats: "Cat Water Log",
  hydration: "Hydration Log"
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Open this script from the Household Tracker spreadsheet.");
  // Web-app executions do not reliably have an active spreadsheet; persist its ID.
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
  const definitions = [
    [SHEETS.diapers, ["Timestamp", "Event", "Recorded By", "Source"]],
    [SHEETS.cats, ["Timestamp", "Event", "Amount (oz)", "Recorded By", "Source"]],
    [SHEETS.hydration, ["Timestamp", "Person", "Ounces", "Bottle Size (oz)", "Source"]]
  ];
  definitions.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold").setBackground("#e8eef7");
    sh.autoResizeColumns(1, headers.length);
  });
  let settings = ss.getSheetByName("Settings");
  if (!settings) settings = ss.insertSheet("Settings");
  if (settings.getLastRow() === 0) {
    settings.getRange(1,1,7,2).setValues([
      ["Setting", "Value"],
      ["Your bottle size (oz)", 24],
      ["Wife's bottle size (oz)", 32],
      ["Your daily goal (oz)", 100],
      ["Wife's daily goal (oz)", 80],
      ["Timezone", Session.getScriptTimeZone()],
      ["Setup complete", new Date()]
    ]);
    settings.getRange("A1:B1").setFontWeight("bold").setBackground("#e8eef7");
    settings.autoResizeColumns(1, 2);
  }
  return "Setup complete";
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || "health";
  try {
    if (action === "health") return output_({ok:true, message:"Household Tracker API is running"});
    if (action === "scan") return scan_(p);
    if (action === "dashboard") {
      authorize_(p.key, "APP_ACCESS_KEY");
      const data = dashboard_();
      return jsonp_(p.callback, {ok:true, data:data});
    }
    if (action === "manual") {
      authorize_(p.key, "APP_ACCESS_KEY");
      const result = manual_(p);
      return jsonp_(p.callback, {ok:true, result:result, data:dashboard_()});
    }
    return output_({ok:false, error:"Unknown action"});
  } catch (err) {
    const payload = {ok:false, error:String(err && err.message || err)};
    return p.callback ? jsonp_(p.callback, payload) : output_(payload);
  }
}

function scan_(p) {
  const token = p.token || "";
  const actionMap = {
    "DIAPER_STICKER_KEY": {type:"diaper"},
    "CAT_REFILL_STICKER_KEY": {type:"cat", event:"Refill"},
    "CAT_CHANGE_STICKER_KEY": {type:"cat", event:"Full change"},
    "YOU_BOTTLE_STICKER_KEY": {type:"hydration", person:"You", ounces:24},
    "WIFE_BOTTLE_STICKER_KEY": {type:"hydration", person:"Wife", ounces:32}
  };
  const props = PropertiesService.getScriptProperties();
  let config = null;
  Object.keys(actionMap).forEach(k => {
    if (props.getProperty(k) && token === props.getProperty(k)) config = actionMap[k];
  });
  if (!config) throw new Error("This sticker link is not authorized.");
  let msg = "";
  let added = false;
  if (config.type === "diaper") {
    added = appendScanOnce_(SHEETS.diapers, [new Date(), "Diaper change", "NFC", "Sticker"], token);
    msg = added ? "Diaper change logged" : "This tap was already logged. No duplicate was added.";
  } else if (config.type === "cat") {
    added = appendScanOnce_(SHEETS.cats, [new Date(), config.event, "", "NFC", "Sticker"], token);
    msg = added ? "Cat water " + config.event.toLowerCase() + " logged" : "This tap was already logged. No duplicate was added.";
  } else {
    const ounces = Number(props.getProperty(config.person === "You" ? "YOUR_BOTTLE_OZ" : "WIFE_BOTTLE_OZ") || config.ounces);
    if (!Number.isFinite(ounces) || ounces <= 0 || ounces > 200) throw new Error("Bottle size is not configured correctly.");
    added = appendScanOnce_(SHEETS.hydration, [new Date(), config.person, ounces, ounces, "NFC"], token);
    msg = added ? config.person + ": +" + ounces + " oz logged" : "This tap was already logged. No duplicate was added.";
  }
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="font:16px system-ui;max-width:420px;margin:15vh auto;padding:24px;text-align:center;color:#183047">' +
    '<div style="font-size:42px">✓</div><h2>' + escapeHtml_(msg) + '</h2><p>You can close this page.</p></body>'
  );
}

function manual_(p) {
  const type = String(p.type || "");
  if (type === "hydration") {
    const person = p.person === "Wife" ? "Wife" : "You";
    const ounces = Number(p.ounces);
    if (!Number.isFinite(ounces) || ounces <= 0 || ounces > 200) throw new Error("Enter a valid amount of ounces.");
    append_(SHEETS.hydration, [new Date(), person, ounces, "", "App"]);
    return person + ": +" + ounces + " oz";
  }
  if (type === "diaper") {
    append_(SHEETS.diapers, [new Date(), "Diaper change", "App", "Manual"]);
    return "Diaper change logged";
  }
  if (type === "cat") {
    const event = p.event === "Full change" ? "Full change" : "Refill";
    const amount = p.amount ? Number(p.amount) : "";
    if (amount !== "" && (!Number.isFinite(amount) || amount < 0 || amount > 500)) throw new Error("Enter a valid amount.");
    append_(SHEETS.cats, [new Date(), event, amount, "App", "Manual"]);
    return "Cat water " + event.toLowerCase() + " logged";
  }
  throw new Error("Unknown manual event type.");
}

function dashboard_() {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const hydrationRows = rows_(SHEETS.hydration);
  const totals = {You:0, Wife:0};
  const recent = [];
  hydrationRows.slice(-200).reverse().forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (!isNaN(ts) && Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd") === today) {
      const who = r[1] === "Wife" ? "Wife" : "You";
      totals[who] += Number(r[2]) || 0;
      recent.push({timestamp:ts.toISOString(), person:r[1], ounces:Number(r[2])||0});
    }
  });
  const diaperRows = rows_(SHEETS.diapers);
  const diaperCount = diaperRows.filter(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
    return !isNaN(ts) && Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd") === today;
  }).length;
  const catRows = rows_(SHEETS.cats);
  const lastCat = catRows.length ? catRows[catRows.length-1] : null;
  const settings = settings_();
  return {
    date:today,
    hydration: {
      You:{total:totals.You, goal:Number(settings["Your daily goal (oz)"])||100, bottle:Number(settings["Your bottle size (oz)"])||24},
      Wife:{total:totals.Wife, goal:Number(settings["Wife's daily goal (oz)"])||80, bottle:Number(settings["Wife's bottle size (oz)"])||32},
      recent:recent.slice(0,12)
    },
    diaperChangesToday:diaperCount,
    catWaterLastEvent:lastCat ? {timestamp:(lastCat[0] instanceof Date ? lastCat[0] : new Date(lastCat[0])).toISOString(), event:lastCat[1]} : null
  };
}

function settings_() {
  const sh = getSpreadsheet_().getSheetByName("Settings");
  if (!sh || sh.getLastRow() < 2) return {};
  const values = sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
  const out = {};
  values.forEach(r => out[String(r[0])] = r[1]);
  return out;
}
function rows_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
}
function append_(sheetName, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh) throw new Error("Run setup() first.");
  sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}
function appendScanOnce_(sheetName, row, token) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
    const cacheKey = "scan_" + digest;
    if (cache.get(cacheKey)) return false;
    const sh = getSpreadsheet_().getSheetByName(sheetName);
    if (!sh) throw new Error("Run setup() first.");
    sh.appendRow(row);
    cache.put(cacheKey, "1", 8);
    return true;
  } finally {
    lock.releaseLock();
  }
}
function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Run setup() once from the spreadsheet-bound Apps Script project first.");
  return SpreadsheetApp.openById(id);
}
function authorize_(given, propertyName) {
  const expected = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!expected || !given || given !== expected) throw new Error("This app link is missing or invalid. Open the private link shared with you.");
}
function jsonp_(callback, obj) {
  const json = JSON.stringify(obj).replace(/</g, "\\u003c");
  if (!callback || !/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) return output_(obj);
  return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function output_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
