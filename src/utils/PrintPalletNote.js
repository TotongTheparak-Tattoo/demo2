import QRCode from 'qrcode';
import Swal from "sweetalert2";

const convertQRToImage = async (item) => {
  try {
    
    const qrData = `${item.palletNo}\t${item.vendorCode}_${item.masterInvoiceNo}_${item.poNo || '-'}_${item.caseNo}`;
    const qrCodeUrl = await QRCode.toDataURL(qrData, {
      width: 120,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return null;
  }
};

const groupDataByPallet = (dataArray) => {
  return dataArray.reduce((acc, item) => {
    if (!acc[item.palletNo]) {
      acc[item.palletNo] = {
        vendorCode: item.vendorCode,
        vendorName: item.vendorName,
        palletNo: item.palletNo,
        masterInvoiceNo: item.masterInvoiceNo,
        items: [],
        totalQuantity: 0
      };
    }
    acc[item.palletNo].items.push(item);
    acc[item.palletNo].totalQuantity += item.quantity;
    return acc;
  }, {});
};

const generatePalletPrintWindow = async (responseData) => {
  console.log(responseData)
  console.log(typeof(responseData))
  if (!responseData || !responseData.result || !Array.isArray(responseData.result)) {
    console.error('Invalid response data');
    return;
  }

  try {
    const groupedData = groupDataByPallet(responseData.result);
    const palletArray = Object.values(groupedData);
    const qrImagePromises = palletArray.map(pallet => 
      convertQRToImage(pallet.items[0]) 
    );
    const qrImages = await Promise.all(qrImagePromises);

    const printWindow = window.open("", "_blank", "width=800,height=600");
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Pallet Labels - ${responseData.result[0]?.masterInvoiceNo || ''}</title>
          <style>
            @media print {
              @page {
                size: 150mm 65mm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
              .page {
                page-break-after: always;
              }
            }

            body {
              font-family: 'Consolas','Courier New', monospace;
              margin: 0;
              padding: 0;
              background: white;
            }

            .page {
              width: 150mm;
              height: 65mm;
              margin: 0 auto;
              padding: 0;
              display: flex;
              align-items: stretch;
              box-sizing: border-box;
            }

            .label {
              border: 1px solid black;
              padding: 3mm 4mm;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              gap: 1mm;
              box-sizing: border-box;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .header {
              border-bottom: 1px solid black;
              padding-bottom: 1mm;
              margin-bottom: 1mm;
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              flex-shrink: 0;
            }

            .content-container {
              display: block;
              position: relative;
              flex: 1;
              min-height: 0;
            }

            .left-content {
              font-size: 14px;
              line-height: 1.3;
              display: grid;
              gap: 1mm;
              width: 100%;
            }

            .qr-container {
              border: 1px solid black;
              padding: 0.5mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              position: absolute;
              top: 0;
              right: 0;
              width: fit-content;
              height: fit-content;
              z-index: 1;
            }

            .qr-container img {
              width: 25mm;
              height: 25mm;
              display: block;
            }

            .qr-error {
              width: 18mm;
              height: 18mm;
              border: 1px solid #ccc;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
            }

            .info-row {
              display: flex;
              align-items: baseline;
              gap: 1mm;
              width: 100%;
            }

            .info-label {
              font-weight: bold;
              font-size: 14px;
              min-width: 32mm;
              white-space: nowrap;
              flex-shrink: 0;
            }

            .info-value {
              font-family: 'Consolas','Courier New', monospace;
              font-weight: normal;
              font-size: 16px;
            }

            .vendorName-label {
              font-weight: bold;
              font-size: 10px;
              min-width: 32mm;
            }

            .vendorName-value {
              font-family: 'Consolas','Courier New', monospace;
              font-weight: normal;
              font-size: 10px;
            }

            .locationCode-value {
              font-family: 'Consolas','Courier New', monospace;
              font-weight: bold;
              font-size: 25px;
            }
          </style>
        </head>
        <body>
    `);

    for (let i = 0; i < palletArray.length; i++) {
      printWindow.document.write('<div class="page">');
      
      const palletData = palletArray[i];
      const qrImage = qrImages[i];
      
      printWindow.document.write(`
        <div class="label">
          <div class="header">
            PALLET LABEL (MATERIAL/VMI)
          </div>
          
          <div class="content-container">
            <div class="left-content">
              <div class="info-row">
                <span class="info-label">Vendor Code:</span>
                <span class="info-value">&nbsp;${palletData.vendorCode}</span>
              </div>

              <div class="info-row">
                <span class="vendorName-label">Vendor Name:</span>
                <span class="vendorName-value">&nbsp;${palletData.vendorName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Invoice No:</span>
                <span class="info-value">&nbsp;${palletData.masterInvoiceNo}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">P/O No:</span>
                <span class="info-value">${palletData.items[0].poNo || '-'}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Case No/Lot No:</span>
                <span class="info-value">&nbsp;${palletData.items[0].caseNo || '-'} / ${palletData.items[0].lotNo || '-'}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Q'ty:</span>
                <span class="info-value">${palletData.totalQuantity}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Pallet ID:</span>
                <span class="info-value">&nbsp;${palletData.items[0].boxNo || '-'}</span>
              </div>

              <div class="info-row">
                <span class="info-label">Location :</span>
                <span class="locationCode-value">&nbsp;${palletData.items[0].locationCode || '-'}</span>
              </div>

            </div>

            <div class="qr-container">
              ${qrImage ? `<img src="${qrImage}" alt="QR Code" />` : '<div class="qr-error">QR Error</div>'}
            </div>
          </div>
        </div>
      `);
      
      printWindow.document.write('</div>'); 
    }

    printWindow.document.write(`
        </body>
      </html>
    `);
    
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 2000);

  } catch (error) {
    console.error('Error generating print window:', error);
    Swal.fire({
      icon: "error",
      title: "Print Generation Failed",
      text: "Error generating label: " + (error.message || "Unknown error"),
      confirmButtonText: "OK",
    });
  }
};

const handlePrintPalletLabels = async (responseData) => {
  try {
    await generatePalletPrintWindow(responseData);
    console.log('Print window generated successfully');
  } catch (error) {
    console.error('Error generating print window:', error);
  }
};

export default handlePrintPalletLabels;
export { generatePalletPrintWindow, handlePrintPalletLabels };