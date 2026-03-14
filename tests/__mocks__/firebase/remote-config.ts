export function getRemoteConfig() {
  return {
    settings: {},
    defaultConfig: {},
  };
}
export function fetchAndActivate() { return Promise.resolve(true); }
export function getValue() { return { asString: () => '', asNumber: () => 0, asBoolean: () => false }; }
