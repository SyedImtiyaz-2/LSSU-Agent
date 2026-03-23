import { useState, useEffect } from "react";
import { Mail, Send, Loader2, Plus, X, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { sendInvitations, listInvitations } from "../api";

export default function InvitationsPage() {
  const [emails, setEmails] = useState([""]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    try {
      const data = await listInvitations();
      setInvitations(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const addEmailField = () => setEmails([...emails, ""]);

  const removeEmailField = (idx) => {
    if (emails.length === 1) return;
    setEmails(emails.filter((_, i) => i !== idx));
  };

  const updateEmail = (idx, value) => {
    const updated = [...emails];
    updated[idx] = value;
    setEmails(updated);
  };

  const handleSend = async () => {
    const validEmails = emails.filter((e) => e.trim() && e.includes("@"));
    if (validEmails.length === 0) return;

    setSending(true);
    setSent(false);
    setSendResults(null);
    try {
      const result = await sendInvitations(validEmails, message);
      setSendResults(result);
      setSent(true);
      setEmails([""]);
      setMessage("");
      fetchInvitations();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const statusConfig = {
    sent: { color: "text-blue-400 bg-blue-500/10 border-blue-500/30", label: "Sent" },
    opened: { color: "text-amber-400 bg-amber-500/10 border-amber-500/30", label: "Opened" },
    started: { color: "text-purple-400 bg-purple-500/10 border-purple-500/30", label: "In Session" },
    completed: { color: "text-green-400 bg-green-500/10 border-green-500/30", label: "Completed" },
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-10 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Invitations</h1>
          <p className="text-base text-neutral-500 mt-1">
            Send session invites via email
          </p>
        </div>

        {/* Send Form */}
        <div className="border border-neutral-800 rounded-2xl bg-neutral-950 p-8 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6">Send New Invitations</h2>

          {/* Email fields */}
          <div className="space-y-3 mb-6">
            <label className="text-sm font-medium text-neutral-400">Email Addresses</label>
            {emails.map((email, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(idx, e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
                  />
                </div>
                {emails.length > 1 && (
                  <button
                    onClick={() => removeEmailField(idx)}
                    className="text-neutral-600 hover:text-red-400 transition-colors p-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addEmailField}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" /> Add another email
            </button>
          </div>

          {/* Custom message */}
          <div className="mb-6">
            <label className="text-sm font-medium text-neutral-400 block mb-2">
              Custom Message <span className="text-neutral-600">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to the invitation..."
              rows={3}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors resize-none"
            />
          </div>

          {/* Send button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSend}
              disabled={sending || emails.every((e) => !e.trim())}
              className="flex items-center gap-2.5 px-6 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Send Invitations
            </button>

            {sent && sendResults && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle className="w-4 h-4" />
                {sendResults.total_sent} invitation{sendResults.total_sent !== 1 ? "s" : ""} sent
              </div>
            )}
          </div>
        </div>

        {/* Invitation History */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-5">Sent Invitations</h2>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-16 border border-neutral-800 rounded-2xl bg-neutral-950">
              <Mail className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-base text-neutral-500 font-medium">No invitations sent yet</p>
              <p className="text-sm text-neutral-600 mt-1">
                Send your first invite above
              </p>
            </div>
          ) : (
            <div className="border border-neutral-800 rounded-2xl bg-neutral-950 divide-y divide-neutral-800/60 overflow-hidden">
              {invitations.map((inv) => {
                const cfg = statusConfig[inv.status] || statusConfig.sent;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-6 py-5 hover:bg-neutral-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-neutral-400" />
                      </div>
                      <div>
                        <p className="text-base text-white font-medium">{inv.email}</p>
                        <p className="text-sm text-neutral-500">
                          {new Date(inv.sent_at).toLocaleDateString()}
                          {inv.message && `  ·  "${inv.message.slice(0, 40)}${inv.message.length > 40 ? "..." : ""}"`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-lg font-medium border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
