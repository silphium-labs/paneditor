import { signal } from '../signal.js';
import SystemTray from '../SystemTray/SystemTray.js';
import AppFrame from '../AppFrame/AppFrame.js';
import './System.css';
import { freezeRecord } from '@bablr/agast-helpers/object';
import { treeFromString } from '@bablr/agast-helpers/tree';

let defaultFs = treeFromString(`
  <Directory>
    Desktop:
    <Directory>
      foo: <File "Foo file content" />
      bar: <File "Bar file content" />
    </>
  </>`);

// prettier-ignore
let System = ({ keydown, keyup }) => function* () {
  let activeApp = signal();
  let cwd = signal(freezeRecord([]));
  let fs = signal(defaultFs);


    yield '<div {class: "system"}>';
      yield '<(SystemTray)>';
   yield SystemTray({ activeApp, keydown, keyup });
   yield '</>';
   yield    '<(AppFrame)>';
   yield     AppFrame({ activeApp, keydown, keyup, cwd, fs });
   yield     '</>';
   yield  '</>';

}

export default System;
