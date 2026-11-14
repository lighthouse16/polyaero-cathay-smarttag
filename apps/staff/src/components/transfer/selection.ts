export interface TransferSelection { outbound: string | null; inbound: string | null; bag: string | null }
export const emptySelection: TransferSelection = { outbound: null, inbound: null, bag: null };
export type SelectionAction = { type: "outbound" | "inbound" | "bag"; id: string } | { type: "back" | "close" };
export function transferSelection(state: TransferSelection, action: SelectionAction): TransferSelection {
  switch (action.type) {
    case "outbound": return { outbound: action.id, inbound: null, bag: null };
    case "inbound": return state.outbound ? { ...state, inbound: action.id, bag: null } : state;
    case "bag": return state.outbound && state.inbound ? { ...state, bag: action.id } : state;
    case "back": return state.bag ? { ...state, bag: null } : state.inbound ? { ...state, inbound: null } : emptySelection;
    case "close": return emptySelection;
  }
}
