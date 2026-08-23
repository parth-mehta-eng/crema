const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScriptModule(relativePath) {
  const absolutePath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolutePath,
  });
  const loadedModule = { exports: {} };
  const execute = new Function('require', 'module', 'exports', outputText);
  execute(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

module.exports = { loadTypeScriptModule };
