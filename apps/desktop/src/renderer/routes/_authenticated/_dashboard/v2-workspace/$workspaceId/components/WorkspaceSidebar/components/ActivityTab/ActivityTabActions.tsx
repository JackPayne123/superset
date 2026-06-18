import { Button } from "@superset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { LuEye, LuEyeOff, LuLayoutGrid, LuSquareTerminal } from "react-icons/lu";

export type ActivityScope = "pane" | "workspace";

interface ActivityTabActionsProps {
	scope: ActivityScope;
	onScopeChange: (scope: ActivityScope) => void;
	showReads: boolean;
	onShowReadsChange: (showReads: boolean) => void;
	/** Pane scoping needs an active agent terminal; disabled otherwise. */
	paneScopeAvailable: boolean;
}

function ToggleButton({
	active,
	tooltip,
	onClick,
	disabled,
	children,
}: {
	active: boolean;
	tooltip: string;
	onClick: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className={cn("size-6", active && "bg-muted text-foreground")}
					onClick={onClick}
					disabled={disabled}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{tooltip}</TooltipContent>
		</Tooltip>
	);
}

export function ActivityTabActions({
	scope,
	onScopeChange,
	showReads,
	onShowReadsChange,
	paneScopeAvailable,
}: ActivityTabActionsProps) {
	const isPane = scope === "pane" && paneScopeAvailable;
	return (
		<>
			<ToggleButton
				active={showReads}
				tooltip={showReads ? "Showing reads + edits" : "Showing edits only"}
				onClick={() => onShowReadsChange(!showReads)}
			>
				{showReads ? (
					<LuEye className="size-3.5" />
				) : (
					<LuEyeOff className="size-3.5" />
				)}
			</ToggleButton>
			<ToggleButton
				active={isPane}
				disabled={!paneScopeAvailable}
				tooltip={
					!paneScopeAvailable
						? "Select an agent pane to scope by pane"
						: isPane
							? "Scope: this pane (click for whole workspace)"
							: "Scope: whole workspace (click for this pane)"
				}
				onClick={() => onScopeChange(isPane ? "workspace" : "pane")}
			>
				{isPane ? (
					<LuSquareTerminal className="size-3.5" />
				) : (
					<LuLayoutGrid className="size-3.5" />
				)}
			</ToggleButton>
		</>
	);
}
