"use client";
import { useEffect, useState } from "react";
import type { Landlord } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import {
  fileToDataUrl,
  getLandlords,
  saveLandlord,
  clearLandlords,
  deleteLandlord,
} from "@/lib/localStore";

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
      let signatureName: string | null = null;
      if (signatureFile) {
        signatureUrl = await fileToDataUrl(signatureFile);
        signatureName = signatureFile.name ?? null;
      }

      const payload = {
        id: uuidv4(),
        name,
        address,
        signature_url: signatureUrl,
        signature_name: signatureName,
      };
      const landlord: Landlord = {
        id: payload.id,
        name: payload.name,
        address: payload.address,
        signature_url: payload.signature_url ?? undefined,
        signature_name: payload.signature_name ?? undefined,
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

  function onClearAll() {
    const ok = confirm(
      "This will remove all saved landlords from this browser. Continue?"
    );
    if (!ok) return;
    clearLandlords();
    setList([]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="grid gap-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-lg font-semibold">Landlords</h1>
          <button
            onClick={onClearAll}
            className="px-2 py-1 rounded ring-1 ring-inset text-xs"
            type="button"
          >
            Clear all landlords
          </button>
        </div>
        <form onSubmit={onCreate} className="grid gap-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="grid gap-0.5">
              <span className="text-xs opacity-80">Name</span>
              <input
                className="ring-1 ring-inset rounded px-2 py-1.5 bg-transparent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-xs opacity-80">Address (optional)</span>
              <input
                className="ring-1 ring-inset rounded px-2 py-1.5 bg-transparent"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-xs opacity-80">Signature Image (optional)</span>
              <input
                type="file"
                accept="image/*"
                className="ring-1 ring-inset rounded px-2 py-1.5 bg-transparent"
                onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              disabled={saving}
              className="px-2 py-1 rounded bg-foreground text-background disabled:opacity-50 text-sm"
              type="submit"
            >
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-1.5">Name</th>
                <th className="p-1.5">Address</th>
                <th className="p-1.5">Signature</th>
                <th className="p-1.5 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="p-1.5">{l.name}</td>
                  <td className="p-1.5 truncate max-w-[280px]">{l.address ?? "-"}</td>
                  <td className="p-1.5">
                    {l.signature_url ? (
                      <img
                        src={l.signature_url}
                        alt="signature"
                        className="h-6"
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-1.5">
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded ring-1 ring-inset text-xs"
                      onClick={() => {
                        const ok = confirm(`Delete landlord "${l.name}"?`);
                        if (!ok) return;
                        deleteLandlord(l.id);
                        setList(getLandlords());
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
