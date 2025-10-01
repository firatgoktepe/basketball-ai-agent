"use client";

import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface HelpTextProps {
  children: React.ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  className?: string;
}

export function HelpText({
  children,
  variant = "info",
  className = "",
}: HelpTextProps) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };

  const icons = {
    info: <Info className="w-4 h-4 flex-shrink-0" />,
    success: <CheckCircle className="w-4 h-4 flex-shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 flex-shrink-0" />,
  };

  return (
    <div
      className={`flex items-start gap-2 p-3 sm:p-4 border rounded-lg ${styles[variant]} ${className}`}
    >
      {icons[variant]}
      <div className="text-xs sm:text-sm flex-1">{children}</div>
    </div>
  );
}
