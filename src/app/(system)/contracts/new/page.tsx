import NewContract from "@/components/contracts/NewContract";
import IngestContractCamera from "@/components/contracts/IngestContractCamera";
import api from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ContractsNewPage() {
  const { userLoggedIn } = useAuthStore();
  const [useCamera, setUseCamera] = useState(false);
  const router = useRouter();

  const getContracts = async () => {
    await api.get(`/lease_contracts_by_brokers/${userLoggedIn?.user_id}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  useEffect(() => {
    if (userLoggedIn?.user_id) {
      getContracts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoggedIn?.user_id]);

  const handleIngestSuccess = (leaseId: number) => {
    router.push("/contracts");
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex justify-between items-center px-6">
        <h1 className="text-xl font-bold text-gray-800">Create Lease Contract</h1>
        <button
          onClick={() => setUseCamera(!useCamera)}
          className="text-xs font-semibold px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
        >
          {useCamera ? "Switch to Manual Wizard" : "Switch to Camera Ingestion"}
        </button>
      </div>

      {useCamera ? (
        <IngestContractCamera
          onSuccess={handleIngestSuccess}
          onCancel={() => setUseCamera(false)}
        />
      ) : (
        <NewContract onLoading={getContracts} />
      )}
    </div>
  );
}

