"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _events = _interopRequireDefault(require("events"));

var _dns = _interopRequireDefault(require("@wnynya/dns"));

var _ip = _interopRequireDefault(require("@wnynya/ip"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _url = require("url");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ___filename = (0, _url.fileURLToPath)(require('url').pathToFileURL(__filename).toString());

const ___dirname = _path.default.dirname(___filename);

const knownPorts = JSON.parse(_fs.default.readFileSync(_path.default.resolve(___dirname, '../data/known-ports.json')));

class Ping extends _events.default {
  constructor(options) {
    super();
    this.options = options;
    this.options.host = this.options.host.toLowerCase();
    this.options.dnsResolve = this.options.dnsResolve != undefined ? this.options.dnsResolve : true;
    this.options.filterBogon = this.options.filterBogon != undefined ? this.options.filterBogon : false;
    this.options.timeout = this.options.timeout ? this.options.timeout * 1 : 2000;
    this.id = this.#genid();
    this.#parsePorts();
    this.result = {
      error: undefined,
      type: 'ping',
      status: undefined,
      host: this.options.host,
      ip: null,
      ips: [],
      time: -1
    };
  }

  #genid() {
    return randomString(16);

    function randomString(length, pool = '0123456789abcdef') {
      pool = pool.split('');
      let string = '';

      for (let i = 0; i < length; i++) {
        string += pool[Math.floor(Math.random() * pool.length)];
      }

      return string;
    }
  }

  #parsePorts() {
    this.options.portsx = this.options.portsx != undefined ? this.options.portsx : 65536;

    if (this.options.ports) {
      let ports = this.options.ports;

      if (typeof ports == 'string') {
        if (/^(?:\d{1,5},|\d{1,5}-\d{1,5},)+\d{1,5}|\d{1,5}-\d{1,5}/.test(ports)) {
          let parts = ports.split(',');
          ports = [];

          for (let part of parts) {
            const m = /^(\d{1,5})-(\d{1,5})/.exec(part);

            if (m) {
              for (let i = Math.min(m[1], m[2]); i <= Math.max(m[1], m[2]); i++) {
                ports.push(i);
              }
            } else {
              ports.push(part * 1);
            }
          }
        } else if (ports == '*') {
          ports = [];

          for (let i = 1; i <= 65535; i++) {
            ports.push(i);
          }
        } else if (ports == '@') {
          if (this.constructor.name == 'PingTCP') {
            ports = knownPorts.ports.tcp;
          } else if (this.constructor.name == 'PingUDP') {
            ports = knownPorts.ports.udp;
          }
        } else {
          ports = [Math.floor(ports * 1)];
        }
      } else if (typeof ports == 'number') {
        ports = [Math.floor(ports)];
      }

      const cports = JSON.parse(JSON.stringify(ports));
      ports = [];

      p: for (let p of cports) {
        p = p * 1;

        if (!Number.isNaN(p) && 0 < p && p < 65536) {
          ports.push(p);
        }

        if (this.options.portsx < ports.length) {
          break p;
        }
      }

      this.options.ports = ports;
    }
  }

  async #dnsResolve() {
    const ips = await _dns.default.ips(this.options.host, this.options.dnsServer);

    if (!ips) {
      this.result.error = 'ENOTFOUND';
      this.result.status = 'error';
      throw new Error(this.result.error);
    }

    this.result.ips = ips;
    this.result.ip = ips[0];
  }

  #filterBogon() {
    if (this.options.filterBogon && new _ip.default(this.result.ip).isBogon()) {
      this.result.error = 'EBOGONIP';
      this.result.status = 'error';
      throw new Error(this.result.error);
    }
  }

  async ready() {
    if (this.options.dnsResolve) {
      await this.#dnsResolve().catch(error => {
        throw error;
      });
    } else {
      this.result.ip = this.options.host;
      this.result.ips = [this.result.ip];
    }

    if (this.options.filterBogon) {
      try {
        this.#filterBogon();
      } catch (error) {
        throw error;
      }
    }

    try {
      new _ip.default(this.result.ip);
    } catch (error) {
      throw 'ENOTFOUND';
    }

    this.result.status = 'ready';
    return;
  }

  emitResult() {
    this.emit('result', this.result);
  }

  emitError(error) {
    this.emit('error', error, this.result);
  }

  emitTask(task) {
    this.emit('task', task);
  }

  portName(port) {
    if (this.constructor.name == 'PingTCP') {
      return knownPorts.names.tcp?.[port] ? knownPorts.names.tcp?.[port] : 'unknown';
    } else if (this.constructor.name == 'PingUDP') {
      return knownPorts.names.udp?.[port] ? knownPorts.names.udp?.[port] : 'unknown';
    } else {
      return 'unknown';
    }
  }

}

var _default = Ping;
exports.default = _default;