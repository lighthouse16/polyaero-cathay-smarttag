"use client";

import React, { type ReactNode } from "react";
import styles from "./OperationsCopilot.module.css";

interface CopilotMessageBodyProps {
  content: string;
  streaming?: boolean;
  knownBagTags?: ReadonlySet<string>;
  knownFlightLegByNumber?: ReadonlyMap<string, string>;
  onSelectBag?: (bagTag: string) => void;
  onSelectFlight?: (legId: string) => void;
}

const TOKEN_SPLIT_RE =
  /(\*\*[^*]+\*\*|`[^`]+`|\b\d{10}\b|\b[A-Z]{2}\d{2,4}\b)/g;

function renderInlineTokens(
  text: string,
  opts: {
    knownBagTags?: ReadonlySet<string>;
    knownFlightLegByNumber?: ReadonlyMap<string, string>;
    onSelectBag?: (bagTag: string) => void;
    onSelectFlight?: (legId: string) => void;
  },
  keyPrefix: string,
): ReactNode[] {
  const parts = text.split(TOKEN_SPLIT_RE);
  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const inner = part.slice(2, -2);
      const flightLegId = opts.knownFlightLegByNumber?.get(inner);
      if (flightLegId && opts.onSelectFlight) {
        return (
          <button
            key={key}
            type="button"
            className={styles.entityChip}
            onClick={() => opts.onSelectFlight?.(flightLegId)}
            title={`Inspect flight ${inner}`}
          >
            {inner}
          </button>
        );
      }
      if (/^\d{10}$/.test(inner) && opts.knownBagTags?.has(inner) && opts.onSelectBag) {
        return (
          <button
            key={key}
            type="button"
            className={`${styles.entityChip} ${styles.entityChipMono}`}
            onClick={() => opts.onSelectBag?.(inner)}
            title={`Inspect bag ${inner}`}
          >
            {inner}
          </button>
        );
      }
      return <strong key={key}>{inner}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className={styles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }

    if (/^\d{10}$/.test(part) && opts.knownBagTags?.has(part) && opts.onSelectBag) {
      return (
        <button
          key={key}
          type="button"
          className={`${styles.entityChip} ${styles.entityChipMono}`}
          onClick={() => opts.onSelectBag?.(part)}
          title={`Inspect bag ${part}`}
        >
          {part}
        </button>
      );
    }

    const legId = opts.knownFlightLegByNumber?.get(part);
    if (legId && opts.onSelectFlight) {
      return (
        <button
          key={key}
          type="button"
          className={styles.entityChip}
          onClick={() => opts.onSelectFlight?.(legId)}
          title={`Inspect flight ${part}`}
        >
          {part}
        </button>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

export function CopilotMessageBody({
  content,
  streaming = false,
  knownBagTags,
  knownFlightLegByNumber,
  onSelectBag,
  onSelectFlight,
}: CopilotMessageBodyProps) {
  if (!content.trim()) {
    return null;
  }

  const inlineOpts = {
    knownBagTags,
    knownFlightLegByNumber,
    onSelectBag,
    onSelectFlight,
  };

  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let listItems: string[] = [];
  let listOrdered = false;
  let paragraphLines: string[] = [];

  const flushParagraph = (index: number) => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(" ");
    blocks.push(
      <p key={`p-${index}`} className={styles.proseParagraph}>
        {renderInlineTokens(text, inlineOpts, `p-${index}`)}
      </p>,
    );
    paragraphLines = [];
  };

  const flushList = (index: number) => {
    if (!listItems.length) return;
    const items = listItems.map((item, itemIdx) => (
      <li key={`li-${index}-${itemIdx}`}>
        {renderInlineTokens(item, inlineOpts, `li-${index}-${itemIdx}`)}
      </li>
    ));
    blocks.push(
      listOrdered ? (
        <ol key={`ol-${index}`} className={styles.proseList}>
          {items}
        </ol>
      ) : (
        <ul key={`ul-${index}`} className={styles.proseList}>
          {items}
        </ul>
      ),
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushParagraph(idx);
      flushList(idx);
      return;
    }

    const headingMatch = /^#{1,3}\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph(idx);
      flushList(idx);
      blocks.push(
        <h4 key={`h-${idx}`} className={styles.proseHeading}>
          {renderInlineTokens(headingMatch[1], inlineOpts, `h-${idx}`)}
        </h4>,
      );
      return;
    }

    const bulletMatch = /^[-*•]\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph(idx);
      if (listItems.length && listOrdered) flushList(idx);
      listOrdered = false;
      listItems.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (orderedMatch) {
      flushParagraph(idx);
      if (listItems.length && !listOrdered) flushList(idx);
      listOrdered = true;
      listItems.push(orderedMatch[1]);
      return;
    }

    if (listItems.length) flushList(idx);
    paragraphLines.push(trimmed);
  });

  flushParagraph(lines.length);
  flushList(lines.length);

  return (
    <div className={styles.prose}>
      {blocks}
      {streaming && <span className={styles.streamCaret} aria-hidden="true" />}
    </div>
  );
}
