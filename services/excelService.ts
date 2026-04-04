import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import * as XLSX from "xlsx";

const folderPath = FileSystem.documentDirectory + "ExpenseTracker/";

const ensureFolder = async () => {
  const folderInfo = await FileSystem.getInfoAsync(folderPath);

  if (!folderInfo.exists) {
    await FileSystem.makeDirectoryAsync(folderPath, {
      intermediates: true,
    });
  }
};

const getBuckets = async () => {
  const data = await AsyncStorage.getItem("BUCKETS");
  return data ? JSON.parse(data) : [];
};

const createSheetStructure = (buckets: any[]) => {
  const header1: any[] = [];
  const header2: any[] = [];

  buckets.forEach((bucket) => {
    header1.push(bucket.name);
    header1.push("");
    header1.push("");
    header1.push("");

    header2.push("Spend On");
    header2.push("Rs.");
    header2.push("Date");
    header2.push("Txn ID");
  });

  return [header1, header2];
};

const getFormattedDateTime = (timestamp?: number) => {
  const now = timestamp ? new Date(timestamp) : new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const calculateTotalsForData = (data: any[][], bucketCount: number) => {
  const totals: number[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const colStart = i * 4;
    let sum = 0;

    // Skip headers (0, 1) and any existing Total rows
    for (let r = 2; r < data.length; r++) {
      if (data[r] && data[r].includes("Total")) continue;
      const value = Number(data[r]?.[colStart + 1] || 0);
      sum += value;
    }
    totals[i] = sum;
  }

  return totals;
};

export const saveSpendToExcel = async (
  bucketName: string,
  note: string,
  amount: string,
  transactionId: string = "",
  timestamp?: number
) => {
  try {
    await ensureFolder();

    const buckets = await getBuckets();
    const now = new Date();
    const year = now.getFullYear();
    const monthName = now.toLocaleString("default", { month: "long" });

    const fileUri = folderPath + `Expense_${year}.xlsx`;

    let workbook;
    let worksheet;

    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (fileInfo.exists) {
      const fileData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      workbook = XLSX.read(fileData, { type: "base64" });
    } else {
      workbook = XLSX.utils.book_new();
    }

    /* ---------- Create sheet if month not exists ---------- */
    if (!workbook.SheetNames.includes(monthName)) {
      const rows = createSheetStructure(buckets);
      worksheet = XLSX.utils.aoa_to_sheet(rows);

      const merges: any[] = [];
      buckets.forEach((_, index) => {
        const startCol = index * 4;
        merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 3 } });
      });
      worksheet["!merges"] = merges;
      XLSX.utils.book_append_sheet(workbook, worksheet, monthName);
    }

    worksheet = workbook.Sheets[monthName];
    let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    /* ---------- Step 8: Strict Duplicate Check ---------- */
    if (transactionId) {
      let isDuplicate = false;
      for (let r = 2; r < data.length; r++) {
        if (data[r] && data[r].includes("Total")) continue;
        for (let b = 0; b < (data[0].length / 4); b++) {
          const txnIdIndex = b * 4 + 3;
          if (data[r] && data[r][txnIdIndex] === transactionId) {
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) break;
      }
      if (isDuplicate) {
        console.log(`[Excel] Duplicate detected (ID: ${transactionId}). Skipping.`);
        return;
      }
    }

    /* ---------- Step 10: Sync Middle-of-Month Buckets ---------- */
    const sheetBucketsNames = data[0].filter(val => val && val !== "");
    let updatedHeaders = false;

    buckets.forEach((bucket: any) => {
      if (!sheetBucketsNames.includes(bucket.name)) {
        const nextCol = data[0].length;
        data[0][nextCol] = bucket.name;
        data[0][nextCol + 1] = "";
        data[0][nextCol + 2] = "";
        data[0][nextCol + 3] = "";

        data[1][nextCol] = "Spend On";
        data[1][nextCol + 1] = "Rs.";
        data[1][nextCol + 2] = "Date";
        data[1][nextCol + 3] = "Txn ID";
        updatedHeaders = true;
      }
    });

    if (updatedHeaders) {
      // Re-calculate merges
      const merges: any[] = [];
      for (let i = 0; i < data[0].length / 4; i++) {
        merges.push({ s: { r: 0, c: i * 4 }, e: { r: 0, c: i * 4 + 3 } });
      }
      worksheet["!merges"] = merges;
    }

    /* ---------- Write the Transaction ---------- */
    const bucketIndex = buckets.findIndex((b: any) => b.name === bucketName);
    const colStart = bucketIndex * 4;

    let rowToInsert = 2;
    while (data[rowToInsert] && data[rowToInsert][colStart] && !data[rowToInsert].includes("Total")) {
      rowToInsert++;
    }

    // Ensure we don't overwrite a Total row
    if (data[rowToInsert] && data[rowToInsert].includes("Total")) {
      data.splice(rowToInsert, 0, []); // Insert an empty row before Total
    }

    if (!data[rowToInsert]) data[rowToInsert] = [];
    data[rowToInsert][colStart] = note;
    data[rowToInsert][colStart + 1] = amount;
    data[rowToInsert][colStart + 2] = getFormattedDateTime(timestamp);
    data[rowToInsert][colStart + 3] = transactionId;

    /* ---------- Clean and Re-calculate Totals ---------- */
    // Remove all existing Total rows
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i] && data[i].includes("Total")) {
        data.splice(i, 1);
      }
    }

    const bucketCount = data[0].length / 4;
    const totals = calculateTotalsForData(data, bucketCount);
    const totalRow: any[] = [];
    for (let i = 0; i < bucketCount; i++) {
      totalRow[i * 4] = "Total";
      totalRow[i * 4 + 1] = totals[i];
    }

    data.push([]); // Gap
    data.push(totalRow);

    const updatedSheet = XLSX.utils.aoa_to_sheet(data);
    updatedSheet["!merges"] = worksheet["!merges"];
    workbook.Sheets[monthName] = updatedSheet;

    const excelData = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    await FileSystem.writeAsStringAsync(fileUri, excelData, { encoding: FileSystem.EncodingType.Base64 });

  } catch (error) {
    console.log("Excel error:", error);
  }
};

export const downloadExcel = async () => {
  try {
    const year = new Date().getFullYear();
    const fileUri = folderPath + `Expense_${year}.xlsx`;
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) return Alert.alert("Not Found", "No Excel file yet.");
    await Sharing.shareAsync(fileUri);
  } catch (error) {
    Alert.alert("Error sharing Excel");
  }
};

export const deleteExcel = async () => {
  try {
    const year = new Date().getFullYear();
    const fileUri = folderPath + `Expense_${year}.xlsx`;
    await FileSystem.deleteAsync(fileUri);
    Alert.alert("Success", "Excel file deleted.");
  } catch (error) {
    Alert.alert("Error deleting file");
  }
};
