/**
 * Convert a binary file into a Uint8Array for babel
 */
module.exports = function(content) {
  this.cacheable && this.cacheable();
  this.value = content;

  return 'module.exports = new Uint8Array([' + content.join(',') + ']);';
};

module.exports.raw = true;
