/// <reference types="vite/client" />

// Allow importing YAML files as raw strings
declare module '*.yml?raw' {
  const content: string;
  export default content;
}

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

