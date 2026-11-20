import * as Tags from '@bablr/agast-helpers/tags';
import { Path, get } from '@bablr/agast-helpers/path';
import { freezeRecord } from '@bablr/agast-helpers/object';
// import { fs, writeFs } from '../filesystem.js';

function* rmdir(args) {
  let { 0: file } = args;

  if (!file) {
    return freezeRecord({ success: false, data: freezeRecord({ reason: 'BAD_ARGS' }) });
  }

  let resolvedPath = cwd.concat([file]);

  let existing = get(resolvedPath, fs);

  let newFs = fs;

  if (existing.value.name === Symbol.for('Directory') && !Tags.getSize(existing.value.children)) {
    newFs = Path.from(fs).removeAt(resolvedPath).node;
  }

  writeFs(newFs);

  return freezeRecord({ success: true, data: undefined });
}

export default rmdir;
