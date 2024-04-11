import { type Superstate } from "../types.js";

/**
 * Generates a Mermaid diagram from the given statechart factory.
 *
 * @param factory - The statechart factory to generate the diagram from.
 *
 * @returns The Mermaid diagram.
 */
export function toMermaid<State extends Superstate.States.AnyState>(
  factory: Superstate.Factories.MachineFactory<State>
) {
  return [
    "%% Generated with Superstate",
    "stateDiagram-v2",
    ...indentLines(toStatechartLines(factory)),
  ].join("\n");
}

/**
 * Generates Mermaid state lines from the statechart factory.
 *
 * @param factory - The statechart factory to generate the diagram from.
 * @param parentName - The parent name path.
 *
 * @returns Mermaid state lines.
 */
function toStatechartLines<State extends Superstate.States.AnyState>(
  factory: Superstate.Factories.MachineFactory<State>,
  parentName?: string,
  as?: string,
  nameWithActions?: string
) {
  const name = as || factory.name;
  const namePath = parentName ? `${parentName}.${name}` : name;
  const formatName = (entity: string) => `${namePath}.${entity}`;

  const lines = [
    `[*] --> ${formatName(factory.states[0]?.name || "")}`,
    ...toTransitionLines(factory.states, formatName),
    ...toStateLines(factory.states, namePath, formatName),
  ];

  return [
    `state "${nameWithActions || name}" as ${namePath} {`,
    ...indentLines(lines),
    "}",
  ];
}

/**
 * Generates Mermaid transition lines from the given states.
 *
 * @param states - The states to generate transitions from.
 * @param formatName - The function to format the name.
 *
 * @returns Mermaid transition lines for the given states.
 */
function toTransitionLines(
  states: Superstate.States.BuilderState[],
  formatName: FormatName
) {
  const lines: string[] = [];
  for (const state of states) {
    for (const transition of state.transitions) {
      lines.push(
        `${formatName(transition.from)} --> ${formatName(
          transition.to
        )} : ${formatTransitionTraits(transition, formatName)}`
      );
    }

    const substates = Object.entries(state.sub);
    if (substates.length === 1) {
      for (const transition of substates[0]![1].transitions) {
        lines.push(
          `${formatName(state.name)}.${transition.from} --> ${formatName(
            transition.to
          )} : ${transition.event}`
        );
      }
    } else if (substates.length > 1) {
      for (const [substateName, substate] of substates) {
        for (const transition of substate.transitions) {
          lines.push(
            `${formatName(state.name)}.${substateName}.${
              transition.from
            } --> ${formatName(transition.to)} : ${transition.event}`
          );
        }
      }
    }
  }
  return lines;
}

function toStateLines(
  states: Superstate.States.BuilderState[],
  statechartName: string,
  formatName: FormatName
) {
  const lines: string[] = [];
  for (const state of states) {
    const nameWithActions = [state.name];
    for (const action of state.actions) {
      nameWithActions.push(
        `${action.type === "enter" ? "entry" : "exit"} / ${action.name}`
      );
    }

    const substates = Object.entries(state.sub);
    if (!substates.length) {
      lines.push(
        `state "${nameWithActions.join("\\n")}" as ${formatName(state.name)}`
      );
    } else if (substates.length === 1) {
      lines.push(
        ...toStatechartLines(
          substates[0]![1].factory,
          statechartName,
          state.name,
          nameWithActions.join("\\n")
        )
      );
    } else if (substates.length > 1) {
      lines.push(
        `state "${nameWithActions.join("\\n")}" as ${formatName(state.name)} {`
      );
      substates.forEach(([substateName, substate], index) => {
        lines.push(
          ...indentLines(
            toStatechartLines(
              substate.factory,
              formatName(state.name),
              substateName
            )
          )
        );
        if (index !== substates.length - 1) lines.push(indentLine("--"));
      });
      lines.push("}");
    }
  }
  return lines;
}

/**
 * Formats the given transition traits (event, condition, action) into a string.
 *
 * @param transition - The transition to format
 * @param formatName - The function to format the name
 *
 * @returns Formatted transition traits
 */
function formatTransitionTraits(
  transition: Superstate.Transitions.AnyTransition,
  formatName: FormatName
) {
  const lines = [transition.event];
  if (transition.condition) lines.push(`if [${transition.condition}]`);
  if (transition.action) lines.push(`do / ${transition.action.name}`);
  return lines.join("\\n");
}

/**
 * Indents the given lines on the given level.
 *
 * @param lines - The lines to indent.
 * @param level - The indentation level.
 *
 * @returns The indented lines.
 */
function indentLines(lines: string[], level = 1) {
  return lines.map((line) => indentLine(line, level));
}

/**
 * Indents the given line on the given level.
 *
 * @param line - The line to indent.
 * @param level - The indentation level.
 *
 * @returns The indented line.
 */
function indentLine(line: string, level = 1) {
  return "\t".repeat(level) + line;
}

/**
 * Name formatting function, prefixes the name with curried prefix.
 */
type FormatName = (name: string) => string;
