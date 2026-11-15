import React from "react";

interface HighlightMatchProps {
  text: string;
  query: string;
}

/** Highlights case-insensitive matching substrings inside search & filter cells. */
export function HighlightMatch({ text, query }: HighlightMatchProps) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + needle.length);
  const after = text.slice(idx + needle.length);

  return (
    <>
      {before}
      <mark className="query-mark">{match}</mark>
      {after}
    </>
  );
}
