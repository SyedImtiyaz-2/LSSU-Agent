import { Wrench } from "lucide-react";

export default function InvitationsPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto mb-5">
          <Wrench className="w-7 h-7 text-neutral-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Under Maintenance</h1>
        <p className="text-sm text-neutral-500 max-w-xs">
          The Invitations feature is currently under maintenance. It will be back shortly.
        </p>
      </div>
    </div>
  );
}
