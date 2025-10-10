"use client";

import { Shield, Lock, HardDrive } from "lucide-react";
import { HelpText } from "@/components/ui/HelpText";

interface PrivacyNoticeProps {
  className?: string;
}

export function PrivacyNotice({ className = "" }: PrivacyNoticeProps) {
  return (
    <HelpText variant="info" className={className}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span className="font-medium">Privacy & Data Handling</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <strong>100% Client-Side Processing:</strong> All video analysis
              happens in your browser. Your video never leaves your device.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <HardDrive className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <strong>No Server Uploads:</strong> Videos and results are stored
              only in your browser&apos;s memory during the session. Nothing is
              saved to our servers.
            </div>
          </div>

          <div className="pl-5">
            <strong>Your Rights:</strong>
            <ul className="mt-1 space-y-0.5 ml-4">
              <li>• Process only videos you have the right to use</li>
              <li>• Export and delete your data at any time</li>
              <li>• No face recognition - only jersey numbers are detected</li>
              <li>• All player data stays on your device</li>
            </ul>
          </div>
        </div>
      </div>
    </HelpText>
  );
}
