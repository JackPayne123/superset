import type { WorkspaceStore } from "@superset/panes";
import { workspaceTrpc } from "@superset/workspace-client";
import { useMemo, useState } from "react";
import { LuActivity } from "react-icons/lu";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { PaneViewerData } from "../../../../types";
import {
	ActivityTab,
	type ActivityItem,
	ActivityTabActions,
	type ActivityScope,
} from "../../components/ActivityTab";
import type { SidebarTabDefinition } from "../../types";

interface UseActivityTabParams {
	workspaceId: string;
	store: StoreApi<WorkspaceStore<PaneViewerData>>;
	onSelectFile: (absolutePath: string, openInNewTab?: boolean) => void;
}

/**
 * Drives the "Activity" sidebar tab: a reverse-chronological stream of files
 * the agent has read/edited, fed by the custom `superset-activity.sh` hook.
 * Deduped to one row per file (most recent touch), with edits emphasized.
 */
export function useActivityTab({
	workspaceId,
	store,
	onSelectFile,
}: UseActivityTabParams): SidebarTabDefinition {
	const [scope, setScope] = useState<ActivityScope>("pane");
	const [showReads, setShowReads] = useState(true);

	// terminalId of the active agent pane — used to scope the stream to it.
	const activeTerminalId = useStore(store, (s) => {
		const tab = s.tabs.find((t) => t.id === s.activeTabId);
		const pane = tab?.activePaneId ? tab.panes[tab.activePaneId] : undefined;
		const data = pane?.data;
		return data && "terminalId" in data
			? (data.terminalId as string)
			: undefined;
	});

	const query = workspaceTrpc.activity.recent.useQuery(
		{ workspaceId },
		{
			enabled: !!workspaceId,
			refetchInterval: 1500,
			refetchOnWindowFocus: true,
		},
	);

	const paneScopeAvailable = !!activeTerminalId;
	const effectiveScope: ActivityScope =
		scope === "pane" && paneScopeAvailable ? "pane" : "workspace";

	const items = useMemo<ActivityItem[]>(() => {
		const all = query.data ?? [];
		// Entries arrive newest-first; first insert per path wins the timestamp.
		const seen = new Map<string, ActivityItem>();
		for (const e of all) {
			if (effectiveScope === "pane" && e.terminalId !== activeTerminalId) {
				continue;
			}
			const existing = seen.get(e.path);
			if (existing) {
				existing.write = existing.write || e.kind === "write";
			} else {
				seen.set(e.path, { path: e.path, ts: e.ts, write: e.kind === "write" });
			}
		}
		const list = [...seen.values()];
		return showReads ? list : list.filter((i) => i.write);
	}, [query.data, effectiveScope, activeTerminalId, showReads]);

	return {
		id: "activity",
		label: "Activity",
		icon: LuActivity,
		badge: items.length,
		actions: (
			<ActivityTabActions
				scope={scope}
				onScopeChange={setScope}
				showReads={showReads}
				onShowReadsChange={setShowReads}
				paneScopeAvailable={paneScopeAvailable}
			/>
		),
		content: <ActivityTab items={items} onSelectFile={onSelectFile} />,
	};
}
