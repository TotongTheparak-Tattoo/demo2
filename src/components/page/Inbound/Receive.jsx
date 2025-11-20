import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Select from "react-select";
import { handlePrintPalletLabels } from "../../../utils/PrintPalletNote";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./Receive.css";

export default function Receive() {
  const navigate = useNavigate();

  const [selectedVendorMaster, setselectedVendorMaster] = useState("");
  const [vendorMaster, setVendorMaster] = useState([]);
  const [meterialReceiveList, setMeterialReceiveList] = useState([]);
  const [selectUnit, setSelectUnit] = useState("coil");
  const [location, setLocation] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [assignLocationMethod, setAssignLocationMethod] = useState("auto");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isPrinting, setIsPrinting] = useState(false);

  const tableRef = useRef(null);
  const printTimeoutRef = useRef(null);

  useEffect(() => {
    getVendorMaster();
    
    return () => {
      if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedVendorMaster) {
      getMaterialReceiveListByVendor();
      getLocation();
      setCurrentPage(1);
    }
  }, [selectedVendorMaster]);

  useEffect(() => {
    if (selectUnit && selectedVendorMaster) {
      getLocation();
    }
  }, [selectUnit, selectedVendorMaster]);

  const filteredMaterialReceiveList = selectUnit
    ? meterialReceiveList.filter(
      (item) => item.unit?.toLowerCase() === selectUnit.toLowerCase()
    )
    : meterialReceiveList;

  const totalPages = Math.ceil(filteredMaterialReceiveList.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredMaterialReceiveList.slice(startIndex, endIndex);

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
      if (response.status === 500) {
        Swal.fire({
          title: "Info!",
          text: response.data.detail,
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (error) {
    }
  };

  const getLocation = async () => {
    try {
      const response = await httpClient.get(`/api/v1/location/get_available_location`, {
        params: { selectUnit },
      });
      const valuesArray = Object.values(response.data.result).map((item) => ({
        locationCode: item.locationCode,
        locationId: item.locationId,
      }));
      if (response.status === 200) setLocation(valuesArray);
      if (response.status === 500) {
        Swal.fire({
          title: "Info!",
          text: response.data.detail,
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (error) {
    }
  };

  const getMaterialReceiveListByVendor = async () => {
    try {
      const response = await httpClient.get(
        `/api/v1/inbound/receive/get_material_receive_list_by_vendor`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN")}` },
          params: { vendorId: selectedVendorMaster },
        }
      );

      if (response.status === 200) {
        const result = response.data.result || [];
        setMeterialReceiveList(
          result.map((r) => ({ ...r, selected: !!r.selected }))
        );
        tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
      } else if (response.status === 500) {
        Swal.fire({
          title: "Info!",
          text: response.data.detail,
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (error) {
      setMeterialReceiveList([]);
      setselectedVendorMaster("");
      console.log("Error", error);
    }
  };

  const handleAssignLocationMethodChange = (e) => {
    setAssignLocationMethod(e.target.value);
    setMeterialReceiveList((list) => list.map((it) => ({ ...it, selected: false })));
  };

  const handleSelectUnitChange = (e) => {
    setSelectUnit(e.target.value);
    setCurrentPage(1);
    setMeterialReceiveList((list) => list.map((it) => ({ ...it, selected: false })));
  };

  const handleSelectAllCheckbox = () => {
    if (assignLocationMethod === "manual") return;
    const allCurrentPageSelected = currentItems.every((item) => item.selected);
    const filteredIndices = [];
    let filteredIndex = 0;
    meterialReceiveList.forEach((item, index) => {
      if (!selectUnit || item.unit?.toLowerCase() === selectUnit.toLowerCase()) {
        if (filteredIndex >= startIndex && filteredIndex < endIndex) {
          filteredIndices.push(index);
        }
        filteredIndex++;
      }
    });

    setMeterialReceiveList((prev) => {
      const updated = [...prev];
      filteredIndices.forEach((idx) => {
        updated[idx] = { ...updated[idx], selected: !allCurrentPageSelected };
      });
      return updated;
    });
  };

  const handleRowSelectChange = (rowIndexOnPage) => {
    const actualFilteredIndex = startIndex + rowIndexOnPage;

    let filteredIndex = 0;
    let actualIndex = -1;

    meterialReceiveList.forEach((item, index) => {
      if (!selectUnit || item.unit?.toLowerCase() === selectUnit.toLowerCase()) {
        if (filteredIndex === actualFilteredIndex) actualIndex = index;
        filteredIndex++;
      }
    });

    if (actualIndex === -1) return;

    setMeterialReceiveList((prev) => {
      const updated = [...prev];
      if (assignLocationMethod === "manual") {
        const willSelect = !updated[actualIndex].selected;
        for (let i = 0; i < updated.length; i++) updated[i] = { ...updated[i], selected: false };
        updated[actualIndex] = { ...updated[actualIndex], selected: willSelect };
      } else {
        updated[actualIndex] = { ...updated[actualIndex], selected: !updated[actualIndex].selected };
      }
      return updated;
    });
  };
  
  const areAllCurrentPageItemsSelected = () =>
    currentItems.length > 0 && currentItems.every((item) => item.selected);
  const goToPage = (pageNumber) => setCurrentPage(pageNumber);
  const goToPreviousPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const goToNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));

  const inboundReceivePrint = async () => {
    if (!selectedVendorMaster) {
      Swal.fire({
        icon: "warning",
        title: "vendor not selected!",
        text: "Please select a vendor before print.",
        confirmButtonText: "OK",
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    if (assignLocationMethod === "manual" && !selectedLocation) {
      Swal.fire({
        icon: "warning",
        title: "location not selected!",
        text: "Please select a location before print.",
        confirmButtonText: "OK",
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const selectedItems = filteredMaterialReceiveList.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      Swal.fire({
        icon: "info",
        title: "No selection",
        text: "Please select at least one row.",
      });
      return;
    }

    const dataReq = selectedItems.map((item) => ({
      vendor: item.vendor,
      masterInvoiceNo: item.masterInvoiceNo,
      caseNo: item.caseNo,
      lotNo: item.lotNo,
      quantity: item.quantity,
      unit: item.unit,
      width: item.width,
      spec: item.spec,
      size: item.size,
      grossWeight: item.grossWeight,
    }));

    const payload = {
      assignLocationMethod,
      vendorId: selectedVendorMaster,
      dataSelect: dataReq,
      selectUnit,
      ...(assignLocationMethod === "manual" ? { selectLocation: selectedLocation } : {}),
    };

    setIsPrinting(true);

    printTimeoutRef.current = setTimeout(() => {
      setIsPrinting(false);
      Swal.fire({
        icon: "error",
        title: "Print Timeout",
        text: "การพิมพ์ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง",
        confirmButtonText: "OK",
      });
    }, 10000); // 10 วินาที

    try {
      const response = await httpClient.post(
        `/api/v1/inbound/receive/submit_print_receive`,
        payload,
        { headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN")}` } }
      );

      if (response.status === 200) {
        try {
          await handlePrintPalletLabels(response.data);
          
          if (printTimeoutRef.current) {
            clearTimeout(printTimeoutRef.current);
            printTimeoutRef.current = null;
          }
          
          const totalItems = filteredMaterialReceiveList.length;
          const selectedItemsCount = selectedItems.length;
          const isAllProcessed = selectedItemsCount === totalItems;

          setTimeout(() => {
            if (isAllProcessed) {
              setMeterialReceiveList([]);
              if (assignLocationMethod === "manual") setSelectedLocation("");
            } else {
              getMaterialReceiveListByVendor();
              if (assignLocationMethod === "manual") setSelectedLocation("");
            }

            setIsPrinting(false);
          }, 500);
        } catch (printError) {
          console.error("Error generating print labels:", printError);
          
          if (printTimeoutRef.current) {
            clearTimeout(printTimeoutRef.current);
            printTimeoutRef.current = null;
          }
          
          setIsPrinting(false);
          
          Swal.fire({
            icon: "error",
            title: "Print Generation Failed",
            text: "Error generating label: " + (printError.message || "Unknown error"),
            confirmButtonText: "OK",
          });
          return;
        }
      } else if (response.status === 500) {
        if (printTimeoutRef.current) {
          clearTimeout(printTimeoutRef.current);
          printTimeoutRef.current = null;
        }
        
        setIsPrinting(false);
        
        Swal.fire({
          title: "Info!",
          text: response.data.result,
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (error) {
      console.error("Error print receive form:", error);
      
      if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current);
        printTimeoutRef.current = null;
      }
      
      setIsPrinting(false);
      
      if (assignLocationMethod === "manual") setSelectedLocation("");
    }
  };

  const renderTableHeader = () => (
    <tr>
      <th>
        {assignLocationMethod === "auto" ? (
          <>
            <label className="ml-1">Select All (Page)</label>
            <br />
            <input
              type="checkbox"
              className="chk-lg"
              onChange={handleSelectAllCheckbox}
              checked={areAllCurrentPageItemsSelected()}
              disabled={isPrinting} // disable checkbox ขณะ print
            />
          </>
        ) : (
          <label className="ml-1">Select One Only</label>
        )}
      </th>
      <th>#</th>
      <th>Receive Date</th>
      <th>Vendor</th>
      <th>Vendor Name</th>
      <th>Master Invoice No</th>
      <th>Pallet ID</th>
      <th>Case No</th>
      <th>PoNo</th>
      <th>Lot No</th>
      <th>Quantity</th>
      <th>Unit</th>
      <th>Width</th>
      <th>Spec</th>
      <th>Size</th>
      <th>Gross Weight</th>
      <th>Import Entry No</th>
    </tr>
  );

  const renderTableBody = () => {
    if (!Array.isArray(meterialReceiveList) || meterialReceiveList.length === 0) {
      return (
        <tr className="no-data-row">
          <td colSpan={17} className="no-data-cell">⌨️ Please Select Vendor.</td>
        </tr>
      );
    }
    if (filteredMaterialReceiveList.length === 0) {
      return (
        <tr className="no-data-row">
          <td colSpan={17} className="no-data-cell">📦 No data available for selected unit.</td>
        </tr>
      );
    }

    return currentItems.map((item, index) => (
      <tr key={startIndex + index}>
        <td className="col-select-cell">
          <input
            type={assignLocationMethod === "manual" ? "radio" : "checkbox"}
            name={assignLocationMethod === "manual" ? "manualSelection" : undefined}
            className="chk-lg"
            checked={item.selected || false}
            onChange={() => handleRowSelectChange(index)}
            disabled={isPrinting}
          />
        </td>
        <td className="num">{startIndex + index + 1}</td>
        <td>{item.receiveDate}</td>
        <td>{item.vendor}</td>
        <td>{item.vendorName}</td>
        <td>{item.masterInvoiceNo}</td>
        <td>{item.boxNo}</td>
        <td>{item.caseNo}</td>
        <td>{item.poNo}</td>
        <td>{item.lotNo}</td>
        <td>{item.quantity}</td>
        <td>{item.unit}</td>
        <td>{item.width}</td>
        <td>{item.spec}</td>
        <td>{item.size}</td>
        <td>{item.grossWeight}</td>
        <td>{item.importEntryNo}</td>
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
              <button className="page-link" onClick={goToPreviousPage} disabled={currentPage === 1 || isPrinting}>
                Previous
              </button>
            </li>

            {startPage > 1 && (
              <>
                <li className="page-item">
                  <button className="page-link" onClick={() => goToPage(1)} disabled={isPrinting}>1</button>
                </li>
                {startPage > 2 && <li className="page-item disabled"><span className="page-link">...</span></li>}
              </>
            )}

            {pageNumbers.map((number) => (
              <li key={number} className={`page-item ${currentPage === number ? "active" : ""}`}>
                <button className="page-link" onClick={() => goToPage(number)} disabled={isPrinting}>
                  {number}
                </button>
              </li>
            ))}

            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && <li className="page-item disabled"><span className="page-link">...</span></li>}
                <li className="page-item">
                  <button className="page-link" onClick={() => goToPage(totalPages)} disabled={isPrinting}>{totalPages}</button>
                </li>
              </>
            )}

            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={goToNextPage} disabled={currentPage === totalPages || isPrinting}>
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
                  <Link to="#" className="color-link">RECEIVE</Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col">
            <div className="card angle gap-margin">
              <div className="card-header card-receive">MATERIAL RECEIVE LIST</div>

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
                          disabled={isPrinting} // disable dropdown ขณะ print
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
                  <div className="row gx-3 gy-2 mt-2">
                    <div className="col-12">
                      <div className="vp-field" style={{ display: "grid", gap: 6 }}>
                        <span className="vp-label">Select Unit</span>
                        <div style={{ display: "flex", gap: 24, paddingTop: 4 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="radio"
                              id="coil"
                              value="coil"
                              checked={selectUnit === "coil"}
                              onChange={handleSelectUnitChange}
                              disabled={isPrinting}
                            />
                            <span>Coil</span>
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="radio"
                              id="pcs"
                              value="pcs"
                              checked={selectUnit === "pcs"}
                              onChange={handleSelectUnitChange}
                              disabled={isPrinting}
                            />
                            <span>Bar</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="row gx-3 gy-2 mt-2 align-items-end">
                    <div className="col-12 col-md-6">
                      <div className="vp-field" style={{ display: "grid", gap: 6 }}>
                        <span className="vp-label">Assign Location method</span>
                        <div style={{ display: "flex", gap: 24, paddingTop: 4 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="radio"
                              id="auto"
                              value="auto"
                              checked={assignLocationMethod === "auto"}
                              onChange={handleAssignLocationMethodChange}
                              disabled={isPrinting}
                            />
                            <span>Auto</span>
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="radio"
                              id="manual"
                              value="manual"
                              checked={assignLocationMethod === "manual"}
                              onChange={handleAssignLocationMethodChange}
                              disabled={isPrinting}
                            />
                            <span>Manual</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-md-4">
                      {assignLocationMethod === "manual" && (
                        <div className="vp-field" style={{ display: "grid", gap: 6 }}>
                          <span className="vp-label">Assign Location</span>
                          <Select
                            styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                            menuPortalTarget={document.body}
                            options={location.map((item) => ({ value: item.locationId, label: item.locationCode }))}
                            value={
                              location.find((loc) => loc.locationId === selectedLocation)
                                ? {
                                  value: selectedLocation,
                                  label: location.find((loc) => loc.locationId === selectedLocation).locationCode,
                                }
                                : null
                            }
                            onChange={(opt) => setSelectedLocation(opt ? opt.value : "")}
                            placeholder="Assign Location"
                            isSearchable
                            isDisabled={isPrinting}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="table-wrapper table-h-scroll mt-3" ref={tableRef}>
                  <table className="table table-custom table-compact table-wide">
                    <colgroup>
                      <col className="col-r-select" />
                      <col className="col-r-idx" />
                      <col className="col-r-date" />
                      <col className="col-r-vendor" />
                      <col className="col-r-vendor-name" />
                      <col className="col-r-mi" />
                      <col className="col-r-pallet" />
                      <col className="col-r-case" />
                      <col className="col-r-po" />
                      <col className="col-r-lot" />
                      <col className="col-r-qty" />
                      <col className="col-r-unit" />
                      <col className="col-r-width" />
                      <col className="col-r-spec" />
                      <col className="col-r-size" />
                      <col className="col-r-gw" />
                      <col className="col-r-import" />
                    </colgroup>

                    <thead className="text-center">{renderTableHeader()}</thead>
                    <tbody>{renderTableBody()}</tbody>
                  </table>
                </div>
                {renderPagination()}
                <div className="actions-bottom d-flex justify-content-start mt-3">
                  <button 
                    className="btn btn-success angle" 
                    onClick={inboundReceivePrint} 
                    style={{ fontSize: 12 }}
                    disabled={isPrinting}
                  >
                    {isPrinting ? "Processing..." : "Print"}
                  </button>
                  <button 
                    className="btn btn-info angle" 
                    onClick={() => navigate("/vmi-inbound-reprint")} 
                    style={{ fontSize: 12 }}
                    disabled={isPrinting}
                  >
                    Reprint Page
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