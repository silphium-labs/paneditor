import { parseTag, printString } from 'agast';
import { get } from '@bablr/agast-helpers/path';
import { streamFromTree } from '@bablr/agast-helpers/stream';
import { CloseTag, OpenTag } from '@bablr/agast-helpers/symbols';
// import { fs } from '../filesystem.js';

import { StreamIterable } from '@bablr/stream-iterator';
import { freezeRecord } from '@bablr/agast-helpers/object';

function* __tree(args) {
  let { 0: file } = args;

  if (!file) {
    return freezeRecord({ success: false, data: freezeRecord({ reason: 'BAD_ARGS' }) });
  }

  let resolvedPath = cwd.concat([file]);

  let existing = get(resolvedPath, fs);

  if (!existing) {
    return freezeRecord({ success: false, data: freezeRecord({ reason: 'FILE_NOT_FOUND' }) });
  }

  let first = true;
  let depth = 0;
  for (let tag of streamFromTree(existing)) {
    if (!first) yield String.raw`<* '\n' />`;
    let tag_ = parseTag(tag);

    debugger;
    if (tag_.type === CloseTag) --depth;

    yield String.raw`<* ${printString('  '.repeat(depth))} />`;

    yield* streamFromTree(buildTag(tag_));

    if (tag_.type === OpenTag && !tag_.value.isSelfClosing) ++depth;
    first = false;
  }

  return deepFreezeRecord({ success: true, data: undefined });
}

let tree = (args) => {
  return new StreamIterable(__tree(args));
};

export default tree;
