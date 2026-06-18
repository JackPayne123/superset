import { cn } from "@superset/ui/utils";
import { useEffect, useState } from "react";
import { LuEye, LuFilePen } from "react-icons/lu";

export interface ActivityItem {
	path: string;
	/** Unix seconds of the most recent touch. */
	ts: number;
	/** True if the file was ever written/edited in the recorded window. */
	write: boolean;
}

interface ActivityTabProps {
	items: ActivityItem[];
	onSelectFile: (absolutePath: string, openInNewTab?: boolean) => void;
}

function basename(p: string): string {
	const i = p.replace(/\/+$/, "").lastIndexOf("/");
	return i === -1 ? p : p.slice(i + 1);
}

function dirname(p: string): string {
	const i = p.replace(/\/+$/, "").lastIndexOf("/");
	return i <= 0 ? "" : p.slice(0, i);
}

function relativeTime(seconds: number, now: number): string {
	const diff = Math.max(0, now - seconds);
	if (diff < 5) return "now";
	if (diff < 60) return `${diff}s`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m`;
	if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
	return `${Math.floor(diff / 86_400)}d`;
}

export function ActivityTab({ items, onSelectFile }: ActivityTabProps) {
	// Tick once a second so relative timestamps stay fresh between data polls.
	// Local to this component so the rest of the sidebar doesn't re-render.
	const [nowSeconds, setNowSeconds] = useState(() =>
		Math.floor(Date.now() / 1000),
	);
	useEffect(() => {
		const id = setInterval(
			() => setNowSeconds(Math.floor(Date.now() / 1000)),
			1000,
		);
		return () => clearInterval(id);
	}, []);

	if (items.length === 0) {
		return (
			<div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
				No file activity yet. Files the agent reads or edits will appear here.
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
			{items.map((item) => {
				const dir = dirname(item.path);
				return (
					<button
						key={item.path}
						type="button"
						onClick={() => onSelectFile(item.path)}
						title={item.path}
						className="group flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-muted/60"
					>
						{item.write ? (
							<LuFilePen className="size-3.5 shrink-0 text-foreground" />
						) : (
							<LuEye className="size-3.5 shrink-0 text-muted-foreground/70" />
						)}
						<span className="flex min-w-0 flex-1 items-baseline gap-1.5">
							<span
								className={cn(
									"truncate text-xs",
									item.write
										? "font-medium text-foreground"
										: "text-muted-foreground",
								)}
							>
								{basename(item.path)}
							</span>
							{dir && (
								<span className="truncate text-[10px] text-muted-foreground/60">
									{dir}
								</span>
							)}
						</span>
						<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
							{relativeTime(item.ts, nowSeconds)}
						</span>
					</button>
				);
			})}
		</div>
	);
}
