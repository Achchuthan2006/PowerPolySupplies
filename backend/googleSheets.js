import fs from "fs";
import path from "path";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
let sheetsClientPromise = null;
const ensuredTabs = new Set();

function loadServiceAccount(){
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if(jsonRaw){
    try{
      return JSON.parse(jsonRaw);
    }catch(err){
      try{
        return JSON.parse(jsonRaw.replace(/\\n/g, "\n"));
      }catch(parseErr){
        console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", parseErr);
        return null;
      }
    }
  }

  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if(filePath){
    try{
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      const raw = fs.readFileSync(resolvedPath, "utf-8");
      return JSON.parse(raw);
    }catch(err){
      console.error("Failed to read GOOGLE_SERVICE_ACCOUNT_FILE", err);
      return null;
    }
  }

  return null;
}

function getSheetId(){
  return process.env.GOOGLE_SHEET_ID || "";
}

export function isSheetsConfigured(){
  return !!(getSheetId() && loadServiceAccount());
}

async function getSheetsClient(){
  if(sheetsClientPromise) return sheetsClientPromise;

  const credentials = loadServiceAccount();
  if(!credentials) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES
  });

  sheetsClientPromise = auth.getClient().then((client) =>
    google.sheets({ version: "v4", auth: client })
  );
  return sheetsClientPromise;
}

async function ensureSheetTab(tabName){
  const sheetId = getSheetId();
  if(!sheetId || !tabName) return false;
  if(ensuredTabs.has(tabName)) return true;

  const sheets = await getSheetsClient();
  if(!sheets) return false;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const exists = (meta.data.sheets || []).some((sheet)=> sheet.properties?.title === tabName);
  if(!exists){
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }]
      }
    });
  }

  ensuredTabs.add(tabName);
  return true;
}

async function replaceSheet(tabName, values){
  const sheetId = getSheetId();
  if(!sheetId || !tabName) return false;
  const sheets = await getSheetsClient();
  if(!sheets) return false;

  await ensureSheetTab(tabName);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `${tabName}!A:Z`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });

  return true;
}

async function appendRow(tabName, values){
  const sheetId = getSheetId();
  if(!sheetId || !tabName) return false;
  const sheets = await getSheetsClient();
  if(!sheets) return false;

  await ensureSheetTab(tabName);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] }
  });

  return true;
}

async function ensureOrderHeader(tabName){
  const sheetId = getSheetId();
  if(!sheetId || !tabName) return false;
  const sheets = await getSheetsClient();
  if(!sheets) return false;

  await ensureSheetTab(tabName);
  const range = `${tabName}!A1:I1`;
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });
  const firstCell = current?.data?.values?.[0]?.[0] || "";
  if(firstCell) return true;

  const header = [
    "Date/Time",
    "Order ID",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Shipping Zone",
    "Shipping Cost",
    "Items Summary",
    "Total"
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [header] }
  });
  return true;
}

export async function appendOrderToSheet(values){
  const tab = process.env.GOOGLE_SHEET_ORDERS_TAB || "Orders";
  await ensureOrderHeader(tab);
  return appendRow(tab, values);
}

export async function appendMessageToSheet(values){
  const tab = process.env.GOOGLE_SHEET_MESSAGES_TAB || "Messages";
  return appendRow(tab, values);
}


export async function appendReviewToSheet(values){
  const tab = process.env.GOOGLE_SHEET_REVIEWS_TAB || "Reviews";
  return appendRow(tab, values);
}

export async function syncProductsToSheet(products){
  const tab = process.env.GOOGLE_SHEET_PRODUCTS_TAB || "Products";
  const list = Array.isArray(products) ? products : [];
  const timestamp = new Date().toISOString();
  const header = [
    "Updated At",
    "Product ID",
    "Name",
    "Category",
    "Price Cents",
    "Currency",
    "Stock",
    "Slug",
    "Image",
    "Description",
    "Special"
  ];
  const rows = list.map((p)=>[
    timestamp,
    p.id || "",
    p.name || "",
    p.category || "",
    Number(p.priceCents || 0),
    p.currency || "",
    Number(p.stock ?? 0),
    p.slug || "",
    p.image || "",
    p.description || "",
    p.special ? "TRUE" : "FALSE"
  ]);

  return replaceSheet(tab, [header, ...rows]);
}
