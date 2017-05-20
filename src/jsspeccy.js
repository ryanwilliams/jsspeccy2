/**
 * @license JSSpeccy v2.2.1 - http://jsspeccy.zxdemo.org/
 * Copyright 2014 Matt Westcott <matt@west.co.tt> and contributors
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of
 * the GNU General Public License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>.
 */

import Viewport from './viewport';
import Keyboard from './keyboard';
import Spectrum, { MODEL_128K } from './spectrum';
import { SoundBackend } from './sound';
import TapFile from './tap_file';
import TzxFile from './tzx_file';
import SnaFile from './sna_file';
import Z80File from './z80_file';
import autoloaders from './autoloaders';
import buildZ80 from './z80';


export class Event {
  constructor() {
    this.listeners = [];
  }

  bind(callback) {
    this.listeners.push(callback);
  }

  unbind(callback) {
    this.listeners.forEach((listener, i) => {
      if (listeners === callback) {
        listeners.splice(i, 1);
      }
    });
  }

  trigger() {
    var args = arguments;
    // event is considered 'cancelled' if any handler returned a value of false
    // (specifically false, not just a falsy value). Exactly what this means is
    // up to the caller - we just return false
    var cancelled = false;
    this.listeners.forEach((listener) => {
      cancelled = cancelled || (listener.apply(null, args) === false);
    });
    return !cancelled;
  }
}

export class Setting {
  constructor(initialValue) {
    var value = initialValue;

    this.onChange = new Event();

    this.get = () => {
      return value;
    };

    this.set = (newValue) => {
      if (newValue === value) return;
      value = newValue;
      this.onChange.trigger(newValue);
    };
  }
}

export default class JSSpeccy {
  constructor(container, opts) {
    if (container || opts) {
      this.attach(container, opts);
    }

    this.onAttach = new Event();
  }

