import { MODEL_48K, MODEL_128K } from './spectrum';
import roms from './roms';

export default class Memory {
  constructor(opts) {
    var model = opts.model || MODEL_128K;

    var contentionTableLength = model.frameLength;

    var noContentionTable = model.noContentionTable;
    var contentionTable = model.contentionTable;

    class MemoryPage {
      constructor(data, isContended)  {
        this.memory = (data || new Uint8Array(0x4000));
        this.contentionTable = (isContended ? contentionTable : noContentionTable);

        return this;
      }
    }


    var ramPages = [];
    for (var i = 0; i < 8; i++) {
      ramPages[i] = new MemoryPage(null, i & 0x01); /* for MODEL_128K (and implicitly 48K), odd pages are contended */
    }

    var romPages = {
      '48.rom': new MemoryPage(roms['48.rom']),
      '128-0.rom': new MemoryPage(roms['128-0.rom']),
      '128-1.rom': new MemoryPage(roms['128-1.rom'])
    };

    var scratch = new MemoryPage();

    var readSlots = [
      model === MODEL_48K ? romPages['48.rom'].memory : romPages['128-0.rom'].memory,
      ramPages[5].memory,
      ramPages[2].memory,
      ramPages[0].memory
    ];

    var writeSlots = [
      scratch.memory,
      ramPages[5].memory,
      ramPages[2].memory,
      ramPages[0].memory
    ];

    var contentionBySlot = [
      noContentionTable,
      contentionTable,
      noContentionTable,
      noContentionTable
    ];

    this.isContended = (addr) => {
      return (contentionBySlot[addr >> 14] == contentionTable);
    };

    this.contend = (addr, tstate) => {
      return contentionBySlot[addr >> 14][tstate % contentionTableLength];
    };

    this.read = (addr) => {
      var page = readSlots[addr >> 14];
      return page[addr & 0x3fff];
    };
    this.write = (addr, val) => {
      var page = writeSlots[addr >> 14];
      page[addr & 0x3fff] = val;
    };

    var screenPage = ramPages[5].memory;
    this.readScreen = (addr) => {
      return screenPage[addr];
    };

    var pagingIsLocked = false;
    if (model === MODEL_128K) {
      this.setPaging = (val) => {
        if (pagingIsLocked) return;
        var highMemoryPage = ramPages[val & 0x07];
        readSlots[3] = writeSlots[3] = highMemoryPage.memory;
        contentionBySlot[3] = highMemoryPage.contentionTable;
        readSlots[0] = (val & 0x10) ? romPages['128-1.rom'].memory : romPages['128-0.rom'].memory;
        screenPage = (val & 0x08) ? ramPages[7].memory : ramPages[5].memory;
        pagingIsLocked = val & 0x20;
      };
    } else {
      this.setPaging = (val) => {
      };
    }

    this.loadFromSnapshot = (snapshotPages) => {
      for (var p in snapshotPages) {
        var ramPage = ramPages[p].memory;
        var snapshotPage = snapshotPages[p];
        for (var i = 0; i < 0x4000; i++) {
          ramPage[i] = snapshotPage[i];
        }
      }
    };

    this.reset = () => {
      pagingIsLocked = false;
      this.setPaging(0);
    };

  };
}
