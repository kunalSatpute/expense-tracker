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

const getFormattedDateTime = () => {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const calculateTotals = (data: any[][], buckets: any[]) => {
  const totals: number[] = [];

  buckets.forEach((_, index) => {
    const colStart = index * 4;

    let sum = 0;

    for (let r = 2; r < data.length; r++) {
      const value = Number(data[r]?.[colStart + 1] || 0);
      sum += value;
    }

    totals[index] = sum;
  });

  return totals;
};

export const saveSpendToExcel = async (
  bucketName: string,
  note: string,
  amount: string,
  transactionId: string = "",
) => {
  try {
    await ensureFolder();

    const buckets = await getBuckets();

    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString("default", { month: "long" });

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

    if (!workbook.SheetNames.includes(month)) {
      const rows = createSheetStructure(buckets);

      worksheet = XLSX.utils.aoa_to_sheet(rows);

      const merges: any[] = [];

      buckets.forEach((bucket, index) => {
        const startCol = index * 4;

        merges.push({
          s: { r: 0, c: startCol },
          e: { r: 0, c: startCol + 3 },
        });
      });

      worksheet["!merges"] = merges;

      XLSX.utils.book_append_sheet(workbook, worksheet, month);
    }

    worksheet = workbook.Sheets[month];

    let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    /* ---------- Check if new buckets added ---------- */

    const expectedColumns = buckets.length * 4;
    const currentColumns = data[0] ? data[0].length : 0;

    if (currentColumns < expectedColumns) {
      const headers = createSheetStructure(buckets);

      const existingData = data.slice(2);

      const rebuiltSheet = [...headers, ...existingData];

      worksheet = XLSX.utils.aoa_to_sheet(rebuiltSheet);

      const merges: any[] = [];

      buckets.forEach((bucket, index) => {
        const startCol = index * 4;

        merges.push({
          s: { r: 0, c: startCol },
          e: { r: 0, c: startCol + 3 },
        });
      });

      worksheet["!merges"] = merges;

      workbook.Sheets[month] = worksheet;

      data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    }

    const bucketIndex = buckets.findIndex((b: any) => b.name === bucketName);

    const colStart = bucketIndex * 4;

    let row = 2;

    while (data[row] && data[row][colStart]) {
      row++;
    }

    if (!data[row]) data[row] = [];

    const formattedDate = getFormattedDateTime();

    data[row][colStart] = note;
    data[row][colStart + 1] = amount;
    data[row][colStart + 2] = formattedDate;
    data[row][colStart + 3] = transactionId;

    // remove old totals
    for (let i = data.length - 1; i >= 2; i--) {
      if (data[i] && data[i].includes("Total")) {
        data.splice(i, 1);
      }
    }

    const totals = calculateTotals(data, buckets);

    const totalRow: any[] = [];

    buckets.forEach((_, index) => {
      const colStart = index * 4;

      totalRow[colStart] = "Total";
      totalRow[colStart + 1] = totals[index];
    });

    data.push([]);
    data.push(totalRow);

    const updatedSheet = XLSX.utils.aoa_to_sheet(data);

    workbook.Sheets[month] = updatedSheet;

    const excelData = XLSX.write(workbook, {
      type: "base64",
      bookType: "xlsx",
    });

    await FileSystem.writeAsStringAsync(fileUri, excelData, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error) {
    console.log("Excel error:", error);
  }
};

export const downloadExcel = async () => {
  try {
    const year = new Date().getFullYear();

    const fileUri =
      FileSystem.documentDirectory + "ExpenseTracker/Expense_" + year + ".xlsx";

    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (!fileInfo.exists) {
      Alert.alert("File not found", "No Excel file created yet.");
      return;
    }

    await Sharing.shareAsync(fileUri);
  } catch (error) {
    console.log(error);
    Alert.alert("Error downloading Excel");
  }
};

export const deleteExcel = async () => {
  try {
    const year = new Date().getFullYear();

    const fileUri =
      FileSystem.documentDirectory + "ExpenseTracker/Expense_" + year + ".xlsx";

    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (!fileInfo.exists) {
      Alert.alert("File not found", "No Excel file to delete.");
      return;
    }

    await FileSystem.deleteAsync(fileUri);

    Alert.alert("Success", "Excel file deleted.");
  } catch (error) {
    console.log(error);
    Alert.alert("Error deleting file");
  }
};
