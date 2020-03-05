const { CIP } = require('../../enip');

class Template {
  constructor() {
    this._attributes = {};
    this._members = [];
    this._name = '';
  }

  _buildGetTemplateAttributesCIP(templateID) {
    const attributeCount = Buffer.from([0x04, 0x00]);
    const attributeList = Buffer.from([
      0x04,
      0x00,
      0x05,
      0x00,
      0x02,
      0x00,
      0x01,
      0x00,
    ]); // Attributes 4, 5, 2, 1

    const { LOGICAL } = CIP.EPATH.segments;

    const path = Buffer.concat([
      LOGICAL.build(LOGICAL.types.ClassID, 0x6c),
      LOGICAL.build(LOGICAL.types.InstanceID, templateID),
    ]);

    return CIP.MessageRouter.build(
      CIP.MessageRouter.services.GET_ATTRIBUTES,
      path,
      Buffer.concat([attributeCount, attributeList])
    );
  }

  _parseReadTemplateAttributes(data) {
    let pointer = 6;

    this._attributes.ObjDefinitionSize = data.readUInt32LE(pointer);
    pointer += 8;
    this._attributes.StructureSize = data.readUInt32LE(pointer);
    pointer += 8;
    this._attributes.MemberCount = data.readUInt16LE(pointer);
    pointer += 6;
    this._attributes.StructureHandle = data.readUInt16LE(pointer);
  }

  _buildGetTemplateCIP(offset = 0, reqSize) {
    const { LOGICAL } = CIP.EPATH.segments;

    const path = Buffer.concat([
      CIP.EPATH.segments.LOGICAL.build(LOGICAL.types.ClassID, 0x6c),
      CIP.EPATH.segments.LOGICAL.build(
        LOGICAL.types.InstanceID,
        this._attributes.id
      ),
    ]);

    let offsetBuf = Buffer.alloc(4);
    offsetBuf.writeUInt32LE(offset);
    let size = Buffer.alloc(2);
    size.writeUInt16LE(reqSize);

    return CIP.MessageRouter.build(
      CIP.MessageRouter.services.READ_TAG,
      path,
      Buffer.concat([offsetBuf, size])
    );
  }

  _parseReadTemplate(data) {
    let pointer = 0;

    for (let i = 0; i < this._attributes.MemberCount; i++) {
      this._members.push({
        info: data.readUInt16LE(pointer),
        type: {
          code: data.readUInt16LE(pointer + 2) & 0x0fff,
          string: CIP.DataTypes.getTypeCodeString(
            data.readUInt16LE(pointer + 2) & 0x0fff
          ),
          structure: !!(data.readUInt16LE(pointer + 2) & 0x8000),
          reserved: !!(data.readUInt16LE(pointer + 2) & 0x1000),
          arrayDims: (data.readUInt16LE(pointer + 2) & 0x6000) >> 13,
        },
        offset: data.readUInt32LE(pointer + 4),
      });

      pointer += 8;
    }

    let nameArray = [];

    let addNameData = true;
    while (data[pointer] !== 0x00) {
      if (data[pointer] === 0x3b) {
        addNameData = false;
      }
      if (addNameData) {
        nameArray.push(data[pointer]);
      }
      pointer++;
    }
    pointer++;

    this._name = String.fromCharCode(...nameArray);

    // Get Each Member
    for (let j = 0; j < this._attributes.MemberCount; j++) {
      let memberNameArray = [];
      while (data[pointer] !== 0x00) {
        memberNameArray.push(data[pointer]);
        pointer++;
      }
      pointer++;
      this._members[j].name = String.fromCharCode(...memberNameArray);
    }
  }

  _getTemplateAttributes(PLC, templateID) {
    this.id = templateID;
    return new Promise((resolve, reject) => {
      const cipData = this._buildGetTemplateAttributesCIP(templateID);
      PLC.write_cip(cipData);

      PLC.on('Get Attributes', (error, data) => {
        PLC.removeAllListeners('Get Attributes');
        if (error) {
          reject(error);
          return;
        }

        this._parseReadTemplateAttributes(data);
        resolve();
      });
    });
  }

  async _getTemplate(PLC) {
    let reqSize = this._attributes.ObjDefinitionSize * 4 - 16;
    let buf = Buffer.alloc(0);

    const cipData = this._buildGetTemplateCIP(buf.length, reqSize - buf.length);
    PLC.write_cip(cipData);

    await PLC.consume({
      'Read Tag': (err, data) => {
        if (err && err.generalStatusCode !== 6) throw err;

        buf = Buffer.concat([buf, data]);
        if (err && err.generalStatusCode === 6) {
          const cipData = this._buildGetTemplateCIP(
            buf.length,
            reqSize - buf.length
          );
          PLC.write_cip(cipData);
        } else {
          return buf;
        }
      },
    });

    this._parseReadTemplate(buf);
  }

  async getTemplate(PLC, templateID) {
    this._attributes.id = templateID;
    await this._getTemplateAttributes(PLC, templateID);
    return await this._getTemplate(PLC);
  }
}

module.exports = Template;
