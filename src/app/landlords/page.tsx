"use client";
import { useEffect, useState } from "react";
import type { Landlord } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { fileToDataUrl, getLandlords, saveLandlord } from "@/lib/localStore";

export default function LandlordsPage() {
  const [list, setList] = useState<Landlord[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setList(getLandlords());
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let signatureUrl: string | null = null;
      if (signatureFile) {
        signatureUrl = await fileToDataUrl(signatureFile);
      }

      const payload = {
        id: uuidv4(),
        name,
        address,
        signature_url: signatureUrl,
      };
      const landlord: Landlord = {
        id: payload.id,
        name: payload.name,
        address: payload.address,
        signature_url: payload.signature_url ?? undefined,
        created_at: new Date().toISOString(),
      };
      saveLandlord(landlord);
      setName("");
      setAddress("");
      setSignatureFile(null);
      setList(getLandlords());
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert("Failed to create landlord");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Landlords</h1>

      <form onSubmit={onCreate} className="grid gap-4 max-w-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm">Name</span>
            <input
              className="border rounded px-3 py-2 bg-transparent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm">Address (optional)</span>
            <input
              className="border rounded px-3 py-2 bg-transparent"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-sm">Default Signature Image (optional)</span>
          <input
            type="file"
            accept="image/*"
            className="border rounded px-3 py-2 bg-transparent"
            onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div>
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-foreground text-background disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Address</th>
              <th className="p-2">Signature</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="p-2">{l.name}</td>
                <td className="p-2">{l.address ?? "-"}</td>
                <td className="p-2">
                  {l.signature_url ? (
                    <img
                      src={l.signature_url}
                      alt="signature"
                      className="h-10"
                    />
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
