export default class Event {
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


