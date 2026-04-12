import { toast } from "sonner";

export const notify = {
  success(msg: string) {
    toast.success(msg);
  },
  error(msg: string, err?: unknown) {
    const detail = err instanceof Error ? err.message : typeof err === "string" ? err : undefined;
    toast.error(detail ? `${msg}: ${detail}` : msg);
  },
  undoable(msg: string, onUndo: () => void) {
    toast(msg, {
      action: {
        label: "Undo",
        onClick: onUndo,
      },
    });
  },
};
