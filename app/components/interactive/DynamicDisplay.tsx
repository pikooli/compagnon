"use client";

import type { DisplayDynamicData } from "@/app/types/ui-commands";
import DOMPurify from "dompurify";
import { motion } from "framer-motion";
import { LayoutDashboard } from "lucide-react";
import { useMemo } from "react";

interface DynamicDisplayProps {
  data: DisplayDynamicData;
}

export function DynamicDisplay({ data }: DynamicDisplayProps) {
  const sanitizedHtml = useMemo(
    () =>
      DOMPurify.sanitize(data.html, {
        ALLOWED_TAGS: [
          "h1", "h2", "h3", "h4", "h5", "h6",
          "p", "br", "hr",
          "ul", "ol", "li",
          "table", "thead", "tbody", "tr", "th", "td",
          "strong", "b", "em", "i", "u", "s", "del",
          "span", "div", "section",
          "blockquote", "pre", "code",
          "a", "img",
        ],
        ALLOWED_ATTR: ["style", "class", "href", "src", "alt", "colspan", "rowspan"],
        FORBID_TAGS: ["script", "iframe", "form", "input", "textarea", "select", "button", "object", "embed"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
      }),
    [data.html],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-[#1e2d4a] bg-[#0f1c3f]/80 p-6"
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <LayoutDashboard className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-blue-400">
          {data.title || "Display"}
        </h3>
      </div>

      {/* Sanitized HTML content */}
      <div
        className="dynamic-content"
        style={{
          fontSize: "18px",
          lineHeight: 1.6,
          color: "#e2e8f0",
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </motion.div>
  );
}
