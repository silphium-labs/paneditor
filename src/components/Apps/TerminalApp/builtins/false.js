import { freezeRecord } from '@bablr/agast-helpers/object';
import { StreamIterable } from '@bablr/stream-iterator';

function* __false(args) {
  let { 0: reason } = args;

  return freezeRecord({ success: false, data: reason ? freezeRecord({ reason }) : undefined });
}

let false_ = (args) => {
  return new StreamIterable(__false(args));
};

export default false_;
