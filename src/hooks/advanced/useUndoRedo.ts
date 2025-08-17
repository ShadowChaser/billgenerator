import { useCallback, useState } from "react";
import { Template } from "@/lib/advancedTypes";

export function useUndoRedo(
  currentTemplate: Template | null,
  setCurrentTemplate: (tpl: Template | null) => void,
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>
) {
  const [undoStack, setUndoStack] = useState<Template[]>([]);
  const [redoStack, setRedoStack] = useState<Template[]>([]);
  const maxUndoSteps = 50;

  const saveStateForUndo = useCallback(() => {
    if (currentTemplate) {
      setUndoStack((prev) => {
        const clonedTemplate = {
          ...JSON.parse(JSON.stringify(currentTemplate)),
          createdAt: new Date(currentTemplate.createdAt),
        } as Template;
        const newStack = [...prev, clonedTemplate];
        return newStack.slice(-maxUndoSteps);
      });
      setRedoStack([]);
    }
  }, [currentTemplate]);

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !currentTemplate) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    const clonedCurrent = {
      ...JSON.parse(JSON.stringify(currentTemplate)),
      createdAt: new Date(currentTemplate.createdAt),
    } as Template;
    setRedoStack((prev) => [...prev, clonedCurrent]);
    setUndoStack(newUndoStack);

    setCurrentTemplate(previousState);
    setTemplates((prev) => prev.map((t) => (t.id === previousState.id ? previousState : t)));
  }, [undoStack, currentTemplate, setTemplates, setCurrentTemplate]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !currentTemplate) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    const clonedCurrent = {
      ...JSON.parse(JSON.stringify(currentTemplate)),
      createdAt: new Date(currentTemplate.createdAt),
    } as Template;
    setUndoStack((prev) => [...prev, clonedCurrent]);
    setRedoStack(newRedoStack);

    setCurrentTemplate(nextState);
    setTemplates((prev) => prev.map((t) => (t.id === nextState.id ? nextState : t)));
  }, [redoStack, currentTemplate, setTemplates, setCurrentTemplate]);

  return {
    undoStack,
    redoStack,
    saveStateForUndo,
    undo,
    redo,
  } as const;
}
