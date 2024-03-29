import { Q } from "../index.js";

/**
 * The Superstate Mermaid namespace. It contains functions to generate Mermaid
 * diagrams from Superstate machines.
 */
export namespace QMermaid {
  /**
   * Generates a Mermaid diagram from the given machine.
   *
   * @param machine - The machine to generate the diagram from.
   *
   * @returns The Mermaid diagram.
   */
  export function generate(machine: Q.Machine<any, any>) {
    return [
      "%% Generated with Superstate",
      "stateDiagram-v2",
      ...indentLines(machineToState(machine)),
    ].join("\n");
  }

  /**
   * Generates Mermaid state lines from the given machine.
   *
   * @param machine - The machine to generate the diagram from.
   * @param parentName - The parent machine name.
   *
   * @returns Mermaid state lines.
   */
  function machineToState(machine: Q.Machine<any, any>, parentName?: string) {
    const name = parentName ? `${parentName}.${machine.name}` : machine.name;
    const named = (entity: string) => `${name}.${entity}`;

    const transitions = [
      `[*] --> ${named(machine.initialState)}`,
      ...machine.transitions.map(
        (transition) =>
          `${named(transition.from)} --> ${named(transition.to)}: ${named(
            transition.action
          )}`
      ),
    ];

    return [`state "${name}" as ${name} {`, ...indentLines(transitions), "}"];
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
}
