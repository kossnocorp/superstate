import { QUtils } from "./utils.js";

/**
 * The root QCraft namespace. It contains all the QCraft types and functions.
 */
export namespace Q {
  /**
   * The machine entity.
   */
  export interface Entity<Type extends string> {
    /** The entity type. */
    type: Type;
  }

  /**
   * The machine state object.
   */
  export interface State<Kind extends string> extends Entity<"state"> {
    /** The state kind. */
    kind: Kind;
  }

  /**
   * Acceptable machine state type. Unions with string allowing to define states
   * using a shortcut.
   */
  export type StateType = State<string> | (string & {});

  /**
   * Resolves state object type from the shortcut definition.
   */
  export type NormalizedState<Type extends StateType> = Type extends string
    ? State<Type>
    : Type;

  /**
   * Resolves state kind from the state type.
   */
  export type StateKind<Type extends StateType> = Type extends State<infer Kind>
    ? Kind
    : Type;

  /**
   * The machine action object.
   */
  export interface Action<Kind extends string> extends Entity<"action"> {
    /** The action kind. */
    kind: Kind;
  }

  /**
   * Acceptable machine action type. Unions with string allowing to define
   * actions using a shortcut.
   */
  export type ActionType = Action<string> | (string & {});

  /**
   * Resolves action object type from the shortcut definition.
   */
  export type NormalizedAction<Type extends ActionType> = Type extends string
    ? Action<Type>
    : Type;

  /**
   * Resolves action kind from the action type.
   */
  export type ActionKind<Type extends ActionType> = Type extends Action<
    infer Kind
  >
    ? Kind
    : Type;

  /**
   * The machine transition definitions
   */
  export type TransitionDefs<
    MachineState extends StateType,
    MachineAction extends ActionType
  > = [
    InitialTransitionDef<MachineState>,
    ...TransitionDef<MachineState, MachineAction>[]
  ];

  /**
   * The machine transition definition.
   */
  export type TransitionDef<
    MachineState extends StateType,
    MachineAction extends ActionType
  > = `${StateKind<MachineState>} --> ${StateKind<MachineState>}: ${ActionKind<MachineAction>}`;

  /**
   * The machine transition definition.
   */
  export type InitialTransitionDef<MachineState extends StateType> =
    `[*] --> ${StateKind<MachineState>}`;

  /**
   * The transition type.
   */
  export interface Transition<
    MachineState extends StateType,
    MachineAction extends ActionType
  > {
    /** The transition action. */
    action: ActionKind<MachineAction>;
    /** The from state. */
    from: StateKind<MachineState>;
    /** The to state. */
    to: StateKind<MachineState>;
  }

  /**
   * The state machine.
   */
  export abstract class Machine<
    MachineState extends StateType,
    MachineAction extends ActionType
  > {
    /** The machine name. */
    name: string;

    /** Initial state. */
    initialState: StateKind<MachineState>;

    /** Current state. */
    state: NormalizedState<MachineState>;

    /** Avaliable transitions. */
    transitions: Transition<MachineState, MachineAction>[];

    /**
     * The state machine.
     *
     * @param name - The state name
     * @param transitions - The transition definitions.
     */
    constructor(
      name: string,
      transitions: TransitionDefs<MachineState, MachineAction>
    ) {
      this.name = name;

      const [initialDef, ...defs] = transitions;
      this.initialState = this.parseInitialTransition(initialDef);
      this.state = this.normalizeState(this.initialState);
      this.transitions = defs.map(this.parseTransition);
    }

    /**
     * Sends an action to the machine.
     */
    send(action: MachineAction) {
      const transition = this.transitions.find(
        (transition) =>
          transition.from === this.state.kind && transition.action === action
      );

      if (!transition) return null;
      return (this.state = this.normalizeState(transition.to));
    }

    /**
     * Normalizes the state to the state object.
     *
     * @param state - The state type, either an object or string.
     *
     * @returns Normalized state object.
     */
    private normalizeState(state: MachineState | StateKind<MachineState>) {
      return (
        typeof state === "string" ? { type: "state", kind: state } : state
      ) as NormalizedState<MachineState>;
    }

    /**
     * Normalizes the action to the action object.
     *
     * @param action - The action type, either an object or string.
     *
     * @returns Normalized action object.
     */
    private normalizeAction(action: MachineAction) {
      return (
        typeof action === "string" ? { type: "state", kind: action } : action
      ) as NormalizedAction<MachineAction>;
    }

    /**
     * Parses the initial transition definition.
     *
     * @param transition - The initial transition definition.
     *
     * @returns The initial state
     */
    private parseInitialTransition(
      transition: InitialTransitionDef<MachineState>
    ) {
      const [_, state] = transition.match(/^\[\*\] --> (.+)$/) || [];

      const valid = typeof state === "string";
      if (!valid)
        throw new Error(`Invalid initial transition definition: ${transition}`);

      return state as StateKind<MachineState>;
    }

    /**
     * Parses the transition definition.
     *
     * @param transition - The transition definition.
     *
     * @returns The transition object.
     */
    private parseTransition(
      transition: TransitionDef<MachineState, MachineAction>
    ) {
      const [_, from, to, action] =
        transition.match(/^(.+) --> (.+): (.+)$/) || [];

      const valid =
        typeof from === "string" &&
        typeof to === "string" &&
        typeof action === "string";
      if (!valid)
        throw new Error(`Invalid transition definition: ${transition}`);

      return { action, from, to } as Transition<MachineState, MachineAction>;
    }
  }
}

