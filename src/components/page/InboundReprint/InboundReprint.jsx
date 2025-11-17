import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { handlePrintPalletLabels } from "../../../utils/PrintPalletNote";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./InboundReprint.css";
export default function InboundReprint() {
  const [selectedVendorMaster, setselectedVendorMaster] = useState("");
  const [vendorMaster, setVendorMaster] = useState([]);
  const [meterialReceiveReprintList, setMeterialReceiveReprintList] = useState([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    getVendorMaster();
  }, []);

  useEffect(() => {
    if (selectedVendorMaster) {
      getMaterialReceiveReprintListByVendor();
      setCurrentPage(1); // Reset to first page when vendor changes
    }
  }, [selectedVendorMaster]);

  // Calculate pagination
  const totalPages = Math.ceil(meterialReceiveReprintList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = meterialReceiveReprintList.slice(startIndex, endIndex);

  const handleVendorMasterChange = (e) => {
    setselectedVendorMaster(e.target.value);
  };

  const getVendorMaster = async () => {
    try {
      const response = await httpClient.get(`/api/v1/vendorMaster/get_all_vendorMaster`);
      const valuesArray = Object.values(response.data.result).map((item) => ({
        vendorMasterName: item.vendorMasterName,
        vendorMasterId: item.vendorMasterId,
      }));

      if (response.status === 200) setVendorMaster(valuesArray);
      else if (response.status === 500) {
        Swal.fire({
          title: "Info!",
          text: response.data.detail,
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch {}
  };

  const getMaterialReceiveReprintListByVendor = async () => {
    try {
      const response = await httpClient.get(
        `/api/v1/inbound/reprint/get_material_receive_reprint_list_by_vendor`,
        {
          params: { vendorId: selectedVendorMaster },
          headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN")}` },
        }
      );

      if (response.status === 200) setMeterialReceiveReprintList(response.data.result);
      else if (response.status === 500) {
        Swal.fire({
          title: "Info!",
          text: response.data.detail,
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (error) {
      setMeterialReceiveReprintList([]);
      setselectedVendorMaster("");
      console.log("Error", error);
    }
  };

  const handleSelectAllCheckbox = () => {
    const updatedList = [...meterialReceiveReprintList];
    const allCurrentPageSelected = currentItems.every((item) => item.selected);

    const filteredIndices = [];
    let filteredIndex = 0;

    meterialReceiveReprintList.forEach((_, index) => {
      if (filteredIndex >= startIndex && filteredIndex < endIndex) filteredIndices.push(index);
      filteredIndex++;
    });

    filteredIndices.forEach((index) => {
      updatedList[index] = {
        ...updatedList[index],
        selected: !allCurrentPageSelected,
      };
    });

    setMeterialReceiveReprintList(updatedList);
  };

  const handleRowSelectChange = (rowIndex) => {
    const actualFilteredIndex = startIndex + rowIndex;

    let filteredIndex = 0;
    let actualIndex = -1;

    meterialReceiveReprintList.forEach((_, index) => {
      if (filteredIndex === actualFilteredIndex) actualIndex = index;
      filteredIndex++;
    });

    if (actualIndex === -1) return;

    const updatedList = [...meterialReceiveReprintList];
    updatedList[actualIndex] = {
      ...updatedList[actualIndex],
      selected: !updatedList[actualIndex].selected,
    };
    setMeterialReceiveReprintList(updatedList);
  };

  const areAllCurrentPageItemsSelected = () =>
    currentItems.length > 0 && currentItems.every((item) => item.selected);

  // Pagination handlers
  const goToPage = (pageNumber) => setCurrentPage(pageNumber);
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  // data -> print format
  const transformDataForPrint = (selectedItems) => {
    const result = selectedItems.map((item) => ({
      vendorCode: item.vendor,
      vendorName: item.vendorName,
      palletNo: item.palletNo,
      masterInvoiceNo: item.masterInvoiceNo,
      boxNo: item.boxNo,
      caseNo: item.caseNo,
      poNo: item.poNo,
      quantity: item.quantity,
      spec: item.spec,
      size: item.size,
      locationCode: item.location || '',
      lotNo: item.lotNo || '',
    }));
    return { result };
  };

  const inboundReceiveReprint = async () => {
    const selectedItems = meterialReceiveReprintList.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No items selected!",
        text: "Please select at least one item to print.",
        confirmButtonText: "OK",
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    try {
      const printData = transformDataForPrint(selectedItems);
      await handlePrintPalletLabels(printData);

      const totalItems = meterialReceiveReprintList.length;
      const isAllProcessed = selectedItems.length === totalItems;

      setTimeout(() => {
        if (isAllProcessed) setMeterialReceiveReprintList([]);
        else getMaterialReceiveReprintListByVendor();
      }, 700);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Reprint failed!",
        text: "An error occurred while printing. Please try again.",
        confirmButtonText: "OK",
      });
    }
  };

  const renderTableHeader = () => (
    <tr>
      <th>
        <label className="ml-1">Select All (Page)</label>
        <br />
        <input
          type="checkbox"
          style={{ transform: "scale(1.5)", cursor: "pointer" }}
          onChange={handleSelectAllCheckbox}
          checked={areAllCurrentPageItemsSelected()}
        />
      </th>
      <th>#</th>
      <th>Receive Date</th>
      <th>Vendor</th>
      <th>Vendor Name</th>
      <th>Master Invoice No</th>
      <th>Pallet ID</th>
      <th>Case No</th>
      <th>Lot No</th>
      <th>Quantity</th>
      <th>Unit</th>
      <th>Width</th>
      <th>Spec</th>
      <th>Size</th>
      <th>Status</th>
      <th>Location</th>
      <th>Zone</th>
    </tr>
  );

  const renderTableBody = () => {
    if (!Array.isArray(meterialReceiveReprintList) || meterialReceiveReprintList.length === 0) {
      return (
        <tr className="no-data-row">
          <td colSpan="17" className="no-data-cell">
            ⌨️ Please Select Vendor.
          </td>
        </tr>
      );
    }

    return currentItems.map((item, index) => (
      <tr key={startIndex + index}>
        <td>
          <input
            type="checkbox"
            style={{ transform: "scale(1.5)", cursor: "pointer" }}
            checked={item.selected || false}
            onChange={() => handleRowSelectChange(index)}
          />
        </td>
        <td>{startIndex + index + 1}</td>
        <td>{item.receiveDate}</td>
        <td>{item.vendor}</td>
        <td>{item.vendorName}</td>
        <td>{item.masterInvoiceNo}</td>
        <td>{item.boxNo}</td>
        <td>{item.caseNo}</td>
        <td>{item.lotNo}</td>
        <td>{item.quantity}</td>
        <td>{item.unit}</td>
        <td>{item.width}</td>
        <td>{item.spec}</td>
        <td>{item.size}</td>
        <td style={{ textTransform: "capitalize" }}>{item.status}</td>
        <td>{item.location}</td>
        <td>{item.zone}</td>
      </tr>
    ));
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    return (
      <div className="d-flex justify-content-center align-items-center mt-3">
        <nav aria-label="Page navigation">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>
                Previous
              </button>
            </li>

            {startPage > 1 && (
              <>
                <li className="page-item">
                  <button className="page-link" onClick={() => goToPage(1)}>
                    1
                  </button>
                </li>
                {startPage > 2 && (
                  <li className="page-item disabled">
                    <span className="page-link">...</span>
                  </li>
                )}
              </>
            )}

            {pageNumbers.map((number) => (
              <li key={number} className={`page-item ${currentPage === number ? "active" : ""}`}>
                <button className="page-link" onClick={() => goToPage(number)}>
                  {number}
                </button>
              </li>
            ))}

            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && (
                  <li className="page-item disabled">
                    <span className="page-link">...</span>
                  </li>
                )}
                <li className="page-item">
                  <button className="page-link" onClick={() => goToPage(totalPages)}>
                    {totalPages}
                  </button>
                </li>
              </>
            )}

            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}>
                Next
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  };

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">VMI</li>
                <li className="breadcrumb-item active">
                  <Link to="#" className="color-link">
                    REPRINT RECEIVE
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col">
            <div className="card angle gap-margin">
              <div className="card-header card-receive">REPRINT MATERIAL LIST</div>

              <div className="card-body gap-margin">
                <div className="controls-3rows">
                  <div className="row gx-3 gy-2 align-items-end">
                    <div className="col-12 col-md-5">
                      <div className="vp-field" style={{ display: "grid", gap: 6 }}>
                        <span className="vp-label">Vendor Name</span>
                        <select
                          name="vendorMaster"
                          className="form-control angle"
                          value={selectedVendorMaster}
                          onChange={handleVendorMasterChange}
                        >
                          <option value="">Select Vendor</option>
                          {vendorMaster.map((vm, index) => (
                            <option key={index} value={vm.vendorMasterId}>
                              {vm.vendorMasterName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ====== SCROLLABLE TABLE WRAPPER ====== */}
                <div className="table-container mt-3">
                  <div className="table-scroll">
                    <table className="table table-custom table-compact">
                      <colgroup>
                        <col className="reprint-col-select" />
                        <col className="reprint-col-idx" />
                        <col className="reprint-col-date" />
                        <col className="reprint-col-vendor" />
                        <col className="reprint-col-vendor-name" />
                        <col className="reprint-col-mi" />
                        <col className="reprint-col-pallet" />
                        <col className="reprint-col-case" />
                        <col className="reprint-col-lot" />
                        <col className="reprint-col-qty" />
                        <col className="reprint-col-unit" />
                        <col className="reprint-col-width" />
                        <col className="reprint-col-spec" />
                        <col className="reprint-col-size" />
                        <col className="reprint-col-status" />
                        <col className="reprint-col-location" />
                        <col className="reprint-col-zone" />
                      </colgroup>
                      <thead className="text-center">{renderTableHeader()}</thead>
                      <tbody>{renderTableBody()}</tbody>
                    </table>
                  </div>
                </div>

                {renderPagination()}

                <div className="mt-3">
                  <button
                    className="btn btn-info angle"
                    onClick={inboundReceiveReprint}
                    style={{ fontSize: "12px", width: "154px", height: "42px", padding: "10px 20px" }}
                  >
                    Reprint
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
}
