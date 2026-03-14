export function getDatabase() { return {}; }
export function ref() { return {}; }
export function set() { return Promise.resolve(); }
export function get() { return Promise.resolve({ exists: () => false, val: () => null }); }
export function update() { return Promise.resolve(); }
export function onValue() { return () => {}; }
export function off() {}
