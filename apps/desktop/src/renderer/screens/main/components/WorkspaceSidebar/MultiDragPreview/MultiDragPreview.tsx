import { useDragLayer } from "react-dnd";

export function MultiDragPreview() {
	const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
		isDragging: monitor.isDragging(),
		item: monitor.getItem(),
		currentOffset: monitor.getClientOffset(),
	}));

	if (
		!isDragging ||
		!currentOffset ||
		!item?.selectedIds ||
		item.selectedIds.length <= 1
	) {
		return null;
	}

	return (
		<div
			className="fixed pointer-events-none z-50"
			style={{
				left: currentOffset.x + 12,
				top: currentOffset.y - 12,
			}}
		>
			<div className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full shadow-md">
				{item.selectedIds.length} workspaces
			</div>
		</div>
	);
}