  attach(container, opts = {}) {
    var currentModel, spectrum;
    this.attacahed = true;

    const tapeLoad = () => spectrum.tapeLoad();

    const z80Traps = [
      [0x056b, 0xc0, tapeLoad],
      [0x0111, 0xc0, tapeLoad]
    ];

    this.Z80 = buildZ80({
      traps: z80Traps,
      applyContention: true
    });

    this.settings = {
      checkerboardFilter: new Setting(opts.checkerboardFilter || false)
    };

    /* == Execution state == */
    this.isDownloading = false;
    this.isRunning = false;
    this.currentTape = null;


    /* == Set up viewport == */
    var viewport = new Viewport({
      container: container,
      scaleFactor: opts.scaleFactor || 2,
      onClickIcon: () => this.start(),
    });


    if (!('dragToLoad' in opts) || opts['dragToLoad']) {
      viewport.canvas.ondrop = (evt) => {
        var files = evt.dataTransfer.files;
        this.loadLocalFile(files[0]);
        return false;
      };
    }


    const updateViewportIcon = () => {
      if (this.isDownloading) {
        viewport.showIcon('loading');
      } else if (!this.isRunning) {
        viewport.showIcon('play');
      } else {
        viewport.showIcon(null);
      }
    }

    /* == Keyboard control == */
    var keyboard = new Keyboard();
    this.deactivateKeyboard = () => {
      keyboard.active = false;
    };
    this.activateKeyboard = () => {
      keyboard.active = true;
    };


    /* == Audio == */
    var soundBackend = new SoundBackend();
    this.onChangeAudioState = new Event();
    this.getAudioState = () => {
      return soundBackend.isEnabled;
    };
    this.setAudioState = (requestedState) => {
      var originalState = soundBackend.isEnabled;
      var newState = soundBackend.setAudioState(requestedState);
      if (originalState != newState) this.onChangeAudioState.trigger(newState);
    };

    /* == Snapshot / Tape file handling == */
    this.loadLocalFile = (file, opts) => {
      var reader = new FileReader();
      this.isDownloading = true;
      updateViewportIcon();
      reader.onloadend = () => {
        this.isDownloading = false;
        updateViewportIcon();
        this.loadFile(file.name, this.result, opts);
      };
      reader.readAsArrayBuffer(file);
    };
    this.loadFromUrl = (url, opts) => {
      var request = new XMLHttpRequest();

      request.addEventListener('error', (e) => {
        alert('Error loading from URL:' + url);
      });

      request.addEventListener('load', (e) => {
        this.isDownloading = false;
        updateViewportIcon();
        const data = request.response;
        this.loadFile(url, data, opts);
        /* URL is not ideal for passing as the 'filename' argument - e.g. the file
        may be served through a server-side script with a non-indicative file
        extension - but it's better than nothing, and hopefully the heuristics
        in loadFile will figure out what it is either way.
        Ideally we'd look for a header like Content-Disposition for a better clue,
        but XHR (on Chrome at least) doesn't give us access to that. Grr. */
      });

      /* trigger XHR */
      request.open('GET', url, true);
      request.responseType = "arraybuffer";
      this.isDownloading = true;
      updateViewportIcon();
      request.send();
    };

    this.loadFile = (name, data, opts) => {
      if (!opts) opts = {};

      var fileType = 'unknown';
      if (name && name.match(/\.sna(\.zip)?$/i)) {
        fileType = 'sna';
      } else if (name && name.match(/\.tap(\.zip)?$/i)) {
        fileType = 'tap';
      } else if (name && name.match(/\.tzx(\.zip)?$/i)) {
        fileType = 'tzx';
      } else if (name && name.match(/\.z80(\.zip)?$/i)) {
        fileType = 'z80';
      } else {
        var signatureBytes = new Uint8Array(data, 0, 8);
        var signature = String.fromCharCode.apply(null, signatureBytes);
        if (signature == "ZXTape!\x1A") {
          fileType = 'tzx';
        } else if (data.byteLength === 49179 || data.byteLength === 131103 || data.byteLength === 147487) {
          fileType = 'sna';
        } else if (TapFile.isValid(data)) {
          fileType = 'tap';
        }
      }

      switch (fileType) {
        case 'sna':
          loadSnapshot(SnaFile(data));
          break;
        case 'z80':
          loadSnapshot(Z80File(data));
          break;
        case 'tap':
          loadTape(TapFile(data), opts);
          break;
        case 'tzx':
          loadTape(TzxFile(data), opts);
          break;
      }
    };

    /* Load a snapshot from a snapshot object (i.e. SnaFile or JSSpeccy.Z80File) */
    const loadSnapshot = (snapshot) => {
      this.setModel(snapshot.model);
      this.reset(); /* required for the scenario that setModel does not change the current
        active machine, and current machine state would interfere with the snapshot loading -
        e.g. paging is locked */
      spectrum.loadSnapshot(snapshot);
      if (!this.isRunning) {
        spectrum.drawFullScreen();
      }
    }
    const loadTape = (tape, opts) => {
      if (!opts) opts = {};
      this.currentTape = tape;
      if (opts.autoload) {
        var snapshotBuffer = autoloaders[currentModel.tapeAutoloader].buffer;
        var snapshot = Z80File(snapshotBuffer);
        loadSnapshot(snapshot);
      }
    }


    /* == Selecting Spectrum model == */
    this.onChangeModel = new Event();
    this.getModel = () => {
      return currentModel;
    };
    this.setModel = (newModel) => {
      if (newModel != currentModel) {
        spectrum = new Spectrum({
          viewport: viewport,
          keyboard: keyboard,
          model: newModel,
          soundBackend: soundBackend,
          controller: this,
          borderEnabled: ('border' in opts) ? opts.border : true
        });
        currentModel = newModel;
        initReferenceTime();
        this.onChangeModel.trigger(newModel);
      }
    };


    /* == Timing / main execution loop == */
    var lastFrameStamp;
    var msPerFrame;
    var remainingMs = 0; /* number of milliseconds that have passed that have not yet been
    'consumed' by running a frame of emulation */

    const initReferenceTime = () => {
      msPerFrame = (currentModel.frameLength * 1000) / currentModel.clockSpeed;
      remainingMs = 0;
      lastFrameStamp = performance.now();
    }

    var PERFORMANCE_FRAME_COUNT = 10;  /* average over this many frames when measuring performance */
    var performanceTotalMilliseconds = 0;
    var performanceFrameNum = 0;

    var requestAnimationFrame = (
      window.requestAnimationFrame || window.msRequestAnimationFrame ||
      window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame ||
      window.oRequestAnimationFrame || function(callback) {
        setTimeout(() => {
          callback(performance.now());
        }, 10);
      }
    );

    const tick = () => {
      if (!this.isRunning) return;

      var stampBefore = performance.now();
      var timeElapsed = stampBefore - lastFrameStamp;
      remainingMs += stampBefore - lastFrameStamp;
      if (remainingMs > msPerFrame) {
        /* run a frame of emulation */
        spectrum.runFrame();
        var stampAfter = performance.now();

        if (opts.measurePerformance) {
          performanceTotalMilliseconds += (stampAfter - stampBefore);
          performanceFrameNum = (performanceFrameNum + 1) % PERFORMANCE_FRAME_COUNT;
          if (performanceFrameNum === 0) {
            document.title = originalDocumentTitle + ' ' + (performanceTotalMilliseconds / PERFORMANCE_FRAME_COUNT).toFixed(1) + " ms/frame; elapsed: " + timeElapsed;
            performanceTotalMilliseconds = 0;
          }
        }

        remainingMs -= msPerFrame;

        /* As long as requestAnimationFrame runs more frequently than the Spectrum's frame rate -
        which should normally be the case for a focused browser window (approx 60Hz vs 50Hz) -
        there should be either zero or one emulation frames run per call to tick(). If there's more
        than one emulation frame to run (i.e. remainingMs > msPerFrame at this point), we have
        insufficient performance to run at full speed (either the frame is taking more than 20ms to
        execute, or requestAnimationFrame is being called too infrequently). If so, clear
        remainingMs so that it doesn't grow indefinitely
        */
        if (remainingMs > msPerFrame) remainingMs = 0;
      }
      lastFrameStamp = stampBefore;

      requestAnimationFrame(tick);
    }

    this.onStart = new Event();
    this.start = () => {
      if (this.isRunning) return;
      this.isRunning = true;
      updateViewportIcon();
      this.onStart.trigger();

      initReferenceTime();

      requestAnimationFrame(tick);
    };
    this.onStop = new Event();
    this.stop = () => {
      this.isRunning = false;
      updateViewportIcon();
      this.onStop.trigger();
    };
    this.reset = () => {
      spectrum.reset();
    };


    /* == Startup conditions == */
    this.setModel(MODEL_128K);

    if (opts.loadFile) {
      this.loadFromUrl(opts.loadFile, {'autoload': opts.autoload});
    }

    if (!('audio' in opts) || opts['audio']) {
      this.setAudioState(true);
    } else {
      this.setAudioState(false);
    }

    if (!('autostart' in opts) || opts['autostart']) {
      this.start();
    } else {
      this.stop();
    }

    this.onAttach.trigger();
  }
}
