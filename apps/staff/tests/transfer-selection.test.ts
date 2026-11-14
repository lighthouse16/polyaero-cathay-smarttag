import { describe, expect, it } from "vitest";
import { transferSelection, emptySelection } from "../src/components/transfer/selection";

describe("progressive transfer selection", () => {
  it("Escape removes one selection layer", () => {
    const selected = { inbound: "in", outbound: "out", bag: "0160892014" };
    const bagsClosed = transferSelection(selected, { type: "back" });
    expect(bagsClosed).toEqual({ inbound: "in", outbound: "out", bag: null });
    const connectionClosed = transferSelection(bagsClosed, { type: "back" });
    expect(connectionClosed).toEqual({ inbound: "in", outbound: null, bag: null });
    expect(transferSelection(connectionClosed, { type: "back" })).toEqual(emptySelection);
  });
  it("switching parent clears incompatible child selection", () => {
    const selected = { inbound: "in", outbound: "out", bag: "0160892014" };
    expect(transferSelection(selected, { type: "outbound", id: "other" })).toEqual({ inbound: "in", outbound: "other", bag: null });
    expect(transferSelection(selected, { type: "inbound", id: "new" })).toEqual({ inbound: "new", outbound: null, bag: null });
  });
  it("close removes whole workbench and bag selection needs pair", () => {
    expect(transferSelection({ inbound: "in", outbound: "out", bag: "bag" }, { type: "close" })).toEqual(emptySelection);
    expect(transferSelection(emptySelection, { type: "bag", id: "bag" })).toEqual(emptySelection);
  });
});
