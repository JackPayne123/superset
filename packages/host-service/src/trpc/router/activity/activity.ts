import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { protectedProcedure, router } from "../../index";

/**
 * A single file touch by an agent, as recorded by the custom
 * `superset-activity.sh` PostToolUse hook. The hook writes one JSON object per
 * line into `$SUPERSET_HOME_DIR/activity/<workspaceId>.jsonl`, keyed by the
 * agent's terminal id so the sidebar can scope the stream to one pane.
 */
export interface ActivityEntry {
	/** Unix seconds. */
	ts: number;
	/** Raw tool name (Read, Edit, Write, MultiEdit, NotebookEdit). */
	tool: string;
	/** Absolute path of the touched file. */
	path: string;
	/** SUPERSET_TERMINAL_ID of the agent pane that touched it. */
	terminalId: string;
	/** SUPERSET_PANE_ID when available (v1 terminals only); may be empty. */
	paneId: string;
	/** Coarse classification: writes are emphasized in the UI. */
	kind: "read" | "write";
}

const WRITE_TOOLS = new Set([
	"Edit",
	"Write",
	"MultiEdit",
	"NotebookEdit",
	"Create",
]);

const MAX_ENTRIES = 1000;
// Read at most this many bytes from the tail. The log is append-only and never
// rotated, so cap the read instead of letting a long-lived workspace block the
// UI poll. ~120 bytes/line means this still covers thousands of recent touches.
const MAX_TAIL_BYTES = 512 * 1024;

function activityDir(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "activity");
}

/** Read the tail of the log, dropping a leading partial line when truncated. */
function readTail(filePath: string): string {
	const { size } = statSync(filePath);
	if (size <= MAX_TAIL_BYTES) {
		return readFileSync(filePath, "utf-8");
	}
	const fd = openSync(filePath, "r");
	try {
		const buf = Buffer.alloc(MAX_TAIL_BYTES);
		readSync(fd, buf, 0, MAX_TAIL_BYTES, size - MAX_TAIL_BYTES);
		const text = buf.toString("utf-8");
		return text.slice(text.indexOf("\n") + 1);
	} finally {
		closeSync(fd);
	}
}

export const activityRouter = router({
	/**
	 * Recent file touches for a workspace, newest first. Pane scoping and
	 * read/write filtering happen client-side so the toggles are instant and
	 * don't refetch.
	 */
	recent: protectedProcedure
		.input(z.object({ workspaceId: z.string().min(1) }))
		.query(({ input }): ActivityEntry[] => {
			const file = join(activityDir(), `${input.workspaceId}.jsonl`);
			let raw: string;
			try {
				raw = readTail(file);
			} catch {
				// No activity logged for this workspace yet — empty, not an error.
				return [];
			}

			const entries: ActivityEntry[] = [];
			for (const line of raw.split("\n")) {
				if (!line.trim()) continue;
				try {
					const o = JSON.parse(line) as Partial<ActivityEntry>;
					if (!o.path || typeof o.ts !== "number") continue;
					const tool = o.tool ?? "";
					entries.push({
						ts: o.ts,
						tool,
						path: o.path,
						terminalId: o.terminalId ?? "",
						paneId: o.paneId ?? "",
						kind: WRITE_TOOLS.has(tool) ? "write" : "read",
					});
				} catch {
					// Skip a malformed line (e.g. a partially-flushed tail write).
				}
			}

			entries.reverse();
			return entries.slice(0, MAX_ENTRIES);
		}),
});
