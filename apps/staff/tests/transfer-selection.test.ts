import { describe, expect, it } from "vitest";
import { transferSelection, emptySelection } from "../src/components/transfer/selection";

describe("progressive transfer selection", () => {
  it("Escape removes one selection layer (bag -> inbound -> outbound)", () => {
    const selected = { outbound: "out", inbound: "in", bag: "0160892014" };
    const bagsClosed = transferSelection(selected, { type: "back" });
    expect(bagsClosed).toEqual({ outbound: "out", inbound: "in", bag: null });
    const feederClosed = transferSelection(bagsClosed, { type: "back" });
    expect(feederClosed).toEqual({ outbound: "out", inbound: null, bag: null });
    expect(transferSelection(feederClosed, { type: "back" })).toEqual(emptySelection);
  });
  it("switching parent clears incompatible child selection", () => {
    const selected = { outbound: "out", inbound: "in", bag: "0160892014" };
    expect(transferSelection(selected, { type: "inbound", id: "other" })).toEqual({ outbound: "out", inbound: "other", bag: null });
    expect(transferSelection(selected, { type: "outbound", id: "new" })).toEqual({ outbound: "new", inbound: null, bag: null });
  });
  it("close removes whole workbench and inbound/bag selection require parent layers", () => {
    expect(transferSelection({ outbound: "out", inbound: "in", bag: "bag" }, { type: "close" })).toEqual(emptySelection);
    expect(transferSelection(emptySelection, { type: "inbound", id: "in" })).toEqual(emptySelection);
    expect(transferSelection(emptySelection, { type: "bag", id: "bag" })).toEqual(emptySelection);
    expect(transferSelection({ outbound: "out", inbound: null, bag: null }, { type: "bag", id: "bag" })).toEqual({ outbound: "out", inbound: null, bag: null });
  });
});
