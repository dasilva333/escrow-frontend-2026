"use client";

import { useState } from "react";
import { Camera, Upload, AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import api from "@/lib/axios";
import { toast } from "sonner";

interface Props {
  onSuccess: (leaseId: number) => void;
  onCancel: () => void;
}

export default function IngestContractCamera({ onSuccess, onCancel }: Props) {
  const [page1, setPage1] = useState<File | null>(null);
  const [page2, setPage2] = useState<File | null>(null);
  const [page3, setPage3] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [pollingStatus, setPollingStatus] = useState<string>("PENDING");

  const [parsedData, setParsedData] = useState<any>(null);
  const [confidences, setConfidences] = useState<any>(null);
  const [leaseId, setLeaseId] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, page: 1 | 2 | 3) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (page === 1) setPage1(file);
      else if (page === 2) setPage2(file);
      else if (page === 3) setPage3(file);
    }
  };

  const handleUpload = async () => {
    if (!page1 || !page2 || !page3) {
      toast.error("Please upload all 3 pages of the lease contract.");
      return;
    }

    setLoading(true);
    setStatusMessage("Uploading images and queuing background processing task...");
    
    const formData = new FormData();
    formData.append("page1", page1);
    formData.append("page2", page2);
    formData.append("page3", page3);

    try {
      const response = await api.post("/lease_contracts/ingest", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data && response.data.success) {
        const taskId = response.data.task_id;
        startPolling(taskId);
      } else {
        throw new Error(response.data.message || "Failed to initialize task");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload pages");
      setLoading(false);
    }
  };

  const startPolling = async (taskId: string) => {
    setStatusMessage("Analyzing page layouts and running OCR alignments...");
    
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/lease_contracts/ingest/status/${taskId}`);
        if (res.data && res.data.success) {
          const status = res.data.status;
          setPollingStatus(status);

          if (status === "PROCESSING") {
            setStatusMessage("Extracting lease terms and verifying values...");
          } else if (status === "SUCCESS") {
            clearInterval(interval);
            setLeaseId(res.data.lease_id);
            setParsedData(res.data.data);
            setConfidences(res.data.confidences);
            setLoading(false);
            toast.success("Lease contract ingested successfully!");
          } else if (status === "FAILED") {
            clearInterval(interval);
            setLoading(false);
            toast.error(res.data.message || "Ingestion pipeline failed");
          }
        }
      } catch (err) {
        clearInterval(interval);
        setLoading(false);
        toast.error("Error polling ingestion status");
      }
    }, 1500);
  };

  const handleConfirm = async () => {
    // If the user confirms/edits, we can save or proceed to details
    if (leaseId) {
      onSuccess(leaseId);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setParsedData((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">Camera Lease Ingestion</h2>
        <p className="text-gray-500 text-sm mt-1">Capture or upload the 3 pages of your lease contract to automatically extract details.</p>
      </div>

      {!loading && !parsedData && (
        <div className="grid grid-cols-3 gap-4 mt-4">
          {[1, 2, 3].map((page) => {
            const file = page === 1 ? page1 : page === 2 ? page2 : page3;
            return (
              <div key={page} className="flex flex-col items-center border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, page as 1 | 2 | 3)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Camera className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-semibold text-gray-700">Page {page}</span>
                <span className="text-xs text-gray-400 mt-1 text-center truncate w-full">
                  {file ? file.name : "Select Image"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-10 gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <span className="text-sm font-medium text-gray-600 animate-pulse">{statusMessage}</span>
        </div>
      )}

      {parsedData && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-green-600 font-semibold bg-green-50 p-3 rounded-lg border border-green-200">
            <CheckCircle className="w-5 h-5" />
            <span>Extracted Lease Terms</span>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col gap-4">
            {Object.entries(parsedData).map(([key, val]) => {
              const rawConf = confidences?.[key.replace("lease_", "")] || 0.0;
              const confidence = rawConf * 100;
              const isLowConfidence = confidence < 70;
              const isMissing = val === "Not Found" || val === "" || val === "0";

              return (
                <div key={key} className="flex flex-col gap-1 border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-600">{key.replace("lease_", "").replace(/_/g, " ").toUpperCase()}</span>
                    <span className={`font-bold flex items-center gap-1 ${isLowConfidence ? "text-yellow-600" : "text-gray-400"}`}>
                      {isLowConfidence && <AlertTriangle className="w-3.5 h-3.5" />}
                      Confidence: {confidence.toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="text"
                    value={val as string}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    className={`w-full text-sm border rounded p-2 focus:outline-none focus:ring-2 ${
                      isMissing ? "border-red-300 bg-red-50 focus:ring-red-400" : 
                      isLowConfidence ? "border-yellow-300 bg-yellow-50 focus:ring-yellow-400" : 
                      "border-gray-300 focus:ring-blue-400"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-4 border-t border-gray-100 pt-4">
        {!parsedData ? (
          <>
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={loading || !page1 || !page2 || !page3}>
              Ingest Document
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => { setParsedData(null); setLeaseId(null); }}>
              <RefreshCw className="w-4 h-4 mr-1.5" /> Re-scan
            </Button>
            <Button onClick={handleConfirm}>
              Approve & Finalize
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
