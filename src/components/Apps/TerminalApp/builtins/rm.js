import { Path, get } from '@bablr/agast-helpers/path';
import { freezeRecord } from '@bablr/agast-helpers/object';
// import { fs, writeFs } from '../filesystem.js';

function* rm(args) {
  let { 0: file } = args;

  if (!file) {
    return freezeRecord({ success: false, data: freezeRecord({ reason: 'BAD_ARGS' }) });
  }

  let resolvedPath = cwd.concat([file]);

  let existing = get(resolvedPath, fs);

  let newFs = fs;

  if (existing.value.name !== Symbol.for('Directory')) {
    newFs = Path.from(fs).removeAt(resolvedPath).node;
  }

  writeFs(newFs);

  return freezeRecord({ success: true, data: undefined });
}

export default rm;