/**
 * The root QCraft namespace. It contains all the QCraft types and functions.
 * It's a WIP API revamp.
 */
export namespace QQ {
  export interface Generator<StateName extends string> {
    (q: GeneratorHelpers<StateName> & any): StateMap<StateName>;
  }

  export interface GeneratorHelpers<StateName extends string> {
    (): State<StateName>;

    entry(): State<StateName, true>;
  }

  export type StateMap<StateName extends string> = {
    [Name in StateName]: State<StateName, boolean>;
  };

  export interface State<
    StateName extends string,
    Entry extends boolean = false
  > {
    entry: Entry;
  }

  export type AnyAction =
    | ActionTransition<string, string, string, string>
    | ActionTransitionFork<string, string, string, string, string>
    | ActionExit<string, string, string>
    | ActionExitFork<string, string, string, string>;

  export interface ActionTransition<
    ActionName extends string,
    StateName extends string,
    FromState extends StateName,
    ToState extends StateName
  > {
    name: ActionName;
    from: FromState;
    to: ToState;
  }

  // TODO: I don't like fork name
  export interface ActionTransitionFork<
    ActionName extends string,
    StateName extends string,
    FromState extends StateName,
    ToState extends StateName,
    ActionCondition extends string
  > {
    name: ActionName;
    condition: ActionCondition;
    from: FromState;
    to: ToState;
  }

  export interface ActionExit<
    ActionName extends string,
    StateName extends string,
    FromState extends StateName
  > {
    name: ActionName;
    from: FromState;
  }

  // TODO: Add tysts
  export interface ActionExitFork<
    ActionName extends string,
    StateName extends string,
    FromState extends StateName,
    ActionCondition extends string
  > {
    name: ActionName;
    condition: ActionCondition;
    from: FromState;
  }

  export interface ExitState<
    StateName extends string,
    MachineAction extends AnyAction,
    ActionCondition extends string | null | never
  > {}

  export interface MachineFactory<
    StateName extends string,
    MachineAction extends AnyAction,
    EntryState extends StateName
  > {
    enter(
      ...args: QUtils.IsUnion<EntryState> extends true
        ? [EntryState]
        : [] | [EntryState]
    ): MachineInstance<StateName, MachineAction, EntryState>;
  }

  export interface Off {
    (): void;
  }

  export type OnTarget<
    StateName extends string,
    MachineAction extends AnyAction
  > = "*" | StateName | MachineAction["name"];

  export type Event<
    StateName extends string,
    MachineAction extends AnyAction
  > = EventState<StateName> | EventAction<MachineAction>;

  export interface EventState<StateName extends string> {
    type: "state";
    state: StateName;
  }

  export interface EventAction<MachineAction extends AnyAction> {
    type: "action";
    action: MachineAction;
    // TODO: from, to, condition
  }

  export interface OnListener<
    StateName extends string,
    MachineAction extends AnyAction,
    Target extends OnTarget<string, any>
  > {
    (
      event: Target extends "*"
        ? Event<StateName, MachineAction>
        : Target extends
            | Array<infer StateTarget extends StateName>
            | infer StateTarget extends StateName
        ? EventState<StateTarget>
        : never
    ): void;
  }

  export interface MachineInstance<
    StateName extends string,
    MachineAction extends AnyAction,
    EntryState extends StateName
  > {
    send<SendAction extends MachineAction, Name extends SendAction["name"]>(
      action: Name,
      ...args: SendAction extends ActionTransitionFork<
        Name,
        string,
        string,
        string,
        infer Condition
      >
        ? [Condition] | []
        : []
    ): void;

    on<Target extends OnTarget<StateName, MachineAction>>(
      target: Target | Target[],
      listener: OnListener<StateName, MachineAction, Target>
    ): Off;
  }

  export interface Builder {
    <
      StateName extends string,
      MachineAction extends AnyAction,
      EntryState extends StateName
    >(
      name: string,
      generator: Generator<StateName>
    ): MachineFactory<StateName, MachineAction, EntryState>;
  }

  export interface Builder2 {
    <
      StateName extends string,
      MachineAction extends AnyAction,
      EntryState extends StateName
    >(
      name: string,
      generator: Generator<StateName>
    ): MachineFactory<StateName, MachineAction, EntryState>;
  }
}

// @ts-expect-error: This is fine, it's just a placeholder
export const q: QQ.Builder = (() => {}) as QQ.Builder;
