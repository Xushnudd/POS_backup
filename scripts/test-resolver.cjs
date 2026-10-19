const Module = require('node:module');
const path = require('node:path');
const original = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(__dirname, '../.test-build/src', name.slice(2));
  return original.call(this, name, parent, ...rest);
};
