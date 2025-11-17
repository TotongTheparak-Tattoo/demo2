import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";

export default function EntryNoUpload() {
    const [loading, setLoading] = useState(false);
    const [masterInvoices, setMasterInvoices] = useState([]);
    const [selectedMasterInvoice, setSelectedMasterInvoice] = useState("");
    const [entryNo, setEntryNo] = useState("");
    const [partialInvoices, setPartialInvoices] = useState([]);
    const [selectedPartialInvoice, setSelectedPartialInvoice] = useState("");
    const [exportEntryNo, setExportEntryNo] = useState("");

    const authHeaders = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
    });

    const loadMasterInvoices = async () => {
        setLoading(true);
        try {
            const resp = await httpClient.get(
                "/api/v1/productdetails/master-invoices",
                authHeaders()
            );
            const list = Array.isArray(resp?.data?.result)
                ? resp.data.result
                : Array.isArray(resp?.data?.rows)
                    ? resp.data.rows
                    : Array.isArray(resp?.data)
                        ? resp.data
                        : [];
            setMasterInvoices(list);
        } catch (err) {
            console.error("[EntryNoUpload] loadMasterInvoices error:", err);
            await Swal.fire({
                icon: "error",
                title: "Load failed",
                text: err?.response?.data?.message || err?.message || "Failed to load master invoices.",
            });
        } finally {
            setLoading(false);
        }
    };

    const loadPartialInvoices = async () => {
        setLoading(true);
        try {
            const resp = await httpClient.get(
                "/api/v1/mrrequest/partial-invoices",
                authHeaders()
            );
            const list = Array.isArray(resp?.data?.result)
                ? resp.data.result
                : Array.isArray(resp?.data?.rows)
                    ? resp.data.rows
                    : Array.isArray(resp?.data)
                        ? resp.data
                        : [];
            setPartialInvoices(list);
        } catch (err) {
            console.error("[EntryNoUpload] loadPartialInvoices error:", err);
            await Swal.fire({
                icon: "error",
                title: "Load failed",
                text: err?.response?.data?.message || err?.message || "Failed to load partial invoices.",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMasterInvoices();
        loadPartialInvoices();
    }, []);

    const onSubmit = async () => {
        const mi = String(selectedMasterInvoice || "").trim();
        const en = String(entryNo || "").trim();
        if (!mi) {
            await Swal.fire({ icon: "warning", title: "Please select Master Invoice" });
            return;
        }
        if (!en) {
            await Swal.fire({ icon: "warning", title: "Please enter Import Entry No" });
            return;
        }

        setLoading(true);
        try {
            const payload = { masterInvoiceNo: mi, importEntryNo: en };
            console.log("[EntryNoUpload] PATCH payload:", payload);
            const resp = await httpClient.patch(
                "/api/v1/productdetails/import-entry",
                payload,
                authHeaders()
            );
            console.log("[EntryNoUpload] PATCH response:", resp?.data);
            await Swal.fire({
                icon: "success",
                title: "Saved",
                text: resp?.data?.message || "Import entry saved successfully.",
                timer: 1800,
                showConfirmButton: false,
            });
            setEntryNo("");
            setSelectedMasterInvoice("");
            await loadMasterInvoices();
        } catch (err) {
            console.error("[EntryNoUpload] submit error:", err);
            await Swal.fire({
                icon: "error",
                title: "Save failed",
                text:
                    (err?.response?.data && (err.response.data.message || err.response.data.error)) ||
                    err?.message ||
                    "Could not submit entry.",
            });
        } finally {
            setLoading(false);
        }
    };

    const onSubmitExport = async () => {
        const pi = String(selectedPartialInvoice || "").trim();
        const en = String(exportEntryNo || "").trim();
        if (!pi) {
            await Swal.fire({ icon: "warning", title: "Please select Partial Invoice" });
            return;
        }
        if (!en) {
            await Swal.fire({ icon: "warning", title: "Please enter Export Entry No" });
            return;
        }

        setLoading(true);
        try {
            const payload = { partialInvoice: pi, exportEntryNo: en };
            console.log("[EntryNoUpload] PATCH export payload:", payload);
            const resp = await httpClient.patch(
                "/api/v1/mrrequest/export-entry",
                payload,
                authHeaders()
            );
            console.log("[EntryNoUpload] PATCH export response:", resp?.data);
            await Swal.fire({
                icon: "success",
                title: "Saved",
                text: resp?.data?.message || "Export entry saved successfully.",
                timer: 1800,
                showConfirmButton: false,
            });
            setExportEntryNo("");
            setSelectedPartialInvoice("");
            await loadPartialInvoices();
        } catch (err) {
            console.error("[EntryNoUpload] export submit error:", err);
            await Swal.fire({
                icon: "error",
                title: "Save failed",
                text:
                    (err?.response?.data && (err.response.data.message || err.response.data.error)) ||
                    err?.message ||
                    "Could not submit export entry.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wrapper" style={{ overflowX: "hidden" }}>
            <div className="content-wrapper">
                <div className="container-fluid">
                    <div className="row">
                        <div className="col" style={{ marginTop: "5px" }}>
                            <ol className="breadcrumb float-mb-left angle">
                                <li className="breadcrumb-item">MASTER</li>
                                <li className="breadcrumb-item active">
                                    <Link to="#" className="color-link">ENTRY NO UPLOAD</Link>
                                </li>
                            </ol>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col">
                            <div className="card angle gap-margin">
                                <div className="card-header card-void">IMPORT ENTRY UPLOAD</div>
                                <div className="card-body gap-margin">
                                    <div className="row gx-3 gy-2 align-items-end">
                                        <div className="col-12 col-md-6">
                                            <label className="vp-field" style={{ display: "grid", gap: 6 }}>
                                                <span className="vp-label">Master Invoice</span>
                                                <select
                                                    className="form-control angle"
                                                    value={selectedMasterInvoice}
                                                    onChange={(e) => setSelectedMasterInvoice(e.target.value)}
                                                    disabled={loading}
                                                >
                                                    <option value="">Select master invoice</option>
                                                    {masterInvoices.map((it, idx) => {
                                                        const value =
                                                            typeof it === "string"
                                                                ? it
                                                                : it?.masterInvoiceNo || it?.masterInvoice || it?.invoiceNo || it?.invoice;
                                                        const label = value || (typeof it === "string" ? it : JSON.stringify(it));
                                                        return (
                                                            <option key={idx} value={String(value || "").trim()}>{String(label || "").trim()}</option>
                                                        );
                                                    })}
                                                </select>
                                            </label>
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="vp-field" style={{ display: "grid", gap: 6 }}>
                                                <span className="vp-label">Import Entry No</span>
                                                <input
                                                    type="text"
                                                    className="form-control angle"
                                                    value={entryNo}
                                                    onChange={(e) => setEntryNo(e.target.value)}
                                                    placeholder="Enter import entry no"
                                                    disabled={loading}
                                                />
                                            </label>
                                        </div>

                                        <label className="vp-field" style={{ display: "grid", gap: 6 }}>
                                            <div className="col-12 col-md-2">
                                                <button className="btn btn-primary angle" onClick={onSubmit} disabled={loading}>
                                                    {loading ? "Saving..." : "Submit"}
                                                </button>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="card angle gap-margin">
                                <div className="card-header card-void">EXPORT ENTRY UPLOAD</div>
                                <div className="card-body gap-margin">
                                    <div className="row gx-3 gy-2 align-items-end">
                                        <div className="col-12 col-md-6">
                                            <label className="vp-field" style={{ display: "grid", gap: 6 }}>
                                                <span className="vp-label">Partial Invoice</span>
                                                <select
                                                    className="form-control angle"
                                                    value={selectedPartialInvoice}
                                                    onChange={(e) => setSelectedPartialInvoice(e.target.value)}
                                                    disabled={loading}
                                                >
                                                    <option value="">Select partial invoice</option>
                                                    {partialInvoices.map((it, idx) => {
                                                        const value =
                                                            typeof it === "string"
                                                                ? it
                                                                : it?.partialInvoiceNo || it?.partialInvoice || it?.invoiceNo || it?.invoice;
                                                        const label = value || (typeof it === "string" ? it : JSON.stringify(it));
                                                        return (
                                                            <option key={idx} value={String(value || "").trim()}>{String(label || "").trim()}</option>
                                                        );
                                                    })}
                                                </select>
                                            </label>
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="vp-field" style={{ display: "grid", gap: 6 }}>
                                                <span className="vp-label">Export Entry No</span>
                                                <input
                                                    type="text"
                                                    className="form-control angle"
                                                    value={exportEntryNo}
                                                    onChange={(e) => setExportEntryNo(e.target.value)}
                                                    placeholder="Enter export entry no"
                                                    disabled={loading}
                                                />
                                            </label>
                                        </div>

                                        <label className="vp-field" style={{ display: "grid", gap: 6 }}>
                                            <div className="col-12 col-md-2">
                                                <button className="btn btn-primary angle" onClick={onSubmitExport} disabled={loading}>
                                                    {loading ? "Saving..." : "Submit"}
                                                </button>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


