import { WebviewMessage, ExtensionMessage } from '@agentlens/types';

interface VSCodeApi {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

let api: VSCodeApi | undefined;

export function getVSCodeApi(): VSCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

export function postMessage(message: WebviewMessage): void {
  getVSCodeApi().postMessage(message);
}

export function onMessage(handler: (message: ExtensionMessage) => void): () => void {
  const listener = (event: MessageEvent<ExtensionMessage>) => {
    handler(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
