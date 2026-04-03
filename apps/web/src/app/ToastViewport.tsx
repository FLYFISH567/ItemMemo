import type { ToastItem } from "./shared";

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
	return (
		<div className="toast-stack" aria-live="polite">
			{toasts.map((toast) => (
				<div key={toast.id} className={`toast toast-${toast.type}`}>
					<span>{toast.message}</span>
					<button onClick={() => onDismiss(toast.id)}>×</button>
				</div>
			))}
		</div>
	);
}

export default ToastViewport;
