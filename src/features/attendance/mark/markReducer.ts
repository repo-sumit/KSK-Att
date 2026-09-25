import type { Mark, StatusCode } from '@/domain/status';

export type MarksState = Readonly<Record<string, Mark>>;

export type MarkAction =
  | { readonly type: 'status'; readonly id: string; readonly status: StatusCode }
  | { readonly type: 'detail'; readonly id: string; readonly mark: Mark }
  | { readonly type: 'reset'; readonly marks: MarksState };

/** Each action replaces exactly one row's object, so every other row keeps its reference (memoised rows skip re-render). */
export function markReducer(state: MarksState, action: MarkAction): MarksState {
  switch (action.type) {
    case 'reset':
      return action.marks;
    case 'status': {
      const current = state[action.id];
      if (current?.status === action.status && !current.half && !current.leaveType) return state;
      return { ...state, [action.id]: { status: action.status } };
    }
    case 'detail':
      return { ...state, [action.id]: action.mark };
  }
}
