import * as vscode from "vscode";
import type { Collector, ContextChunk } from "../types";

const MAX_COMMANDS = 5;
const MAX_OUTPUT_LINES = 50;

interface CapturedExecution {
  commandLine: string;
  output: string;
  endTime: number;
}

export class TerminalCollector implements Collector, vscode.Disposable {
  readonly name = "terminal";

  private readonly executions: CapturedExecution[] = [];
  private readonly subscriptions: vscode.Disposable[] = [];

  // In-flight output buffers keyed by execution object identity (via WeakMap)
  private readonly pending = new WeakMap<
    vscode.TerminalShellExecution,
    string[]
  >();

  constructor() {
    // Start buffering output when an execution begins.
    this.subscriptions.push(
      vscode.window.onDidStartTerminalShellExecution((e) => {
        const lines: string[] = [];
        this.pending.set(e.execution, lines);
        void this.readStream(e.execution, lines);
      })
    );

    // Capture the final snapshot when the execution ends.
    this.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
        const commandLine = e.execution.commandLine.value;
        const lines = this.pending.get(e.execution) ?? [];
        this.pending.delete(e.execution);

        const trimmed = lines
          .join("")
          .split("\n")
          .slice(0, MAX_OUTPUT_LINES)
          .join("\n")
          .trim();

        this.executions.unshift({
          commandLine,
          output: trimmed,
          endTime: Date.now(),
        });

        if (this.executions.length > MAX_COMMANDS) {
          this.executions.length = MAX_COMMANDS;
        }
      })
    );
  }

  private async readStream(
    execution: vscode.TerminalShellExecution,
    lines: string[]
  ): Promise<void> {
    try {
      for await (const data of execution.read()) {
        lines.push(data);
      }
    } catch {
      // Shell integration unavailable or stream ended unexpectedly — silent fallback.
    }
  }

  dispose(): void {
    for (const sub of this.subscriptions) sub.dispose();
  }

  async collect(): Promise<ContextChunk[]> {
    return this.executions.map((ex) => ({
      source: "terminal" as const,
      content: ex.output
        ? `$ ${ex.commandLine}\n${ex.output}`
        : `$ ${ex.commandLine}`,
      metadata: { timestamp: ex.endTime },
    }));
  }
}
