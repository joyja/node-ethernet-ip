const Controller = require('./lib/controller');
const Tag = require('./lib/tag');
const TagGroup = require('./lib/tag-group');
const EthernetIP = require('./lib/enip');
const util = require('./lib/utilities');
const TagList = require('./lib/tag-list');
const { Structure } = require('./lib/structure');

module.exports = {
  Controller,
  Tag,
  TagGroup,
  EthernetIP,
  util,
  TagList,
  Structure,
};
