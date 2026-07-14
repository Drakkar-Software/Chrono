// Resolution shim for TypeScript and non-platform bundlers. At runtime Metro
// resolves `Button.web.tsx` (web) or `Button.native.tsx` (native) ahead of this
// file; both implement the same `ButtonProps` contract.
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types';
export { Button } from './Button.web';
