var Buffer = require('buffer').Buffer
const formatPalletNoteData = (data) => {
    let pallet_note_list = data
    let uniquePalletNo = []
    for (let i = 0; i < data.length; i++) {

      if (!uniquePalletNo.includes(data[i]['Pallet No'] + "|" + data[i].Location)) {
        uniquePalletNo.push(data[i]["Pallet No"] + "|" + data[i].Location )
      }
    }
    console.log(data)
    // console.log(uniquePalletNo)

    let result = [];
    for (let i = 0; i < uniquePalletNo.length; i++) {
      let invoiceNos = [];
      const uniquePalletNoSplit = uniquePalletNo[i].split("|"); //0 is palletNo, 1 is location and 2 is sku type
      for (let j = 0; j < pallet_note_list.length; j++) {
        if (uniquePalletNoSplit[0] == pallet_note_list[j]["Pallet No"]) {
          invoiceNos.push(
            pallet_note_list[j].Location +
            "|" +
            pallet_note_list[j]["caseMarkNoDummy"] +
            "|" +
            pallet_note_list[j]["Pallet No"]
          );
        }
      }
      let uniqueInvoiceNo = [];
      for (let j = 0; j < invoiceNos.length; j++) {
        if (!uniqueInvoiceNo.includes(invoiceNos[j])) {
          uniqueInvoiceNo.push(invoiceNos[j]);
        }
      }
      // console.log(uniqueInvoiceNo)
      let resultBox = [];
      for (let j = 0; j < uniqueInvoiceNo.length; j++) {
        let boxId = [];
        // console.log("TESTHERE")
        let split = uniqueInvoiceNo[j].split("|");
        // console.log(split)
        for (let k = 0; k < pallet_note_list.length; k++) {
          if (
            pallet_note_list[k]["caseMarkNoDummy"] == split[1].trim &&
            pallet_note_list[k].Location == split[0] &&
            pallet_note_list[k]["Pallet No"]
          ) {
            let box = String(pallet_note_list[k]["Box No"]).split("-");
            if (!boxId.includes(box[box.length - 1]))
              boxId.push(box[box.length - 1]);
          }
        }
        boxId.sort((a, b) => parseInt(a) - parseInt(b));
        resultBox.push(...boxId);
      }

      let filterUniqueInvoiceNo = [];
      for (let i = 0; i < uniqueInvoiceNo.length; i++) {
        filterUniqueInvoiceNo.push(uniqueInvoiceNo[i].split("|")[1]);
      }
      if (uniquePalletNoSplit[2] == "BOX") {
        result.push({
          PalletNo: uniquePalletNoSplit[0],
          InvoiceNo: filterUniqueInvoiceNo,
          // No: resultBox.toString(),
          Location: uniquePalletNoSplit[1],
          // Nos: resultBox,
          // OutterPackaging: uniquePalletNoSplit[2],
        });
      } else {
        result.push({
          PalletNo: uniquePalletNoSplit[0],
          caseMarkNoDummy: filterUniqueInvoiceNo,
          // No: resultBox.toString(),
          Location: uniquePalletNoSplit[1],
          // Nos: resultBox,
          // OutterPackaging: uniquePalletNoSplit[2],
        });
      }
    }

    return result;
}
const reformatCSVInventory = (data) => {
    return data.map(e => {
      return {
        "Receive Date": e['Receive Date'],
        "Pallet No": e['Pallet No'],
        "Division": e["Location.Division.divisionNameAS400Full"],
        "Case Mark No Dummy": e['ProductDetail.caseMarkNoDummy'],
        "Box No": e["ProductDetail.boxNo"],
        "Model": e["ProductDetail.model"],
        "Item No": e["ProductDetail.itemNo"],
        "Item Name": e["ProductDetail.itemName"],
        "Quantity Per Unit": e["ProductDetail.quantityPerUnit"],
        "Unit Price Amount(THB)": (Math.round(e['ProductDetail.amount'])).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Location": e['Location.locationCode'],
        "Status": e["ProductStatus.productStatusName"]
      }
    })
}

