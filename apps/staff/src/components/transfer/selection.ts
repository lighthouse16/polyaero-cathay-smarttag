export interface TransferSelection { inbound: string | null; outbound: string | null; bag: string | null }
export const emptySelection: TransferSelection = { inbound: null, outbound: null, bag: null };
export type SelectionAction = { type: "inbound" | "outbound" | "bag"; id: string } | { type: "back" | "close" };
export function transferSelection(state: TransferSelection, action: SelectionAction): TransferSelection {
  switch (action.type) {
    case "inbound": return { inbound: action.id, outbound: null, bag: null };
    case "outbound": return state.inbound ? { ...state, outbound: action.id, bag: null } : state;
    case "bag": return state.inbound && state.outbound ? { ...state, bag: action.id } : state;
    case "back": return state.bag ? { ...state, bag: null } : state.outbound ? { ...state, outbound: null } : emptySelection;
    case "close": return emptySelection;
  }
}
