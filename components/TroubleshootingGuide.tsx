"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: "upload" | "processing" | "results" | "performance";
}

const faqs: FAQItem[] = [
  {
    category: "upload",
    question: "What video formats are supported?",
    answer:
      "We support MP4 video files up to 500MB. For best compatibility, use H.264 codec with AAC audio. Other formats may work but are not guaranteed.",
  },
  {
    category: "upload",
    question: "Why is my video not loading?",
    answer:
      "Common issues: (1) File is too large (>500MB), (2) Unsupported format (use MP4), (3) Corrupted video file. Try converting your video to MP4 using a tool like HandBrake.",
  },
  {
    category: "processing",
    question: "Why aren't scores being detected in my amateur video?",
    answer:
      "Score detection relies on visual tracking of the ball going through the hoop. Ensure the hoop is clearly visible in your video frame. The camera should have a stable view of the basket. The system correlates shot attempts with ball-through-hoop events to determine scores.",
  },
  {
    category: "processing",
    question: "Processing is taking too long. How can I speed it up?",
    answer:
      "Try these steps: (1) Reduce sampling rate to 1 FPS, (2) Disable advanced features (Ball Detection, Pose Estimation), (3) Use shorter video clips (2-5 minutes), (4) Close other browser tabs to free up memory.",
  },
  {
    category: "results",
    question: "The detected events are inaccurate. What should I do?",
    answer:
      "Event detection depends on video quality and camera angle. For better accuracy: (1) Use higher resolution (1080p recommended), (2) Ensure stable camera with tripod, (3) Good lighting, (4) Clear view of the hoop and full court, (5) Enable Ball Detection and Pose Estimation for more accurate action recognition. You can manually correct events in the results view.",
  },
  {
    category: "results",
    question: "Jersey numbers aren't being detected. Why?",
    answer:
      "Jersey number detection uses OCR on player jerseys and requires: (1) High resolution video (1080p+), (2) Players facing camera so jersey is visible, (3) Good contrast between jersey color and numbers, (4) Camera close enough to read numbers. For players with undetected numbers, the system uses motion-based re-identification.",
  },
  {
    category: "results",
    question: "Team colors are mixed up. How do I fix this?",
    answer:
      "Team clustering is based on jersey colors. If teams have similar colors or mixed jerseys, the system may struggle. This will be improved in future updates. For now, you can manually adjust team assignments in the event list.",
  },
  {
    category: "performance",
    question: "My browser is freezing during analysis. What's wrong?",
    answer:
      "This may happen on older devices or with very long videos. Solutions: (1) Use a modern browser (Chrome, Edge, Firefox), (2) Close other applications, (3) Reduce video length to 5 minutes or less, (4) Disable advanced features, (5) Use 1 FPS sampling rate.",
  },
  {
    category: "performance",
    question: "Do I need a powerful computer to use this?",
    answer:
      "Basic analysis works on most modern computers. For advanced features (Ball Detection, Pose Estimation), a device with WebGPU support and 8GB+ RAM is recommended. The app will automatically recommend optimal settings based on your device.",
  },
];

export function TroubleshootingGuide() {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getCategoryIcon = (category: FAQItem["category"]) => {
    return <HelpCircle className="w-4 h-4" />;
  };

  const categories = {
    upload: "Video Upload",
    processing: "Processing & Analysis",
    results: "Results & Accuracy",
    performance: "Performance",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Troubleshooting Guide</h3>
      </div>

      <div className="space-y-2">
        {Object.entries(categories).map(([key, label]) => {
          const categoryFaqs = faqs.filter((faq) => faq.category === key);

          return (
            <div key={key} className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 font-medium text-sm">
                {label}
              </div>
              <div className="divide-y">
                {categoryFaqs.map((faq, idx) => {
                  const globalIdx = faqs.indexOf(faq);
                  const isExpanded = expandedItems.has(globalIdx);

                  return (
                    <div key={globalIdx}>
                      <button
                        onClick={() => toggleItem(globalIdx)}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {faq.question}
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 pl-11 text-sm text-muted-foreground">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Still having issues?</strong> Check that you&apos;re using the
          latest version of Chrome, Edge, or Firefox. Safari may have limited
          support for some features.
        </p>
      </div>
    </div>
  );
}
