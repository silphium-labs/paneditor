import * as Tags from '@bablr/agast-helpers/tags';
import { get } from '@bablr/agast-helpers/path';
import { freezeRecord } from '@bablr/agast-helpers/object';
import { parseTag, printString } from 'agast';

function* ls({ cwd, fs, dir, flags = freezeRecord({ all: false }) }) {
  let resolvedDir = dir ? cwd.concat([dir]) : cwd;

  let target = resolvedDir.length ? get(resolvedDir, fs) : fs;

  if (flags.all) {
    yield '<Directory>';
    yield printString('./');
    yield '</>';
    yield String.raw`<* '\n' />`;
    if (resolvedDir.length) {
      yield '<Directory>';
      yield printString('../');
      yield '</>';
      yield String.raw`<* '\n' />`;
    }
  }

  for (let tag of Tags.traverseChildren(target)) {
    let isDir = parseTag(tag[4][0]).value.name === Symbol.for('Directory');

    yield isDir ? '<Directory>' : '<File>';
    yield printString(parseTag(tag[0]).value.name + (isDir ? '/' : ''));
    yield '</>';
    yield String.raw`<* '\n' />`;
  }

  return freezeRecord({ success: true, data: undefined });
}

export default ls;