const tis620 = {
  "00": "␀", "01": "␁", "02": "␂", "03": "␃", "04": "␄", "05": "␅", "06": "␆", "07": "␇", "08": "␈", "09": "␉", "0A": "␊",
  "0A": "␋", "0C": "␌", "0D": "␍", "0E": "␎", "0F": "␏", "10": "␐", "11": "␑", "12": "␒", "13": "␓", "14": "␔", "15": "␕",
  "16": "␖", "17": "␗", "18": "␘", "19": "␙", "1A": "␚", "1B": "␛", "1C": "␜", "1D": "␝", "1E": "␞", "1F": "␟", "20": " ",
  "21": "!", "22": "\"", "23": "#", "24": "$", "25": "%", "26": "&", "27": "'", "28": "(", "29": ")", "2A": "*", "2B": "+",
  "2C": ",", "2D": "-", "2E": ".", "2F": "/", "30": "0", "31": "1", "32": "2", "33": "3", "34": "4", "35": "5", "36": "6",
  "37": "7", "38": "8", "39": "9", "3A": ":", "3B": ";", "3C": "<", "3D": "=", "3E": ">", "3F": "?", "40": "@", "41": "A",
  "42": "B", "43": "C", "44": "D", "45": "E", "46": "F", "47": "G", "48": "H", "49": "I", "4A": "J", "4B": "K", "4C": "L",
  "4D": "M", "4E": "N", "4F": "O", "50": "P", "51": "Q", "52": "R", "53": "S", "54": "T", "55": "U", "56": "V", "57": "W",
  "58": "X", "59": "Y", "5A": "Z", "5B": "[", "5C": "\\", "5D": "]", "5E": "^", "5F": "_", "60": "`", "61": "a", "62": "b",
  "63": "c", "64": "d", "65": "e", "66": "f", "67": "g", "68": "h", "69": "i", "6A": "j", "6B": "k", "6C": "l", "6D": "m",
  "6E": "n", "6F": "o", "70": "p", "71": "q", "72": "r", "73": "s", "74": "t", "75": "u", "76": "v", "77": "w", "78": "x",
  "79": "y", "7A": "z", "7B": "{", "7C": "|", "7D": "}", "7E": "~", "7F": "␡", "80": "", "81": "", "82": "", "83": "",
  "84": "", "85": "", "86": "", "87": "", "88": "", "89": "", "8A": "", "8B": "", "8C": "", "8D": "", "8E": "", "8F": "",
  "90": "", "91": "", "92": "", "93": "", "94": "", "95": "", "96": "", "97": "", "98": "", "99": "", "9A": "", "9B": "",
  "9C": "", "9D": "", "9E": "", "9F": "", "A0": "", "A1": "ก", "A2": "ข", "A3": "ฃ", "A4": "ค", "A5": "ฅ", "A6": "ฆ",
  "A7": "ง", "A8": "จ", "A9": "ฉ", "AA": "ช", "AB": "ซ", "AC": "ฌ", "AD": "ญ", "AE": "ฎ", "AF": "ฏ", "B0": "ฐ", "B1": "ฑ",
  "B2": "ฒ", "B3": "ณ", "B4": "ด", "B5": "ต", "B6": "ถ", "B7": "ท", "B8": "ธ", "B9": "น", "BA": "บ", "BB": "ป", "BC": "ผ",
  "BD": "ฝ", "BE": "พ", "BF": "ฟ", "C0": "ภ", "C1": "ม", "C2": "ย", "C3": "ร", "C4": "ฤ", "C5": "ล", "C6": "ฦ", "C7": "ว",
  "C8": "ศ", "C9": "ษ", "CA": "ส", "CB": "ห", "CC": "ฬ", "CD": "อ", "CE": "ฮ", "CF": "ฯ", "D0": "ะ", "D1": "ั", "D2": "า",
  "D3": "ำ", "D4": "ิ", "D5": "ี", "D6": "ึ", "D7": "ื", "D8": "ุ", "D9": "ู", "DA": "ฺ", "DB": "", "DC": "", "DD": "", "DE": "",
  "DF": "฿", "E0": "เ", "E1": "แ", "E2": "โ", "E3": "ใ", "E4": "ไ", "E5": "ๅ", "E6": "ๆ", "E7": "็", "E8": "่", "E9": "้",
  "EA": "๊", "EB": "๋", "EC": "์", "ED": "ํ", "EE": "๎", "EF": "๏", "F0": "๐", "F1": "๑", "F2": "๒", "F3": "๓", "F4": "๔",
  "F5": "๕", "F6": "๖", "F7": "๗", "F8": "๘", "F9": "๙", "FA": "๚", "FB": "๛", "FC": "", "FD": "", "FE": "", "FF": "",
}

const StringToThai = (string) => {
  console.log(string)
  if(string !== ""){
    let hex = Buffer.from(string, "ascii")
    let hexStr = hex.toString('hex').toUpperCase().match(/.{1,2}/g)
    let thai = ""
console.log(hexStr)
    for (let i = 0; i < hexStr.length; i++) {
        thai += tis620[hexStr[i]]
    }
    console.log(thai)
    return thai
  }else{
    return ""
  }

}

module.exports = {
    formatPalletNoteData,
    StringToThai,
    reformatCSVInventory,
}

