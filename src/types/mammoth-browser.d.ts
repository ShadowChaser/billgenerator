declare module "mammoth/mammoth.browser" {
  // The browser build exposes extractRawText and convertToHtml among others
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
  export function convertToHtml(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
  const _default: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
  };
  export default _default;
}
