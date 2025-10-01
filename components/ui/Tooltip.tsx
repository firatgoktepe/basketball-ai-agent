"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, Info } from "lucide-react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  icon?: "help" | "info";
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({
  content,
  children,
  icon = "info",
  position = "top",
  className = "",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = -tooltipRect.height - 8;
          left = (triggerRect.width - tooltipRect.width) / 2;
          break;
        case "bottom":
          top = triggerRect.height + 8;
          left = (triggerRect.width - tooltipRect.width) / 2;
          break;
        case "left":
          top = (triggerRect.height - tooltipRect.height) / 2;
          left = -tooltipRect.width - 8;
          break;
        case "right":
          top = (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.width + 8;
          break;
      }

      setTooltipPosition({ top, left });
    }
  }, [isVisible, position]);

  const IconComponent = icon === "help" ? HelpCircle : Info;

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children || (
        <IconComponent className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
      )}

      {isVisible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 px-3 py-2 text-xs sm:text-sm bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-w-xs sm:max-w-sm whitespace-normal pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          <div className="relative">
            {content}
            {/* Arrow */}
            <div
              className={`absolute w-2 h-2 bg-popover border-border transform rotate-45 ${
                position === "top"
                  ? "bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r"
                  : position === "bottom"
                  ? "top-[-5px] left-1/2 -translate-x-1/2 border-t border-l"
                  : position === "left"
                  ? "right-[-5px] top-1/2 -translate-y-1/2 border-r border-t"
                  : "left-[-5px] top-1/2 -translate-y-1/2 border-l border-b"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper component for inline tooltips next to labels
 */
export function LabelWithTooltip({
  label,
  tooltip,
  required = false,
  className = "",
}: {
  label: string;
  tooltip: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </span>
      <Tooltip content={tooltip} icon="help" />
    </div>
  );
}
