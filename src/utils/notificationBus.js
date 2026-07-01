// Simple event bus so any page can push a notification to the bell
const listeners = new Set();

export const notifyBus = {
  push(notification) {
    // notification: { type: 'success'|'info'|'warning', title, body, time }
    const item = { id: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...notification };
    listeners.forEach(fn => fn(item));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
