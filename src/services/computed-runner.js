import vm from 'vm';
import builtins from '../utils/builtins.js';

export function run(computedSource, data) {
  if (!computedSource) return {};

  const sandbox = {
    module: { exports: null },
    data: Object.freeze(structuredClone(data)),
    utils: Object.freeze({ ...builtins }),
    console: { log: () => {} },
  };

  const script = new vm.Script(
    `${computedSource}\nmodule.exports = module.exports(data, utils);`
  );
  const context = vm.createContext(sandbox);
  script.runInContext(context, { timeout: 2000 });

  return sandbox.module.exports || {};
}
