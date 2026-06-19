import { useState, type DragEvent } from "react";

// Minimal HTML5 drag-and-drop reordering. Returns props to spread on each item
// and the currently dragged-over index for styling.
export function useSortable(onReorder: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const itemProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragging(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (over !== index) setOver(index);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragging !== null && dragging !== index) onReorder(dragging, index);
      setDragging(null);
      setOver(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });

  return { dragging, over, itemProps };
}
