import { useEffect, useState } from "react";
import { profileApi } from "../../api/studentApi";
import type { StudentPortalProfile, Certificate, CertificateCreate } from "../../types";

export default function Profile() {
  const [profile, setProfile] = useState<StudentPortalProfile | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [certForm, setCertForm] = useState<CertificateCreate | null>(null);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [addingCert, setAddingCert] = useState(false);

  const loadCerts = () => profileApi.listCertificates().then(setCertificates).catch(() => {});

  useEffect(() => {
    profileApi.get().then(setProfile).catch(() => {});
    loadCerts();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true); setMessage(null);
    try {
      const updated = await profileApi.update({
        bio: profile.bio, phone: profile.phone, branch: profile.branch,
        batchYear: profile.batchYear, skills: profile.skills,
        resumeUrl: profile.resumeUrl, portfolioUrl: profile.portfolioUrl,
        githubUrl: profile.githubUrl, linkedinUrl: profile.linkedinUrl,
      });
      setProfile(updated);
      setMessage("Profile updated successfully.");
    } catch { setMessage("Failed to update profile."); }
    finally { setSaving(false); }
  };

  const addSkill = () => {
    if (!skillInput.trim() || !profile) return;
    setProfile({ ...profile, skills: [...(profile.skills || []), skillInput.trim()] });
    setSkillInput("");
  };

  const removeSkill = (idx: number) => {
    if (!profile) return;
    setProfile({ ...profile, skills: profile.skills.filter((_, i) => i !== idx) });
  };

  const handleAddCert = async () => {
    if (!certForm?.title) return;
    setAddingCert(true);
    try {
      if (editingCertId) {
        await profileApi.updateCertificate(editingCertId, certForm);
      } else {
        await profileApi.addCertificate(certForm);
      }
      setCertForm(null);
      setEditingCertId(null);
      loadCerts();
    } catch { alert(editingCertId ? "Failed to update certificate." : "Failed to add certificate."); }
    finally { setAddingCert(false); }
  };

  const startEditCert = (c: Certificate) => {
    setEditingCertId(c.id);
    setCertForm({
      title: c.title,
      issuer: c.issuer ?? "",
      issueDate: (c as any).issueDate ?? "",
      certificateUrl: c.certificateUrl ?? "",
    });
  };

  const handleDeleteCert = async (id: string) => {
    if (!confirm("Delete this certificate?")) return;
    try {
      await profileApi.deleteCertificate(id);
      loadCerts();
    } catch { alert("Failed to delete certificate."); }
  };

  if (!profile) return <div className="text-gray-500">Loading profile...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>

      {(profile.courseName || profile.facultyName || profile.batchName) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Course</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{profile.courseName || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Faculty</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{profile.facultyName || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Course Progress</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{profile.courseProgress != null ? `${profile.courseProgress}%` : "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Avg. Percentile</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{profile.averagePercentile != null ? `${profile.averagePercentile}%` : "—"}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <Field label="Bio">
          <textarea className="input" value={profile.bio ?? ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input className="input" value={profile.phone ?? ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
          <Field label="Branch">
            <input className="input" value={profile.branch ?? ""}
              onChange={(e) => setProfile({ ...profile, branch: e.target.value })} />
          </Field>
        </div>
        <Field label="Resume URL">
          <input className="input" value={profile.resumeUrl ?? ""}
            onChange={(e) => setProfile({ ...profile, resumeUrl: e.target.value })} />
        </Field>
        <Field label="Portfolio URL">
          <input className="input" value={profile.portfolioUrl ?? ""}
            onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })} />
        </Field>
        <Field label="GitHub URL">
          <input className="input" value={profile.githubUrl ?? ""}
            onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })} />
        </Field>
        <Field label="LinkedIn URL">
          <input className="input" value={(profile as any).linkedinUrl ?? ""}
            onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value } as any)} />
        </Field>

        <Field label="Skills">
          <div className="flex flex-wrap gap-2 mb-2">
            {(profile.skills || []).map((s, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                {s}
                <button onClick={() => removeSkill(i)} className="text-primary/60 hover:text-red-500 ml-1">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" value={skillInput} placeholder="Add a skill and press Enter"
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()} />
            <button onClick={addSkill} className="px-3 py-2 bg-gray-100 rounded-lg text-sm">Add</button>
          </div>
        </Field>

        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {message && <p className={`text-sm ${message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>}
      </div>

      {/* Certificates */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Certificates</h2>
          <button onClick={() => { setEditingCertId(null); setCertForm({ title: "", issuer: "", issueDate: "", certificateUrl: "" }); }}
            className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg font-medium">
            + Add Certificate
          </button>
        </div>

        {certForm !== null && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">{editingCertId ? "Edit Certificate" : "New Certificate"}</h3>
            <input className="input" placeholder="Certificate title *" value={certForm.title}
              onChange={(e) => setCertForm({ ...certForm, title: e.target.value })} />
            <input className="input" placeholder="Issuing organization (e.g. Coursera, Google)"
              value={certForm.issuer ?? ""} onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Issue Date</label>
                <input type="date" className="input" value={certForm.issueDate ?? ""}
                  onChange={(e) => setCertForm({ ...certForm, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Credential URL (optional)</label>
                <input className="input" placeholder="https://..." value={certForm.certificateUrl ?? ""}
                  onChange={(e) => setCertForm({ ...certForm, certificateUrl: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddCert} disabled={addingCert || !certForm.title}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {addingCert ? "Saving..." : editingCertId ? "Update Certificate" : "Save Certificate"}
              </button>
              <button onClick={() => { setCertForm(null); setEditingCertId(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {certificates.map((c) => (
            <li key={c.id} className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{c.title}</p>
                {c.issuer && <p className="text-xs text-gray-500">{c.issuer}</p>}
                {(c as any).issueDate && <p className="text-xs text-gray-400">{(c as any).issueDate}</p>}
                {c.certificateUrl && (
                  <a href={c.certificateUrl} target="_blank" rel="noreferrer"
                    className="text-xs text-primary underline">View credential</a>
                )}
              </div>
              <div className="flex gap-3 shrink-0 ml-3">
                <button onClick={() => startEditCert(c)} className="text-xs text-primary font-medium hover:underline">
                  Edit
                </button>
                <button onClick={() => handleDeleteCert(c.id)} className="text-xs text-red-600 font-medium hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
          {certificates.length === 0 && !certForm && (
            <p className="text-sm text-gray-400">No certificates added yet. Click "+ Add Certificate" to add one.</p>
          )}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
