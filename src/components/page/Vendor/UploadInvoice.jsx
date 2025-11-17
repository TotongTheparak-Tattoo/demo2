import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiUpload, 
  FiFileText, 
  FiX, 
  FiFile
} from 'react-icons/fi';
import { httpClient } from "../../../utils/HttpClient";
import Papa from 'papaparse';
import Swal from 'sweetalert2';
import './UploadInvoice.css';

export default function UploadInvoice() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (file) => {
    if (file && file.type === 'text/csv') {
      if (file.size > 15 * 1024 * 1024) { // 15MB limit
        Swal.fire({
          icon: 'error',
          title: 'The file is too large !',
          text: 'File size must not exceed 15MB',
          confirmButtonColor: '#dc3545'
        });
        return;
      }
      setSelectedFile(file);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Invalid file.',
        text: 'Please select a CSV file only.',
        confirmButtonColor: '#dc3545'
      });
    }
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Handle file input change
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Parse CSV data using Papa Parse
  const parseCSVWithPapa = (csvText) => {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep all values as strings to match backend expectation
        transform: (value, header) => {
          // Trim whitespace from all values and headers
          return typeof value === 'string' ? value.trim() : value;
        },
        transformHeader: (header) => {
          // Clean headers - remove extra spaces and quotes
          return header.trim().replace(/^["']|["']$/g, '');
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
            // Filter out only critical errors, ignore warnings
            const criticalErrors = results.errors.filter(error => 
              error.type === 'FieldMismatch' && error.code === 'TooFewFields'
            );
            if (criticalErrors.length > 0) {
              reject(new Error(`CSV parsing error: ${criticalErrors[0].message}`));
              return;
            }
          }
          
          // Validate data
          if (!results.data || results.data.length === 0) {
            reject(new Error('The CSV file no data.'));
            return;
          }

          // Clean data - remove any completely empty rows
          const cleanData = results.data.filter(row => {
            return Object.values(row).some(value => value && value.trim() !== '');
          });

          if (cleanData.length === 0) {
            reject(new Error('The CSV file contains no valid data.'));
            return;
          }

          console.log('Parsed CSV data:', cleanData);
          resolve(cleanData);
        },
        error: (error) => {
          reject(new Error(`An error occurred while reading CSV: ${error.message}`));
        }
      });
    });
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      // Show loading
      Swal.fire({
        title: 'Uploading...',
        text: 'Please wait a moment.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Read file content
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(selectedFile);
      });

      // Parse CSV
      const csvData = await parseCSVWithPapa(fileContent);
      
      if (csvData.length === 0) {
        throw new Error('The CSV file contains no valid data.');
      }

      // Send to backend
      const response = await httpClient.post('/api/v1/upload/upload_product', {
        data: csvData,
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("TOKEN")}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.status === 200) {
        await Swal.fire({
          icon: 'success',
          title: 'Upload successful!',
          text: `Data processing completed successfully ${csvData.length} list.`,
          confirmButtonColor: '#28a745'
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error(response.result || 'An error occurred during upload.');
      }
    } catch (error) {
      
    } finally {
      setUploading(false);
    }
  };

  // Clear file
  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">VENDOR</li>
                <li className="breadcrumb-item active">
                  <Link to="#" className="color-link">
                    UPLOAD INVOICE
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col">
            <div className="card angle gap-margin">
              <div className="card-header card-receive">
                <FiFileText className="header-icon" />
                UPLOAD INVOICE CSV
              </div>
              <div className="card-body gap-margin">
                
                {/* Upload Section */}
                <div className="upload-section">
                  <div
                    className={`upload-area ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleChange}
                      className="file-input"
                    />
                    
                    {!selectedFile ? (
                      <div className="upload-content">
                        <FiUpload className="upload-icon" />
                        <div className="upload-text">
                          <h5 className="upload-title">Select CSV file</h5>
                          <p className="upload-subtitle">Click to select a file or drag and drop it here</p>
                          <small className="upload-info">Supports CSV files up to 1MB</small>
                        </div>
                      </div>
                    ) : (
                      <div className="selected-file-display">
                        <FiFile className="file-display-icon" />
                        <div className="file-info">
                          <div className="file-name">{selectedFile.name}</div>
                          <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearFile();
                          }}
                          className="file-remove-btn"
                        >
                          <FiX />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="action-buttons">
                    <button
                      type="button"
                      onClick={clearFile}
                      disabled={!selectedFile || uploading}
                      className="btn btn-outline-secondary"
                    >
                      <FiX className="btn-icon" />
                      Delete File 
                    </button>
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading}
                      className="btn btn-primary"
                    >
                      <FiUpload className="btn-icon" />
                      {uploading ? 'Loading...' : 'Upload'}
                    </button>
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