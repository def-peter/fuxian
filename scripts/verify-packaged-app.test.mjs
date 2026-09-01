import { describe, expect, it } from 'vitest';

import { findExternalRuntimeImports } from './verify-packaged-app.mjs';

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
});
