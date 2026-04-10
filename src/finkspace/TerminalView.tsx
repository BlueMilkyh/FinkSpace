import { useRef } from "react";
import { useTerminal } from "./useTerminal";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  agentId: string;
  command: string;
  args: string[];
  cwd: string;
  color: string;
  isVisible: boolean;
}

export function TerminalView({ agentId, command, args, cwd, color, isVisible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, { agentId, command, args, cwd, color, isVisible });

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: "4px" }}
    />
  );
}
