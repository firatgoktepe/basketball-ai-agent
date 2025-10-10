"use client";

import { useState } from "react";
import { X, HelpCircle, Book, AlertCircle, Shield } from "lucide-react";
import { TroubleshootingGuide } from "./TroubleshootingGuide";
import { PrivacyNotice } from "./PrivacyNotice";

export function HelpDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "guide" | "troubleshooting" | "privacy"
  >("guide");

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Open help"
      >
        <HelpCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-4 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-4 sm:w-[600px] bg-background border rounded-lg shadow-2xl z-50 flex flex-col max-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Help & Documentation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("guide")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "guide"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Book className="w-4 h-4" />
              <span>Quick Start</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("troubleshooting")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "troubleshooting"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>FAQ</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("privacy")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "privacy"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Privacy</span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === "guide" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">How to Use</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <h4 className="font-medium">Upload Your Video</h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Select an MP4 video file of an amateur basketball game. For
                    best results, use 720p or higher resolution with good
                    lighting and a steady camera angle showing the full court
                    and hoop.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <h4 className="font-medium">
                      Configure Detection Settings
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Choose sampling rate (1 FPS recommended) and enable
                    features: Ball Detection tracks the ball, Pose Estimation
                    analyzes player movements, Jersey Number Detection
                    identifies individual players, and 3-Point Line Detection
                    distinguishes shot types.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <h4 className="font-medium">Start Analysis</h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Click &quot;Start Analysis&quot; and wait for processing to
                    complete. The system will detect players, track the ball,
                    identify jersey numbers, recognize actions (shots, passes,
                    blocks, dunks, etc.), and visually detect scores when the
                    ball goes through the hoop.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <h4 className="font-medium">
                      Review Statistics & Highlights
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Review team and per-player statistics including points, shot
                    attempts, hit rates, blocks, assists, and more. Watch
                    auto-generated highlight clips of key moments. Filter events
                    by player or action type.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      5
                    </div>
                    <h4 className="font-medium">Export Results</h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Review the detected events on the timeline and charts. Click
                    events to jump to that moment in the video. Export results
                    as JSON or CSV for further analysis or share with your team.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Best Practices for Amateur Videos:</strong>
                  <br />
                  • Use a tripod or stable camera position showing the full
                  court
                  <br />
                  • Ensure the basketball hoop is visible in the frame
                  <br />
                  • Good lighting helps with player and jersey detection
                  <br />
                  • Higher resolution (1080p) improves jersey number recognition
                  <br />• Avoid excessive camera movement or zoom during play
                </p>
              </div>
            </div>
          )}

          {activeTab === "troubleshooting" && <TroubleshootingGuide />}

          {activeTab === "privacy" && (
            <div className="space-y-4">
              <PrivacyNotice />

              <div className="space-y-3 text-sm">
                <h3 className="text-lg font-semibold mt-4">
                  Terms of Use (Summary)
                </h3>

                <p className="text-muted-foreground">
                  By using this tool, you agree to:
                </p>

                <ul className="space-y-2 text-muted-foreground pl-4">
                  <li>
                    • Only process videos you have the legal right to analyze
                  </li>
                  <li>
                    • Not use this tool to violate copyright or privacy rights
                  </li>
                  <li>
                    • Understand that all processing is local and experimental
                  </li>
                  <li>• Use results at your own discretion and risk</li>
                </ul>

                <p className="text-muted-foreground text-xs mt-4">
                  This is an experimental tool provided &quot;as-is&quot;
                  without warranties. Results may not be 100% accurate. Always
                  verify important statistics manually.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Need more help? All processing happens locally in your browser for
            privacy and security.
          </p>
        </div>
      </div>
    </>
  );
}
