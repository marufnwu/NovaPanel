/// <reference types="vite/client" />

interface Document {
  query(selector: string): Element | null;
}

interface Element {
  click(): void;
}
