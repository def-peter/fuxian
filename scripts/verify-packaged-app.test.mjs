import { describe, expect, it } from 'vitest';

import {
  findExternalRuntimeImports,
  hasRequiredMacHelperArchitectures,
} from './verify-packaged-app.mjs';

describe('packaged application verification', () => {
  it('allows Electron and Node built-ins in the main-process bundle', () => {
    expect(
      findExternalRuntimeImports(`
import { app } from "electron";
import fs from "fs";
import { readFile } from "node:fs/promises";
`),
    ).toEqual([]);
  });

  it('reports third-party imports left outside the main-process bundle', () => {
    expect(
      findExternalRuntimeImports(`
import { app } from "electron";
import { parseFragment } from "parse5";
import "side-effect-package";
`),
    ).toEqual(['parse5', 'side-effect-package']);
  });

  it('requires the macOS helper to support Intel and Apple Silicon', () => {
    expect(hasRequiredMacHelperArchitectures('x86_64 arm64')).toBe(true);
    expect(hasRequiredMacHelperArchitectures('arm64')).toBe(false);
  });
});
