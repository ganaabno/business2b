import { useEffect, useMemo, useState } from "react";
import { Upload, CheckCircle2, FileClock, Pencil } from "lucide-react";
import mammoth from "mammoth";
import { supabase } from "../supabaseClient";

type ContractStatus = "draft" | "published" | "archived";

type AgentContractVersion = {
  id: string;
  version_no: number;
  title: string;
  body_markdown: string;
  status: ContractStatus;
  is_active: boolean;
  file_path: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
};

interface AgentContractsTabProps {
  currentUser: { id: string };
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function AgentContractsTab({
  currentUser,
  showNotification,
}: AgentContractsTabProps) {
  const [versions, setVersions] = useState<AgentContractVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("Agent Standard Contract");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [status, setStatus] = useState<ContractStatus>("draft");
  const [makeActive, setMakeActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const report = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    showNotification(type, message);
  };

  const toReadableError = (error: any) => {
    const message = String(error?.message || "Unknown error");
    if (message.includes("relation \"agent_contract_versions\" does not exist")) {
      return "Contract table is missing. Run the latest Supabase migration first.";
    }
    if (message.includes("Bucket not found") || message.includes("agent-contracts")) {
      return "Contract storage bucket/policy is missing. Run migration to create 'agent-contracts'.";
    }
    if (message.toLowerCase().includes("row-level security")) {
      return "Permission denied by RLS. Please login as manager/admin and verify policies.";
    }
    return message;
  };

  const extractTextFromFile = async (input: File) => {
    const lowerName = input.name.toLowerCase();

    if (lowerName.endsWith(".txt")) {
      return await input.text();
    }

    if (lowerName.endsWith(".docx")) {
      const arrayBuffer = await input.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value?.trim() || "";
    }

    if (lowerName.endsWith(".doc")) {
      throw new Error(
        "Legacy .doc files cannot be parsed in browser. Please save as .docx (or copy contract text) so it can render in-app.",
      );
    }

    if (lowerName.endsWith(".pdf")) {
      return "";
    }

    throw new Error(
      "Unsupported file for text rendering. Use .docx or .txt for inline contract preview.",
    );
  };

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) ?? null,
    [versions, selectedId],
  );

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_contract_versions")
        .select("*")
        .order("version_no", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as AgentContractVersion[];
      setVersions(rows);

      if (rows.length > 0 && !selectedId) {
        const active = rows.find((row) => row.is_active) ?? rows[0];
        setSelectedId(active.id);
      }
    } catch (error: any) {
      report("error", `Failed to load contracts: ${toReadableError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title || "Agent Standard Contract");
    setBodyMarkdown(selected.body_markdown || "");
    setStatus(selected.status || "draft");
    setMakeActive(Boolean(selected.is_active));
    setFile(null);
  }, [selectedId]);

  const uploadContractFile = async (versionNo: number) => {
    if (!file) return { file_path: null as string | null, file_url: null as string | null };
    const ext = file.name.split(".").pop() || "pdf";
    const path = `v${versionNo}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("agent-contracts")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("agent-contracts")
      .getPublicUrl(path);

    return {
      file_path: path,
      file_url: publicUrlData?.publicUrl || null,
    };
  };

  const setActiveVersion = async (versionId: string) => {
    try {
      setSaving(true);
      const { error: clearError } = await supabase
        .from("agent_contract_versions")
        .update({ is_active: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (clearError) throw clearError;

      const { error } = await supabase
        .from("agent_contract_versions")
        .update({ is_active: true, status: "published", updated_at: new Date().toISOString() })
        .eq("id", versionId);

      if (error) throw error;

      report("success", "Contract version is now active.");
      await fetchContracts();
      setSelectedId(versionId);
    } catch (error: any) {
      report("error", `Failed to activate contract: ${toReadableError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const createNewVersion = async () => {
    if (!title.trim()) {
      report("error", "Title is required.");
      return;
    }

    if (!bodyMarkdown.trim() && !file) {
      report("error", "Add contract text or attach a contract file.");
      return;
    }

    try {
      setSaving(true);
      const maxVersion = versions.reduce((max, row) => Math.max(max, row.version_no || 0), 0);
      const nextVersion = maxVersion + 1;
      const uploaded = await uploadContractFile(nextVersion);

      const insertPayload = {
        version_no: nextVersion,
        title: title.trim(),
        body_markdown:
          bodyMarkdown.trim() ||
          (file
            ? `Contract content is attached as file: ${file.name}. Please open the uploaded file link.`
            : ""),
        status,
        is_active: makeActive && status === "published",
        file_path: uploaded.file_path,
        file_url: uploaded.file_url,
        created_by: currentUser?.id || null,
      };

      if (insertPayload.is_active) {
        const { error: clearError } = await supabase
          .from("agent_contract_versions")
          .update({ is_active: false })
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (clearError) throw clearError;
      }

      const { data, error } = await supabase
        .from("agent_contract_versions")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) throw error;

      report("success", `Contract v${nextVersion} saved.`);
      await fetchContracts();
      if (data?.id) setSelectedId(data.id);
    } catch (error: any) {
      report("error", `Failed to save contract: ${toReadableError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedVersion = async () => {
    if (!selected) {
      report("error", "Choose a version to edit first.");
      return;
    }

    if (!title.trim()) {
      report("error", "Title is required.");
      return;
    }

    if (!bodyMarkdown.trim() && !file && !selected.file_url) {
      report("error", "Add contract text or attach a contract file.");
      return;
    }

    try {
      setSaving(true);

      const uploaded = await uploadContractFile(selected.version_no);

      if (makeActive && status === "published") {
        const { error: clearError } = await supabase
          .from("agent_contract_versions")
          .update({ is_active: false })
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (clearError) throw clearError;
      }

      const { error } = await supabase
        .from("agent_contract_versions")
        .update({
          title: title.trim(),
          body_markdown:
            bodyMarkdown.trim() ||
            (file
              ? `Contract content is attached as file: ${file.name}. Please open the uploaded file link.`
              : selected.body_markdown || ""),
          status,
          is_active: makeActive && status === "published",
          ...(uploaded.file_path ? { file_path: uploaded.file_path } : {}),
          ...(uploaded.file_url ? { file_url: uploaded.file_url } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);

      if (error) throw error;

      report("success", `Contract v${selected.version_no} updated.`);
      await fetchContracts();
    } catch (error: any) {
      report("error", `Failed to update contract: ${toReadableError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const newVersion = () => {
    setSelectedId(null);
    setTitle("Agent Standard Contract");
    setBodyMarkdown("");
    setStatus("draft");
    setMakeActive(true);
    setFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="mono-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="mono-title text-xl">Agent Contract Management</h3>
            <p className="mono-subtitle text-sm mt-1">
              Upload files, edit contract text, and keep version history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={newVersion} className="mono-button mono-button--ghost mono-button--sm">
              New Version
            </button>
            <button
              onClick={fetchContracts}
              disabled={loading}
              className="mono-button mono-button--ghost mono-button--sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <div className="mono-card p-4 sm:p-5">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileClock className="w-4 h-4" /> Versions
          </h4>
          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {loading && <p className="text-sm text-gray-500">Loading versions...</p>}
            {!loading && versions.length === 0 && (
              <p className="text-sm text-gray-500">No contract versions yet.</p>
            )}
            {versions.map((version) => {
              const active = selectedId === version.id;
              return (
                <button
                  key={version.id}
                  onClick={() => setSelectedId(version.id)}
                  className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                    active
                      ? "border-gray-900 bg-gray-100"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">v{version.version_no}</p>
                    {version.is_active && (
                      <span className="mono-badge mono-badge--success">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 mt-1 truncate">{version.title}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {version.status} • {new Date(version.updated_at).toLocaleString()}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mono-card p-5 sm:p-6 space-y-4">
          {feedback && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                feedback.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mono-input"
                placeholder="Agent Standard Contract"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
                className="mono-input"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Contract Text (editable)</label>
            <textarea
              value={bodyMarkdown}
              onChange={(e) => setBodyMarkdown(e.target.value)}
              className="mono-input min-h-[260px]"
              placeholder="Write the full agent contract here..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">Contract File (optional)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={async (e) => {
                  const nextFile = e.target.files?.[0] || null;
                  setFile(nextFile);
                  if (nextFile) {
                    try {
                      const extractedText = await extractTextFromFile(nextFile);
                      if (extractedText) {
                        setBodyMarkdown(extractedText);
                        report(
                          "success",
                          `Loaded text from ${nextFile.name}. Review and click \"Save New Version (Upload + Save)\".`,
                        );
                      } else {
                        report(
                          "success",
                          `Selected file: ${nextFile.name}. Click \"Save New Version (Upload + Save)\" to upload.`,
                        );
                      }
                    } catch (error: any) {
                      report("error", toReadableError(error));
                    }
                  }
                }}
                className="mono-input"
              />
              <p className="text-xs text-gray-500 mt-2">
                Choosing a file does not save automatically. Use the save button below.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                className="h-4 w-4"
              />
              Set as active when published
            </label>
          </div>

          {selected?.file_url && (
            <a
              href={selected.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-700 hover:text-blue-900 underline"
            >
              Open uploaded file for selected version
            </a>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              onClick={createNewVersion}
              disabled={saving}
              className="mono-button flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {saving ? "Saving..." : "Save New Version (Upload + Save)"}
            </button>
            <button
              onClick={updateSelectedVersion}
              disabled={saving || !selected}
              className="mono-button mono-button--ghost flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Update Selected
            </button>
            {selected && (
              <button
                onClick={() => setActiveVersion(selected.id)}
                disabled={saving}
                className="mono-button mono-button--ghost flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Make Active
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Signing up as an agent requires accepting the currently active published contract.
          </p>
        </div>
      </div>
    </div>
  );
}
